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

class StatusUpdateRequest(BaseModel):
    patient_id: int
    status: str  # "WAITING", "ASSIGNED", "IN_TREATMENT", "COMPLETED"

class PatientIdRequest(BaseModel):
    patient_id: int

class DoctorAssignmentRequest(BaseModel):
    patient_id: int
    doctor_id: str = ""  # Doctor ID from DOCTORS list

# Valid patient statuses (workflow: WAITING → ASSIGNED → IN_TREATMENT → COMPLETED)
VALID_STATUSES = ["WAITING", "ASSIGNED", "IN_TREATMENT", "COMPLETED"]
ACTIVE_STATUSES = ["WAITING", "ASSIGNED", "IN_TREATMENT"]  # Statuses that count as "active" in queue

# ------- Doctor Specialties Database -------
DOCTORS = [
    {
        "id": "dr_cardio_01",
        "name": "Dr. Sarah Mitchell",
        "specialty": "Cardiologist",
        "keywords": ["chest pain", "heart", "cardiac", "palpitation", "angina", "hypertension", "blood pressure", "heart attack", "arrhythmia", "cardiovascular", "coronary"]
    },
    {
        "id": "dr_neuro_01",
        "name": "Dr. James Chen",
        "specialty": "Neurologist",
        "keywords": ["headache", "migraine", "brain", "seizure", "stroke", "dizziness", "numbness", "paralysis", "memory", "confusion", "tremor", "neuropathy", "epilepsy"]
    },
    {
        "id": "dr_pulmo_01",
        "name": "Dr. Emily Rodriguez",
        "specialty": "Pulmonologist",
        "keywords": ["breathing", "respiratory", "lung", "asthma", "cough", "shortness of breath", "pneumonia", "bronchitis", "wheezing", "oxygen", "spo2", "pulmonary"]
    },
    {
        "id": "dr_gastro_01",
        "name": "Dr. Michael Park",
        "specialty": "Gastroenterologist",
        "keywords": ["stomach", "abdomen", "abdominal", "nausea", "vomiting", "diarrhea", "constipation", "digestive", "liver", "gastric", "intestinal", "bowel", "acid reflux"]
    },
    {
        "id": "dr_ortho_01",
        "name": "Dr. Amanda Foster",
        "specialty": "Orthopedist",
        "keywords": ["bone", "fracture", "joint", "back pain", "spine", "muscle", "arthritis", "knee", "shoulder", "hip", "ligament", "sprain", "orthopedic"]
    },
    {
        "id": "dr_endo_01",
        "name": "Dr. Robert Kim",
        "specialty": "Endocrinologist",
        "keywords": ["diabetes", "thyroid", "hormone", "insulin", "glucose", "blood sugar", "metabolic", "obesity", "adrenal", "pituitary"]
    },
    {
        "id": "dr_derm_01",
        "name": "Dr. Lisa Wang",
        "specialty": "Dermatologist",
        "keywords": ["skin", "rash", "itching", "allergy", "eczema", "psoriasis", "acne", "wound", "burn", "infection", "dermatitis"]
    },
    {
        "id": "dr_ent_01",
        "name": "Dr. David Thompson",
        "specialty": "ENT Specialist",
        "keywords": ["ear", "nose", "throat", "sinus", "hearing", "tonsil", "voice", "swallowing", "nasal", "vertigo"]
    },
    {
        "id": "dr_nephro_01",
        "name": "Dr. Jessica Lee",
        "specialty": "Nephrologist",
        "keywords": ["kidney", "renal", "urinary", "dialysis", "creatinine", "urine", "bladder"]
    },
    {
        "id": "dr_em_01",
        "name": "Dr. William Brown",
        "specialty": "Emergency Medicine",
        "keywords": ["emergency", "trauma", "accident", "critical", "urgent", "severe", "acute", "unconscious", "bleeding"]
    },
    {
        "id": "dr_general_01",
        "name": "Dr. Patricia Davis",
        "specialty": "General Physician",
        "keywords": ["fever", "cold", "flu", "fatigue", "weakness", "general", "checkup", "routine"]
    }
]

