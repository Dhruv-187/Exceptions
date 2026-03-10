from fastapi import APIRouter, HTTPException, Request
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from slowapi import Limiter
from slowapi.util import get_remote_address

from database import (
    patients_collection, vitals_collection, triage_results_collection,
    get_next_patient_id
)
from services.feature_validation import validate_symptoms, construct_feature_vector
from services.gemini_service import extract_symptoms_from_text, generate_explanation
from services.ml_service import predict_triage
from services.logging_service import log_triage_decision, log_doctor_override

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# ------- Pydantic Schemas -------

class PatientIntakeRequest(BaseModel):
    name: str
    age: int
    gender: str
    symptoms_text: str
    heart_rate: Optional[float] = None
    blood_pressure: Optional[str] = None
    temperature: Optional[float] = None
    spo2: Optional[float] = None
    respiratory_rate: Optional[float] = None
    medical_history: List[str] = []

class OverrideRequest(BaseModel):
    patient_id: int
    new_triage: str
    reason: str = ""

# ------- Routes -------

@router.post("/patient-intake")
@limiter.limit("10/minute")
async def register_patient_intake(request: Request, data: PatientIntakeRequest):
    """Registers a new patient and stores their initial data in MongoDB."""
    patient_id = get_next_patient_id()
    now = datetime.utcnow()

    patient_doc = {
        "patient_id": patient_id,
        "name": data.name,
        "age": data.age,
        "gender": data.gender,
        "symptoms_text": data.symptoms_text,
        "arrival_time": now,
    }
    patients_collection.insert_one(patient_doc)

    vitals_doc = {
        "patient_id": patient_id,
        "heart_rate": data.heart_rate,
        "blood_pressure": data.blood_pressure,
        "temperature": data.temperature,
        "spo2": data.spo2,
        "respiratory_rate": data.respiratory_rate,
    }
    vitals_collection.insert_one(vitals_doc)

    return {"status": "success", "patient_id": patient_id}


