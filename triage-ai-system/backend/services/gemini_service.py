import os
import re
import google.generativeai as genai
from services.gemini_guardrail import validate_and_parse_json
from services.feature_validation import validate_symptoms
import logging

logger = logging.getLogger(__name__)

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY", "YOUR_API_KEY_PLACEHOLDER")
if api_key:
    genai.configure(api_key=api_key)

# Setup Models with fallback options
MODELS = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash']
models = [genai.GenerativeModel(m) for m in MODELS]

# Symptom keyword mapping for fallback extraction
SYMPTOM_KEYWORDS = {
    "chest_pain": ["chest pain", "chest tightness", "chest discomfort", "crushing chest", "heart pain", "angina"],
    "shortness_of_breath": ["shortness of breath", "difficulty breathing", "breathless", "can't breathe", "breathing problem", "dyspnea", "sob"],
    "dizziness": ["dizzy", "dizziness", "lightheaded", "vertigo", "spinning", "faint"],
    "vomiting": ["vomiting", "vomit", "throwing up", "nausea", "nauseous", "sick to stomach"],
    "fever": ["fever", "high temperature", "febrile", "chills", "hot"],
    "headache": ["headache", "head pain", "migraine", "head hurts", "head ache"],
    "abdominal_pain": ["abdominal pain", "stomach pain", "belly pain", "stomach ache", "tummy pain", "cramping"],
    "fatigue": ["fatigue", "tired", "exhausted", "weakness", "weak", "no energy", "lethargic"],
    "loss_of_consciousness": ["unconscious", "fainted", "passed out", "blackout", "collapsed", "loss of consciousness", "unresponsive"]
}

def extract_symptoms_fallback(symptom_text: str) -> list:
    """Keyword-based symptom extraction fallback when LLM is unavailable."""
    text_lower = symptom_text.lower()
    found_symptoms = []
    for symptom, keywords in SYMPTOM_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text_lower:
                found_symptoms.append(symptom)
                break
    return list(set(found_symptoms))

async def call_with_fallback(prompt: str, max_retries: int = 2):
    """Try multiple models with fallback."""
    for model in models:
        for attempt in range(max_retries):
            try:
                response = await model.generate_content_async(prompt)
                return response.text
            except Exception as e:
                error_str = str(e).lower()
                if "429" in str(e) or "quota" in error_str or "rate" in error_str:
                    logger.warning(f"Rate limit hit on {model.model_name}, trying next model...")
                    break  # Try next model immediately
                logger.warning(f"Attempt {attempt + 1} with {model.model_name} failed: {e}")
    return None

async def extract_symptoms_from_text(symptom_text: str, max_retries: int = 3) -> list:
    """
    Extracts structured symptoms from free-form text using Gemini with fallback.
    """
    prompt = f"""
    Extract symptoms from the patient description.

    Rules:
    - Return JSON only
    - Use only allowed symptom vocabulary: ["chest_pain", "shortness_of_breath", "dizziness", "vomiting", "fever", "headache", "abdominal_pain", "fatigue", "loss_of_consciousness"]
    - Do not include explanations
    - Do not predict triage level
    - Do not generate medical advice
    - If no symptoms match, return {{"symptoms": []}}
    
    Patient description:
    {symptom_text}
    """
    
    response_text = await call_with_fallback(prompt, max_retries)
    if response_text:
        try:
            data = validate_and_parse_json(response_text)
            valid_symptoms = validate_symptoms(data.get("symptoms", []))
            if valid_symptoms:
                return valid_symptoms
        except Exception as e:
            logger.warning(f"Failed to parse LLM response: {e}")
    
    # Fallback to keyword extraction
    logger.info("Using keyword-based symptom extraction fallback")
    return extract_symptoms_fallback(symptom_text)

def generate_explanation_fallback(patient_features: dict, triage_prediction: str) -> str:
    """Generate a basic explanation when LLM is unavailable."""
    symptoms = patient_features.get("symptoms", [])
    age = patient_features.get("age", "unknown")
    
    symptom_text = ", ".join(s.replace("_", " ") for s in symptoms) if symptoms else "reported symptoms"
    
    explanations = {
        "Critical": f"Patient age {age} presents with {symptom_text}. These symptoms indicate a potentially life-threatening condition requiring immediate medical attention.",
        "Urgent": f"Patient age {age} presents with {symptom_text}. These symptoms suggest a serious condition requiring prompt evaluation.",
        "Moderate": f"Patient age {age} presents with {symptom_text}. Assessment indicates moderate priority for medical evaluation.",
        "Non Urgent": f"Patient age {age} presents with {symptom_text}. Symptoms suggest a non-urgent condition suitable for standard care pathway."
    }
    return explanations.get(triage_prediction, f"Patient presents with {symptom_text}. Priority: {triage_prediction}")

async def generate_explanation(patient_features: dict, triage_prediction: str, max_retries: int = 2) -> str:
    """
    Generates a concise medical explanation for the triage prediction with fallback.
    """
    prompt = f"""
    Generate a concise medical explanation.
    
    Inputs:
    patient_features: {patient_features}
    triage_prediction: {triage_prediction}
    
    Rules:
    - Explanation must be under 50 words
    - Do not provide diagnosis
    - Do not suggest treatments
    - Only describe risk factors based on inputs
    """
    
    response_text = await call_with_fallback(prompt, max_retries)
    if response_text:
        return response_text.strip()
    
    # Fallback explanation
    logger.info("Using fallback explanation generator")
    return generate_explanation_fallback(patient_features, triage_prediction)