def get_recommended_doctor(symptoms_text: str, triage_level: str = None) -> dict:
    """Returns the best matching doctor based on symptoms."""
    symptoms_lower = symptoms_text.lower()
    
    # If critical/urgent and has trauma keywords, assign to Emergency
    if triage_level in ["Critical", "Urgent"]:
        emergency_keywords = ["trauma", "accident", "unconscious", "severe bleeding", "critical"]
        if any(kw in symptoms_lower for kw in emergency_keywords):
            return next((d for d in DOCTORS if d["specialty"] == "Emergency Medicine"), DOCTORS[-1])
    
    # Score each doctor based on keyword matches
    scores = []
    for doctor in DOCTORS:
        score = sum(1 for kw in doctor["keywords"] if kw in symptoms_lower)
        scores.append((doctor, score))
    
    # Sort by score descending
    scores.sort(key=lambda x: x[1], reverse=True)
    
    # If best score > 0, return that doctor; else return General Physician
    if scores[0][1] > 0:
        return scores[0][0]
    
    return next((d for d in DOCTORS if d["specialty"] == "General Physician"), DOCTORS[-1])

# ------- Routes -------

@router.post("/patient-intake")
@limiter.limit("10/minute")
async def register_patient_intake(request: Request, data: PatientIntakeRequest):
    """Registers a new patient and stores their initial data in MongoDB."""
    
    # Check for duplicate: same name with active status (WAITING, ASSIGNED, IN_TREATMENT)
    existing_patient = patients_collection.find_one({
        "name": {"$regex": f"^{data.name}$", "$options": "i"},  # Case-insensitive match
        "status": {"$in": ACTIVE_STATUSES}
    })
    
    if existing_patient:
        raise HTTPException(
            status_code=400, 
            detail=f"Patient '{data.name}' already has an active triage request (Status: {existing_patient['status']}). Please wait until their current visit is completed."
        )
    
    patient_id = get_next_patient_id()
    now = datetime.utcnow()

    patient_doc = {
        "patient_id": patient_id,
        "name": data.name,
        "age": data.age,
        "gender": data.gender,
        "symptoms_text": data.symptoms_text,
        "arrival_time": now,
        "registration_time": now,
        "status": "WAITING",
        "triage_time": None,
        "assigned_time": None,
        "assigned_doctor": None,
        "treatment_start_time": None,
        "completed_time": None,
    }
    patients_collection.insert_one(patient_doc)

    vitals_doc = {
        "patient_id": patient_id,
        "heart_rate": data.heart_rate,
        "blood_pressure": data.blood_pressure,
        "temperature": data.temperature,
        "spo2": data.spo2,
        "respiratory_rate": data.respiratory_rate,
        "recorded_at": now,
    }
    vitals_collection.insert_one(vitals_doc)

    return {"status": "success", "patient_id": patient_id, "registration_time": now.isoformat()}


