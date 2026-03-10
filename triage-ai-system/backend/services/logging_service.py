import logging
import os
from datetime import datetime

# Setup explicit audit logger
audit_logger = logging.getLogger("triage_audit")
audit_logger.setLevel(logging.INFO)

os.makedirs("logs", exist_ok=True)
fh = logging.FileHandler("logs/triage_audit.log")
fh.setLevel(logging.INFO)

formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
fh.setFormatter(formatter)
audit_logger.addHandler(fh)

def log_triage_decision(patient_id: int, input_symptoms: list, ml_prediction: str, confidence: float, llm_reasoning: str):
    """Logs the final decision from the AI triage pipeline."""
    audit_logger.info(f"TRIAGE_DECISION | Patient: {patient_id} | ML: {ml_prediction} ({confidence}%) | Symptoms: {input_symptoms} | Reason: {llm_reasoning}")

def log_doctor_override(patient_id: int, old_triage: str, new_triage: str, reason: str):
    """Logs when a doctor overrides the AI's triage decision."""
    audit_logger.warning(f"DOCTOR_OVERRIDE | Patient: {patient_id} | Changed from {old_triage} to {new_triage} | Reason: {reason}")
