import os
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load environment variables from .env file in the current directory
load_dotenv()

# --- Connection ---
# Read the MONGO_URI from the loaded environment variables
MONGO_URI = os.getenv("MONGODB_URI")
if not MONGO_URI:
    raise RuntimeError("MONGODB_URI not found. Make sure you have a .env file in the Rep-Counter directory.")

client = MongoClient(MONGO_URI)
# get_database() will use the database specified in the URI ('workouts_db')
db = client.get_database() 
workouts_collection = db.workouts

print("[DB] Successfully connected to MongoDB Atlas.")

# --- Helper Functions ---
def to_json(data):
    """Converts MongoDB document to a JSON-serializable format."""
    if data is None:
        return None
    
    # Convert ObjectId and datetime objects to strings
    for key, value in data.items():
        if isinstance(value, ObjectId):
            data[key] = str(value)
        elif isinstance(value, datetime):
            data[key] = value.isoformat()
            
    return data

# --- CRUD Operations ---
def create_workout(workout_data: dict):
    """Saves a new workout to the database."""
    workout_data['createdAt'] = datetime.now(timezone.utc)
    workout_data['updatedAt'] = datetime.now(timezone.utc)
    result = workouts_collection.insert_one(workout_data)
    new_workout = workouts_collection.find_one({"_id": result.inserted_id})
    print(f"[DB] Saved workout with ID: {result.inserted_id}")
    return to_json(new_workout)

def get_all_workouts(userId: str = "anon"):
    """Fetches all workouts for a user, sorted by most recent."""
    workouts = workouts_collection.find({"userId": userId}).sort("createdAt", -1)
    print(f"[DB] Fetched workouts for user: {userId}")
    return [to_json(workout) for workout in workouts]