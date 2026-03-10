import os
import google.generativeai as genai
from services.gemini_guardrail import validate_and_parse_json
from services.feature_validation import validate_symptoms
import logging

logger = logging.getLogger(__name__)

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY", "YOUR_API_KEY_PLACEHOLDER")
if api_key:
    genai.configure(api_key=api_key)

# Setup Model
model = genai.GenerativeModel('gemini-2.5-flash')

async def extract_symptoms_from_text(symptom_text: str, max_retries: int = 3) -> list:
    """
    Extracts structured symptoms from free-form text using Gemini.
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
    for attempt in range(max_retries):
        try:
            # generate_content_async is preferred for non-blocking
            response = await model.generate_content_async(prompt)
            data = validate_and_parse_json(response.text)
            
            valid_symptoms = validate_symptoms(data.get("symptoms", []))
            return valid_symptoms
        except Exception as e:
            logger.warning(f"Attempt {attempt + 1} failed extracting symptoms: {e}")
            
    logger.error("All retries failed for symptom extraction. Falling back to empty list.")
    return []

async def generate_explanation(patient_features: dict, triage_prediction: str, max_retries: int = 2) -> str:
    """
    Generates a concise medical explanation for the triage prediction.
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
    for attempt in range(max_retries):
        try:
            response = await model.generate_content_async(prompt)
            return response.text.strip()
        except Exception as e:
            logger.warning(f"Attempt {attempt + 1} failed generating explanation: {e}")
            
    return "Explanation generation failed due to an API error."