@router.post("/triage")
@limiter.limit("20/minute")
async def run_triage(request: Request, patient_id: int):
    """Runs the full AI triage pipeline for an existing patient."""
    patient = patients_collection.find_one({"patient_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Check if patient already has an active triage result
    existing_triage = triage_results_collection.find_one({"patient_id": patient_id})
    if existing_triage and patient.get("status") in ACTIVE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Patient already has an active triage request (Status: {patient.get('status')}). Cannot create duplicate triage."
        )

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
    
    # Update patient's triage_time
    patients_collection.update_one(
        {"patient_id": patient_id},
        {"$set": {"triage_time": datetime.utcnow()}}
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
def get_patients_queue(request: Request, include_completed: bool = False):
    """Returns patients sorted by Queue Priority Algorithm."""
    # Filter: exclude COMPLETED patients by default (only show active queue)
    query = {} if include_completed else {"status": {"$in": ACTIVE_STATUSES}}
    patients = list(patients_collection.find(query))
    queue = []

    triage_weights = {
        "Critical": 4, "Urgent": 3, "Moderate": 2, "Non Urgent": 1, "Unknown": 0
    }
    
    status_weights = {
        "WAITING": 3, "ASSIGNED": 2, "IN_TREATMENT": 1, "COMPLETED": 0
    }

    now = datetime.utcnow()

    for p in patients:
        t_res = triage_results_collection.find_one({"patient_id": p["patient_id"]})
        t_level = t_res["triage_level"] if t_res else "Unknown"
        t_conf = t_res["confidence_score"] if t_res else 0.0

        waiting_minutes = (now - p["arrival_time"]).total_seconds() / 60.0
        triage_weight = triage_weights.get(t_level, 0)
        status_weight = status_weights.get(p.get("status", "Waiting"), 0)
        
        # Priority: triage level * 10 + status weight * 5 + waiting time
        priority_score = (triage_weight * 10) + (status_weight * 5) + waiting_minutes

        queue.append({
            "patient_id": p["patient_id"],
            "name": p["name"],
            "age": p["age"],
            "gender": p["gender"],
            "triage_level": t_level,
            "confidence": t_conf,
            "status": p.get("status", "WAITING"),
            "assigned_doctor": p.get("assigned_doctor"),
            "assigned_specialty": p.get("assigned_specialty"),
            "arrival_time": p["arrival_time"].isoformat(),
            "registration_time": p.get("registration_time", p["arrival_time"]).isoformat(),
            "triage_time": p.get("triage_time").isoformat() if p.get("triage_time") else None,
            "assigned_time": p.get("assigned_time").isoformat() if p.get("assigned_time") else None,
            "treatment_start_time": p.get("treatment_start_time").isoformat() if p.get("treatment_start_time") else None,
            "completed_time": p.get("completed_time").isoformat() if p.get("completed_time") else None,
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
            "status": patient.get("status", "WAITING"),
            "assigned_doctor": patient.get("assigned_doctor"),
            "assigned_doctor_id": patient.get("assigned_doctor_id"),
            "assigned_specialty": patient.get("assigned_specialty"),
            "arrival_time": patient["arrival_time"].isoformat(),
            "registration_time": patient.get("registration_time", patient["arrival_time"]).isoformat(),
            "triage_time": patient.get("triage_time").isoformat() if patient.get("triage_time") else None,
            "assigned_time": patient.get("assigned_time").isoformat() if patient.get("assigned_time") else None,
            "treatment_start_time": patient.get("treatment_start_time").isoformat() if patient.get("treatment_start_time") else None,
            "completed_time": patient.get("completed_time").isoformat() if patient.get("completed_time") else None,
        },
        "vitals": {
            "heart_rate": vitals.get("heart_rate") if vitals else None,
            "blood_pressure": vitals.get("blood_pressure") if vitals else None,
            "temperature": vitals.get("temperature") if vitals else None,
            "spo2": vitals.get("spo2") if vitals else None,
            "respiratory_rate": vitals.get("respiratory_rate") if vitals else None,
            "recorded_at": vitals.get("recorded_at").isoformat() if vitals and vitals.get("recorded_at") else None,
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


@router.post("/update-status")
def update_patient_status(request: Request, data: StatusUpdateRequest):
    """Updates patient status (WAITING, ASSIGNED, IN_TREATMENT, COMPLETED)."""
    if data.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}"
        )
    
    patient = patients_collection.find_one({"patient_id": data.patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    update_fields = {"status": data.status}
    now = datetime.utcnow()
    
    # Set appropriate timestamp based on status change
    if data.status == "ASSIGNED" and not patient.get("assigned_time"):
        update_fields["assigned_time"] = now
    elif data.status == "IN_TREATMENT" and not patient.get("treatment_start_time"):
        update_fields["treatment_start_time"] = now
    elif data.status == "COMPLETED" and not patient.get("completed_time"):
        update_fields["completed_time"] = now
    
    patients_collection.update_one(
        {"patient_id": data.patient_id},
        {"$set": update_fields}
    )
    
    return {
        "status": "success", 
        "patient_id": data.patient_id, 
        "new_status": data.status,
        "updated_at": now.isoformat()
    }


@router.get("/doctors")
def get_all_doctors(request: Request):
    """Returns list of all available doctors with their current availability status."""
    doctors_list = []
    for d in DOCTORS:
        # Check if doctor is currently treating someone
        treating_patient = patients_collection.find_one({
            "assigned_doctor_id": d["id"],
            "status": "IN_TREATMENT"
        })
        doctors_list.append({
            "id": d["id"],
            "name": d["name"],
            "specialty": d["specialty"],
            "available": treating_patient is None,
            "current_patient": treating_patient.get("name") if treating_patient else None
        })
    return {"doctors": doctors_list}


@router.get("/doctors/recommend/{patient_id}")
def get_recommended_doctor_for_patient(request: Request, patient_id: int):
    """Returns the recommended doctor based on patient's symptoms."""
    patient = patients_collection.find_one({"patient_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Get triage result if available
    triage = triage_results_collection.find_one({"patient_id": patient_id})
    triage_level = triage["triage_level"] if triage else None
    
    symptoms_text = patient.get("symptoms_text", "")
    recommended = get_recommended_doctor(symptoms_text, triage_level)
    
    return {
        "recommended_doctor": {
            "id": recommended["id"],
            "name": recommended["name"],
            "specialty": recommended["specialty"]
        },
        "reason": f"Based on symptoms matching {recommended['specialty']} expertise"
    }


@router.post("/assign-doctor")
def assign_doctor(request: Request, data: DoctorAssignmentRequest):
    """Assigns a doctor to a patient and updates status to ASSIGNED."""
    patient = patients_collection.find_one({"patient_id": data.patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    if patient.get("status") not in ["WAITING"]:
        raise HTTPException(
            status_code=400,
            detail=f"Can only assign doctor to patients with WAITING status. Current status: {patient.get('status')}"
        )
    
    # Find doctor by ID
    doctor = next((d for d in DOCTORS if d["id"] == data.doctor_id), None)
    if not doctor and data.doctor_id:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # If no doctor_id provided, use recommended doctor
    if not doctor:
        triage = triage_results_collection.find_one({"patient_id": data.patient_id})
        triage_level = triage["triage_level"] if triage else None
        doctor = get_recommended_doctor(patient.get("symptoms_text", ""), triage_level)
    
    # Check if doctor is already treating another patient (IN_TREATMENT status)
    existing_patient = patients_collection.find_one({
        "assigned_doctor_id": doctor["id"],
        "status": "IN_TREATMENT"
    })
    if existing_patient:
        raise HTTPException(
            status_code=400,
            detail=f"Dr. {doctor['name']} is currently treating another patient ({existing_patient.get('name', 'Unknown')}). Please wait until treatment is completed or choose another doctor."
        )
    
    now = datetime.utcnow()
    patients_collection.update_one(
        {"patient_id": data.patient_id},
        {"$set": {
            "status": "ASSIGNED",
            "assigned_doctor": doctor["name"],
            "assigned_doctor_id": doctor["id"],
            "assigned_specialty": doctor["specialty"],
            "assigned_time": now
        }}
    )
    
    return {
        "status": "success",
        "patient_id": data.patient_id,
        "new_status": "ASSIGNED",
        "assigned_doctor": doctor["name"],
        "assigned_specialty": doctor["specialty"],
        "assigned_at": now.isoformat()
    }


@router.post("/start-treatment")
def start_treatment(request: Request, data: PatientIdRequest):
    """Marks a patient as IN_TREATMENT."""
    patient = patients_collection.find_one({"patient_id": data.patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    if patient.get("status") not in ["WAITING", "ASSIGNED"]:
        raise HTTPException(
            status_code=400,
            detail=f"Can only start treatment for patients with WAITING or ASSIGNED status. Current status: {patient.get('status')}"
        )
    
    now = datetime.utcnow()
    patients_collection.update_one(
        {"patient_id": data.patient_id},
        {"$set": {
            "status": "IN_TREATMENT",
            "treatment_start_time": now
        }}
    )
    
    return {
        "status": "success",
        "patient_id": data.patient_id,
        "new_status": "IN_TREATMENT",
        "treatment_started_at": now.isoformat()
    }


@router.post("/complete-treatment")
def complete_treatment(request: Request, data: PatientIdRequest):
    """Marks a patient as COMPLETED. Patient can submit new triage after this."""
    patient = patients_collection.find_one({"patient_id": data.patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    if patient.get("status") != "IN_TREATMENT":
        raise HTTPException(
            status_code=400,
            detail=f"Can only complete treatment for patients with IN_TREATMENT status. Current status: {patient.get('status')}"
        )
    
    now = datetime.utcnow()
    patients_collection.update_one(
        {"patient_id": data.patient_id},
        {"$set": {
            "status": "COMPLETED",
            "completed_time": now
        }}
    )
    
    return {
        "status": "success",
        "patient_id": data.patient_id,
        "new_status": "COMPLETED",
        "completed_at": now.isoformat(),
        "message": "Patient can now submit a new triage request if needed."
    }


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


@router.delete("/patient/{patient_id}")
def delete_patient(request: Request, patient_id: int):
    """Deletes a patient record and associated triage results from the database."""
    patient = patients_collection.find_one({"patient_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Delete from patients collection
    patients_collection.delete_one({"patient_id": patient_id})
    
    # Delete associated triage results
    triage_results_collection.delete_one({"patient_id": patient_id})
    
    return {
        "status": "success",
        "message": f"Patient {patient_id} and associated records deleted successfully"
    }
