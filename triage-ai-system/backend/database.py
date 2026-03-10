from pymongo import MongoClient, DESCENDING
from datetime import datetime
import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "pulsepriority_triage")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

# Collections
patients_collection = db["patients"]
vitals_collection = db["vitals"]
triage_results_collection = db["triage_results"]
activity_logs_collection = db["activity_logs"]
patient_profiles_collection = db["patient_profiles"]

# Create indexes for fast lookups
patients_collection.create_index("patient_id", unique=True)
vitals_collection.create_index("patient_id")
triage_results_collection.create_index("patient_id")
activity_logs_collection.create_index([("timestamp", DESCENDING)])
patient_profiles_collection.create_index("profile_id", unique=True)
patient_profiles_collection.create_index([("name", 1)])  # For searching by name

def get_next_profile_id():
    """Auto-increment profile_id using a counters collection."""
    counter = db["counters"].find_one_and_update(
        {"_id": "profile_id"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return counter["seq"]

def get_next_patient_id():
    """Auto-increment patient_id using a counters collection."""
    counter = db["counters"].find_one_and_update(
        {"_id": "patient_id"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return counter["seq"]

def log_activity(action: str, patient_id: int = None, patient_name: str = None, details: str = "", extra_data: dict = None):
    """Logs an activity to the activity_logs collection."""
    log_entry = {
        "timestamp": datetime.utcnow(),
        "action": action,
        "patient_id": patient_id,
        "patient_name": patient_name,
        "details": details,
        "extra_data": extra_data or {}
    }
    activity_logs_collection.insert_one(log_entry)
