from fastapi import APIRouter, HTTPException, Request
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from slowapi import Limiter
from slowapi.util import get_remote_address

from database import (
    patients_collection, vitals_collection, triage_results_collection,
    activity_logs_collection, patient_profiles_collection,
    get_next_patient_id, get_next_profile_id, log_activity
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


class PatientProfileRequest(BaseModel):
    name: str
    age: int
    gender: str
    medical_history: List[str] = []
    # Optional pre-filled notes
    notes: str = ""


class CriticalEmergencyRequest(BaseModel):
    name: str
    # Optional additional info if known
    age: Optional[int] = None
    gender: Optional[str] = None
    brief_description: Optional[str] = None


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

    # Log the registration activity
    log_activity("PATIENT_REGISTERED", patient_id, data.name, f"New patient registered with symptoms: {data.symptoms_text[:50]}...")

    return {"status": "success", "patient_id": patient_id, "registration_time": now.isoformat()}


@router.post("/critical-emergency")
@limiter.limit("20/minute")
async def register_critical_emergency(request: Request, data: CriticalEmergencyRequest):
    """
    Quick registration for critical emergency patients.
    Only requires name - automatically escalates to critical priority
    and assigns an available doctor immediately.
    """
    
    # Check for duplicate: same name with active status
    existing_patient = patients_collection.find_one({
        "name": {"$regex": f"^{data.name}$", "$options": "i"},
        "status": {"$in": ACTIVE_STATUSES}
    })
    
    if existing_patient:
        raise HTTPException(
            status_code=400, 
            detail=f"Patient '{data.name}' already has an active triage request. Use the admin dashboard to mark them as critical instead."
        )
    
    patient_id = get_next_patient_id()
    now = datetime.utcnow()
    
    # Default values for critical emergency
    age = data.age if data.age else 0  # 0 indicates unknown
    gender = data.gender if data.gender else "Unknown"
    symptoms = data.brief_description if data.brief_description else "CRITICAL EMERGENCY - Details pending"
    
    # Try to find an available doctor to auto-assign
    assigned_doctor = None
    assigned_doctor_ids = [p.get("assigned_doctor_id") for p in patients_collection.find(
        {"status": {"$in": ["ASSIGNED", "IN_TREATMENT"]}, "assigned_doctor_id": {"$ne": None}}
    ) if p.get("assigned_doctor_id")]
    
    available_doctors = [d for d in DOCTORS if d["id"] not in assigned_doctor_ids]
    
    unassigned_from = None
    if available_doctors:
        # Use first available doctor
        assigned_doctor = available_doctors[0]
    else:
        # No available doctors - steal from a non-critical ASSIGNED patient
        non_critical_assigned = list(patients_collection.find({
            "status": "ASSIGNED",
            "critical_priority": {"$ne": True},
            "assigned_doctor_id": {"$ne": None}
        }).sort("registration_time", -1))  # Most recent first
        
        if non_critical_assigned:
            victim_patient = non_critical_assigned[0]
            assigned_doctor = next((d for d in DOCTORS if d["id"] == victim_patient.get("assigned_doctor_id")), None)
            
            if assigned_doctor:
                # Unassign doctor from victim patient
                patients_collection.update_one(
                    {"patient_id": victim_patient["patient_id"]},
                    {"$set": {
                        "status": "WAITING",
                        "assigned_doctor": None,
                        "assigned_doctor_id": None,
                        "assigned_specialty": None,
                        "assigned_time": None
                    }}
                )
                unassigned_from = victim_patient.get("name", "Unknown")
                log_activity("DOCTOR_REASSIGNED", victim_patient["patient_id"], unassigned_from, 
                            f"{assigned_doctor['name']} reassigned to critical emergency patient {data.name}")
    
    # Create patient document with critical priority
    patient_doc = {
        "patient_id": patient_id,
        "name": data.name,
        "age": age,
        "gender": gender,
        "symptoms_text": symptoms,
        "arrival_time": now,
        "registration_time": now,
        "status": "ASSIGNED" if assigned_doctor else "WAITING",
        "triage_time": now,
        "assigned_time": now if assigned_doctor else None,
        "assigned_doctor": assigned_doctor["name"] if assigned_doctor else None,
        "assigned_doctor_id": assigned_doctor["id"] if assigned_doctor else None,
        "assigned_specialty": assigned_doctor["specialty"] if assigned_doctor else None,
        "treatment_start_time": None,
        "completed_time": None,
        "critical_priority": True,
        "critical_marked_at": now,
    }
    patients_collection.insert_one(patient_doc)
    
    # Create minimal vitals document (to be updated later)
    vitals_doc = {
        "patient_id": patient_id,
        "heart_rate": None,
        "blood_pressure": None,
        "temperature": None,
        "spo2": None,
        "respiratory_rate": None,
        "recorded_at": now,
    }
    vitals_collection.insert_one(vitals_doc)
    
    # Create Critical triage result immediately
    triage_doc = {
        "patient_id": patient_id,
        "ml_prediction": 0,  # Critical = 0 in model encoding
        "triage_level": "Critical",
        "confidence_score": 100.0,
        "llm_reasoning": "CRITICAL EMERGENCY - Patient registered via emergency intake. Immediate attention required.",
        "features_used": {},
        "shap_values": [],
        "doctor_override": None,
        "timestamp": now,
    }
    triage_results_collection.insert_one(triage_doc)
    
    # Log the critical emergency registration
    log_activity("CRITICAL_EMERGENCY", patient_id, data.name, 
                f"Critical emergency patient registered. Auto-assigned to: {assigned_doctor['name'] if assigned_doctor else 'No available doctor'}")
    
    response = {
        "status": "success",
        "patient_id": patient_id,
        "name": data.name,
        "triage_level": "Critical",
        "critical_priority": True,
        "registration_time": now.isoformat(),
        "message": "Critical emergency patient registered and escalated immediately"
    }
    
    if assigned_doctor:
        response["auto_assigned_doctor"] = assigned_doctor["name"]
        response["doctor_specialty"] = assigned_doctor["specialty"]
        if unassigned_from:
            response["unassigned_from"] = unassigned_from
    else:
        response["warning"] = "No doctor available for immediate assignment. Patient is at top of queue."
    
    return response


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

    # Log activity for dashboard
    log_activity("TRIAGE_COMPLETED", patient_id, patient["name"], 
                 f"Triage level: {ml_result['prediction']} ({ml_result['confidence']}% confidence)")

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
        t_level = t_res.get("triage_level", "Unknown") if t_res else "Unknown"
        t_conf = t_res.get("confidence_score", t_res.get("confidence", 0.0)) if t_res else 0.0

        waiting_minutes = (now - p["arrival_time"]).total_seconds() / 60.0
        triage_weight = triage_weights.get(t_level, 0)
        status_weight = status_weights.get(p.get("status", "Waiting"), 0)
        
        # Critical priority patients get a huge boost (1000 points)
        critical_boost = 1000 if p.get("critical_priority") else 0
        
        # Priority: critical boost + triage level * 10 + status weight * 5 + waiting time
        priority_score = critical_boost + (triage_weight * 10) + (status_weight * 5) + waiting_minutes

        queue.append({
            "patient_id": p["patient_id"],
            "name": p["name"],
            "age": p["age"],
            "gender": p["gender"],
            "triage_level": t_level,
            "confidence": t_conf,
            "status": p.get("status", "WAITING"),
            "critical_priority": p.get("critical_priority", False),
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
        # Handle both old and new field names for backwards compatibility
        result["triage"] = {
            "ml_prediction": t_res.get("ml_prediction", 0),
            "confidence_score": t_res.get("confidence_score", t_res.get("confidence", 0)),
            "llm_reasoning": t_res.get("llm_reasoning", t_res.get("explanation", "Assessment pending")),
            "triage_level": t_res.get("triage_level", "Unknown"),
            "doctor_override": t_res.get("doctor_override"),
            "timestamp": (t_res.get("timestamp") or t_res.get("triaged_at", datetime.utcnow())).isoformat() if isinstance(t_res.get("timestamp") or t_res.get("triaged_at"), datetime) else None,
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
    
    # Log activity
    log_activity("DOCTOR_ASSIGNED", data.patient_id, patient.get("name"), 
                 f"Assigned to {doctor['name']} ({doctor['specialty']})")
    
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
    
    # Log activity
    log_activity("TREATMENT_STARTED", data.patient_id, patient.get("name"), 
                 f"Treatment started with {patient.get('assigned_doctor', 'Unassigned')}")
    
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
    
    # Log activity
    log_activity("TREATMENT_COMPLETED", data.patient_id, patient.get("name"), 
                 f"Treatment completed by {patient.get('assigned_doctor', 'Unassigned')}")
    
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
    
    patient_name = patient.get("name", "Unknown")
    
    # Delete from patients collection
    patients_collection.delete_one({"patient_id": patient_id})
    
    # Delete associated triage results
    triage_results_collection.delete_one({"patient_id": patient_id})
    
    # Log the activity
    log_activity("PATIENT_DELETED", patient_id, patient_name, f"Patient record deleted")
    
    return {
        "status": "success",
        "message": f"Patient {patient_id} and associated records deleted successfully"
    }


@router.post("/mark-critical")
def mark_critical(request: Request, data: PatientIdRequest):
    """Marks a patient as critical priority - moves them to top of queue and auto-assigns doctor."""
    patient = patients_collection.find_one({"patient_id": data.patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    if patient.get("status") == "COMPLETED":
        raise HTTPException(
            status_code=400,
            detail="Cannot mark completed patients as critical"
        )
    
    now = datetime.utcnow()
    patient_name = patient.get("name", "Unknown")
    reassigned_doctor = None
    unassigned_from = None
    
    # If patient doesn't have a doctor, try to get one
    if not patient.get("assigned_doctor_id"):
        # First, try to find an available doctor
        assigned_doctor_ids = [p.get("assigned_doctor_id") for p in patients_collection.find(
            {"status": {"$in": ["ASSIGNED", "IN_TREATMENT"]}, "assigned_doctor_id": {"$ne": None}}
        ) if p.get("assigned_doctor_id")]
        
        available_doctors = [d for d in DOCTORS if d["id"] not in assigned_doctor_ids]
        
        if available_doctors:
            # Use first available doctor
            reassigned_doctor = available_doctors[0]
        else:
            # No available doctors - steal from a non-critical patient
            # Find patients who are ASSIGNED (not yet in treatment) and NOT critical
            non_critical_assigned = list(patients_collection.find({
                "status": "ASSIGNED",
                "critical_priority": {"$ne": True},
                "assigned_doctor_id": {"$ne": None}
            }).sort("registration_time", -1))  # Most recent first (least urgent)
            
            if non_critical_assigned:
                # Unassign the doctor from the least urgent patient
                victim_patient = non_critical_assigned[0]
                reassigned_doctor = next((d for d in DOCTORS if d["id"] == victim_patient.get("assigned_doctor_id")), None)
                
                if reassigned_doctor:
                    # Unassign doctor from victim patient
                    patients_collection.update_one(
                        {"patient_id": victim_patient["patient_id"]},
                        {"$set": {
                            "status": "WAITING",
                            "assigned_doctor": None,
                            "assigned_doctor_id": None,
                            "assigned_specialty": None,
                            "assigned_time": None
                        }}
                    )
                    unassigned_from = victim_patient.get("name", "Unknown")
                    log_activity("DOCTOR_REASSIGNED", victim_patient["patient_id"], unassigned_from, 
                                f"{reassigned_doctor['name']} reassigned to critical patient {patient_name}")
        
        # Assign doctor to critical patient if we found one
        if reassigned_doctor:
            patients_collection.update_one(
                {"patient_id": data.patient_id},
                {"$set": {
                    "critical_priority": True,
                    "critical_marked_at": now,
                    "status": "ASSIGNED",
                    "assigned_doctor": reassigned_doctor["name"],
                    "assigned_doctor_id": reassigned_doctor["id"],
                    "assigned_specialty": reassigned_doctor["specialty"],
                    "assigned_time": now
                }}
            )
            log_activity("DOCTOR_ASSIGNED", data.patient_id, patient_name, 
                        f"Critical patient auto-assigned to {reassigned_doctor['name']}")
        else:
            # No doctor available at all - just mark as critical
            patients_collection.update_one(
                {"patient_id": data.patient_id},
                {"$set": {
                    "critical_priority": True,
                    "critical_marked_at": now
                }}
            )
    else:
        # Patient already has a doctor - just mark as critical
        patients_collection.update_one(
            {"patient_id": data.patient_id},
            {"$set": {
                "critical_priority": True,
                "critical_marked_at": now
            }}
        )
    
    # Also update triage to Critical if not already
    triage_results_collection.update_one(
        {"patient_id": data.patient_id},
        {"$set": {"triage_level": "Critical", "doctor_override": "YES"}}
    )
    
    log_activity("MARKED_CRITICAL", data.patient_id, patient_name, "Patient marked as critical priority")
    
    response = {
        "status": "success",
        "patient_id": data.patient_id,
        "message": f"Patient marked as critical priority and moved to top of queue",
        "critical_at": now.isoformat()
    }
    
    if reassigned_doctor:
        response["auto_assigned_doctor"] = reassigned_doctor["name"]
        response["doctor_specialty"] = reassigned_doctor["specialty"]
        if unassigned_from:
            response["unassigned_from"] = unassigned_from
    
    return response


@router.get("/activity-logs")
def get_activity_logs(request: Request, limit: int = 50):
    """Returns recent activity logs for the admin dashboard."""
    logs = list(activity_logs_collection.find(
        {},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit))
    
    # Convert datetime objects to ISO strings
    for log in logs:
        if log.get("timestamp"):
            log["timestamp"] = log["timestamp"].isoformat()
    
    return {"logs": logs}


# ------- Patient Profile Endpoints -------

@router.get("/patient-profiles")
def get_patient_profiles(request: Request, search: str = ""):
    """Returns all saved patient profiles, optionally filtered by name search."""
    query = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    profiles = list(patient_profiles_collection.find(
        query,
        {"_id": 0}
    ).sort("name", 1))
    
    # Convert datetime to ISO strings
    for profile in profiles:
        if profile.get("created_at"):
            profile["created_at"] = profile["created_at"].isoformat()
        if profile.get("updated_at"):
            profile["updated_at"] = profile["updated_at"].isoformat()
        if profile.get("last_visit"):
            profile["last_visit"] = profile["last_visit"].isoformat()
    
    return {"profiles": profiles}


@router.get("/patient-profiles/{profile_id}")
def get_patient_profile(request: Request, profile_id: int):
    """Returns a specific patient profile by ID."""
    profile = patient_profiles_collection.find_one(
        {"profile_id": profile_id},
        {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    
    # Convert datetime to ISO strings
    if profile.get("created_at"):
        profile["created_at"] = profile["created_at"].isoformat()
    if profile.get("updated_at"):
        profile["updated_at"] = profile["updated_at"].isoformat()
    if profile.get("last_visit"):
        profile["last_visit"] = profile["last_visit"].isoformat()
    
    return profile


@router.post("/patient-profiles")
def create_patient_profile(request: Request, data: PatientProfileRequest):
    """Creates a new patient profile for returning patients."""
    now = datetime.utcnow()
    profile_id = get_next_profile_id()
    
    profile_doc = {
        "profile_id": profile_id,
        "name": data.name,
        "age": data.age,
        "gender": data.gender,
        "medical_history": data.medical_history,
        "notes": data.notes,
        "created_at": now,
        "updated_at": now,
        "last_visit": now,
        "visit_count": 0
    }
    
    patient_profiles_collection.insert_one(profile_doc)
    
    log_activity("PROFILE_CREATED", None, data.name, f"Patient profile created for {data.name}")
    
    return {
        "status": "success",
        "profile_id": profile_id,
        "message": f"Profile created for {data.name}"
    }


@router.put("/patient-profiles/{profile_id}")
def update_patient_profile(request: Request, profile_id: int, data: PatientProfileRequest):
    """Updates an existing patient profile."""
    profile = patient_profiles_collection.find_one({"profile_id": profile_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    
    now = datetime.utcnow()
    patient_profiles_collection.update_one(
        {"profile_id": profile_id},
        {"$set": {
            "name": data.name,
            "age": data.age,
            "gender": data.gender,
            "medical_history": data.medical_history,
            "notes": data.notes,
            "updated_at": now
        }}
    )
    
    log_activity("PROFILE_UPDATED", None, data.name, f"Patient profile updated")
    
    return {
        "status": "success",
        "profile_id": profile_id,
        "message": f"Profile updated for {data.name}"
    }


@router.delete("/patient-profiles/{profile_id}")
def delete_patient_profile(request: Request, profile_id: int):
    """Deletes a patient profile."""
    profile = patient_profiles_collection.find_one({"profile_id": profile_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    
    patient_name = profile.get("name", "Unknown")
    patient_profiles_collection.delete_one({"profile_id": profile_id})
    
    log_activity("PROFILE_DELETED", None, patient_name, f"Patient profile deleted")
    
    return {
        "status": "success",
        "message": f"Profile deleted for {patient_name}"
    }


@router.post("/patient-profiles/{profile_id}/record-visit")
def record_profile_visit(request: Request, profile_id: int):
    """Records a visit for the profile (increments visit count and updates last_visit)."""
    profile = patient_profiles_collection.find_one({"profile_id": profile_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    
    now = datetime.utcnow()
    patient_profiles_collection.update_one(
        {"profile_id": profile_id},
        {
            "$set": {"last_visit": now},
            "$inc": {"visit_count": 1}
        }
    )
    
    return {"status": "success", "message": "Visit recorded"}
