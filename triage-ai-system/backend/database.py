from pymongo import MongoClient
import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "pulsepriority_triage")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

# Collections
patients_collection = db["patients"]
vitals_collection = db["vitals"]
triage_results_collection = db["triage_results"]

# Create indexes for fast lookups
patients_collection.create_index("patient_id", unique=True)
vitals_collection.create_index("patient_id")
triage_results_collection.create_index("patient_id")

def get_next_patient_id():
    """Auto-increment patient_id using a counters collection."""
    counter = db["counters"].find_one_and_update(
        {"_id": "patient_id"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return counter["seq"]
