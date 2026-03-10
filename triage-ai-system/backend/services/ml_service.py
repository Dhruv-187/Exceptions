import os
import pickle
import numpy as np
from services.explainability_service import generate_patient_shap_values
import logging

logger = logging.getLogger(__name__)

# Map integers to text triage levels
TRIAGE_LEVELS = {
    0: "Non Urgent",
    1: "Moderate",
    2: "Urgent",
    3: "Critical"
}

FEATURE_NAMES = [
    'age', 'gender_encoded', 'heart_rate', 'blood_pressure_systolic', 'blood_pressure_diastolic',
    'respiratory_rate', 'oxygen_saturation', 'temperature', 'chest_pain', 'shortness_of_breath',
    'dizziness', 'vomiting', 'fever', 'headache', 'abdominal_pain', 'fatigue', 'loss_of_consciousness',
    'hypertension', 'diabetes', 'cardiac_history', 'asthma'
]

# Load model globally on startup to prevent latency
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'ml_model', 'triage_model.pkl')
_model = None

def load_model():
    global _model
    if _model is None:
        try:
            with open(MODEL_PATH, 'rb') as f:
                _model = pickle.load(f)
        except Exception as e:
            logger.warning(f"Model not found at {MODEL_PATH}. Prediction service will gracefully fallback. Error: {e}")

def predict_triage(feature_vector: list) -> dict:
    """
    Expects a single feature vector matching the model's training schema.
    Returns the predicted label string, confidence score, and top SHAP explanations.
    """
    global _model
    if _model is None:
        load_model()
        if _model is None:
            # Fallback if model doesn't exist yet
            return {
                "prediction_raw": 0, 
                "prediction": "Non Urgent", 
                "confidence": 0.0,
                "explanations": []
            }
            
    try:
        features = np.array(feature_vector).reshape(1, -1)
        
        pred_class = int(_model.predict(features)[0])
        probabilities = _model.predict_proba(features)[0]
        confidence = float(max(probabilities))
        
        # Generate explainability (SHAP)
        explanations = generate_patient_shap_values(_model, feature_vector, FEATURE_NAMES)
        
        return {
            "prediction_raw": pred_class,
            "prediction": TRIAGE_LEVELS.get(pred_class, "Unknown"),
            "confidence": round(confidence * 100, 2), # percentage
            "explanations": explanations
        }
    except Exception as e:
        logger.error(f"Error during ML prediction: {e}")
        return {
                "prediction_raw": 0, 
                "prediction": "Error", 
                "confidence": 0.0,
                "explanations": []
            }
