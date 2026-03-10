import json

ALLOWED_SYMPTOMS = [
    "chest_pain",
    "shortness_of_breath",
    "dizziness",
    "vomiting",
    "fever",
    "headache",
    "abdominal_pain",
    "fatigue",
    "loss_of_consciousness"
]

def validate_symptoms(extracted_symptoms: list) -> list:
    """
    Validates that returned symptoms are strictly within the ALLOWED_SYMPTOMS list.
    """
    valid_symptoms = []
    for symptom in extracted_symptoms:
        clean_symptom = symptom.strip().lower()
        if clean_symptom in ALLOWED_SYMPTOMS:
            valid_symptoms.append(clean_symptom)
    return valid_symptoms

def construct_feature_vector(patient_data: dict, validated_symptoms: list) -> list:
    """
    Constructs the exact list format expected by the ML model.
    Handles missing vitals by substituting safe defaults and creates binary flags for symptoms.
    Expected feature order by model:
    ['age', 'gender_encoded', 'heart_rate', 'blood_pressure_systolic', 'blood_pressure_diastolic',
     'respiratory_rate', 'oxygen_saturation', 'temperature', 'chest_pain', 'shortness_of_breath',
     'dizziness', 'vomiting', 'fever', 'headache', 'abdominal_pain', 'fatigue', 'loss_of_consciousness',
     'hypertension', 'diabetes', 'cardiac_history', 'asthma']
    """
    features = {}
    
    # Defaults/Missing value handling
    features['age'] = int(patient_data.get('age', 45))
    features['gender_encoded'] = 1 if str(patient_data.get('gender', '')).lower() in ['f', 'female'] else 0
    
    features['heart_rate'] = float(patient_data.get('heart_rate') or 80.0)
    
    bp = str(patient_data.get('blood_pressure', '120/80'))
    if '/' in bp:
        try:
            sys_bp, dia_bp = bp.split('/')
            features['blood_pressure_systolic'] = float(sys_bp)
            features['blood_pressure_diastolic'] = float(dia_bp)
        except:
            features['blood_pressure_systolic'] = 120.0
            features['blood_pressure_diastolic'] = 80.0
    else:
        features['blood_pressure_systolic'] = 120.0
        features['blood_pressure_diastolic'] = 80.0

    features['respiratory_rate'] = float(patient_data.get('respiratory_rate') or 16.0)
    features['oxygen_saturation'] = float(patient_data.get('spo2') or 98.0)
    features['temperature'] = float(patient_data.get('temperature') or 37.0)
    
    # Binary Flags for Symptoms
    for sym in ALLOWED_SYMPTOMS:
        features[sym] = 1 if sym in validated_symptoms else 0

    # Medical History Flags
    med_history = patient_data.get('medical_history', [])
    if isinstance(med_history, str):
        med_history = [m.strip().lower() for m in med_history.split(',')]
    else:
        med_history = [str(m).lower() for m in med_history]
        
    features['hypertension'] = 1 if any('hypertension' in m for m in med_history) else 0
    features['diabetes'] = 1 if any('diabetes' in m for m in med_history) else 0
    features['cardiac_history'] = 1 if any('cardiac' in m for m in med_history) else 0
    features['asthma'] = 1 if any('asthma' in m for m in med_history) else 0

    # Ordered Feature Array for ML
    feature_order = [
        'age', 'gender_encoded', 'heart_rate', 'blood_pressure_systolic', 'blood_pressure_diastolic',
        'respiratory_rate', 'oxygen_saturation', 'temperature', 'chest_pain', 'shortness_of_breath',
        'dizziness', 'vomiting', 'fever', 'headache', 'abdominal_pain', 'fatigue', 'loss_of_consciousness',
        'hypertension', 'diabetes', 'cardiac_history', 'asthma'
    ]
    
    return [features[f] for f in feature_order]