@router.post("/triage")
@limiter.limit("20/minute")
async def run_triage(request: Request, patient_id: int):
    """Runs the full AI triage pipeline for an existing patient."""
    patient = patients_collection.find_one({"patient_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    vitals = vitals_collection.find_one({"patient_id": patient_id})

    # 1. Symptom Extraction (Gemini)
    extracted_symptoms = await extract_symptoms_from_text(patient.get("symptoms_text", ""))

    # 2. Feature Construction
    patient_data = {
        "age": patient["age"],
        "gender": patient["gender"],
        "heart_rate": vitals.get("heart_rate") if vitals else None,
        "blood_pressure": vitals.get("blood_pressure") if vitals else None,
        "temperature": vitals.get("temperature") if vitals else None,
        "spo2": vitals.get("spo2") if vitals else None,
        "respiratory_rate": vitals.get("respiratory_rate") if vitals else None,
        "medical_history": [],
    }
    feature_vector = construct_feature_vector(patient_data, extracted_symptoms)

    # 3. ML Prediction
    ml_result = predict_triage(feature_vector)

    # 4. Reason Generation (Gemini)
    explanation = await generate_explanation(patient_data, ml_result["prediction"])

    # 5. Store Result in MongoDB
    triage_doc = {
        "patient_id": patient_id,
        "ml_prediction": ml_result["prediction_raw"],
        "confidence_score": ml_result["confidence"],
        "llm_reasoning": explanation,
        "triage_level": ml_result["prediction"],
        "doctor_override": None,
        "timestamp": datetime.utcnow(),
    }
    # Upsert so re-triaging updates the existing record
    triage_results_collection.update_one(
        {"patient_id": patient_id}, {"$set": triage_doc}, upsert=True
    )

    # 6. Logging
    log_triage_decision(
        patient_id=patient_id,
        input_symptoms=extracted_symptoms,
        ml_prediction=ml_result["prediction"],
        confidence=ml_result["confidence"],
        llm_reasoning=explanation,
    )

    return {
        "triage_level": ml_result["prediction"],
        "confidence": ml_result["confidence"],
        "explanation": explanation,
        "explanations_shap": ml_result.get("explanations", []),
    }


@router.get("/patients")
def get_patients_queue(request: Request):
    """Returns patients sorted by Queue Priority Algorithm."""
    patients = list(patients_collection.find())
    queue = []

    triage_weights = {
        "Critical": 4, "Urgent": 3, "Moderate": 2, "Non Urgent": 1, "Unknown": 0
    }

    now = datetime.utcnow()

    for p in patients:
        t_res = triage_results_collection.find_one({"patient_id": p["patient_id"]})
        t_level = t_res["triage_level"] if t_res else "Unknown"
        t_conf = t_res["confidence_score"] if t_res else 0.0

        waiting_minutes = (now - p["arrival_time"]).total_seconds() / 60.0
        weight = triage_weights.get(t_level, 0)
        priority_score = (weight * 10) + waiting_minutes

        queue.append({
            "patient_id": p["patient_id"],
            "name": p["name"],
            "age": p["age"],
            "gender": p["gender"],
            "triage_level": t_level,
            "confidence": t_conf,
            "arrival_time": p["arrival_time"].isoformat(),
            "waiting_minutes": int(waiting_minutes),
            "priority_score": round(priority_score, 2),
        })

    queue.sort(key=lambda x: x["priority_score"], reverse=True)
    return queue


@router.get("/patient/{patient_id}")
def get_patient_detail(request: Request, patient_id: int):
    """Returns full patient profile and AI results."""
    patient = patients_collection.find_one({"patient_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    vitals = vitals_collection.find_one({"patient_id": patient_id})
    t_res = triage_results_collection.find_one({"patient_id": patient_id})

    result = {
        "patient": {
            "id": patient["patient_id"],
            "name": patient["name"],
            "age": patient["age"],
            "gender": patient["gender"],
            "symptoms_text": patient.get("symptoms_text", ""),
            "arrival_time": patient["arrival_time"].isoformat(),
        },
        "vitals": {
            "heart_rate": vitals.get("heart_rate") if vitals else None,
            "blood_pressure": vitals.get("blood_pressure") if vitals else None,
            "temperature": vitals.get("temperature") if vitals else None,
            "spo2": vitals.get("spo2") if vitals else None,
            "respiratory_rate": vitals.get("respiratory_rate") if vitals else None,
        },
        "triage": None,
    }

    if t_res:
        result["triage"] = {
            "ml_prediction": t_res["ml_prediction"],
            "confidence_score": t_res["confidence_score"],
            "llm_reasoning": t_res.get("llm_reasoning"),
            "triage_level": t_res["triage_level"],
            "doctor_override": t_res.get("doctor_override"),
            "timestamp": t_res["timestamp"].isoformat(),
        }
    return result


@router.post("/override-triage")
def override_triage(request: Request, data: OverrideRequest):
    """Allows doctors to override AI decision."""
    t_res = triage_results_collection.find_one({"patient_id": data.patient_id})
    if not t_res:
        raise HTTPException(status_code=404, detail="Triage result not found for patient")

    old_triage = t_res["triage_level"]
    triage_results_collection.update_one(
        {"patient_id": data.patient_id},
        {"$set": {"triage_level": data.new_triage, "doctor_override": "YES"}},
    )

    log_doctor_override(data.patient_id, old_triage, data.new_triage, data.reason)
    return {"status": "success", "new_triage": data.new_triage}


@router.get("/analytics")
def get_analytics(request: Request):
    """Returns hospital statistics and model monitoring metrics."""
    triage_results = list(triage_results_collection.find())

    total = len(triage_results)
    if total == 0:
        return {"total_patients": 0}

    critical_count = sum(1 for t in triage_results if t["triage_level"] == "Critical")
    override_count = sum(1 for t in triage_results if t.get("doctor_override") == "YES")

    distribution = {
        "Critical": critical_count,
        "Urgent": sum(1 for t in triage_results if t["triage_level"] == "Urgent"),
        "Moderate": sum(1 for t in triage_results if t["triage_level"] == "Moderate"),
        "Non Urgent": sum(1 for t in triage_results if t["triage_level"] == "Non Urgent"),
    }

    return {
        "total_patients": total,
        "critical_percentage": round((critical_count / total) * 100, 2),
        "override_frequency_percentage": round((override_count / total) * 100, 2),
        "prediction_distribution": distribution,
    }
