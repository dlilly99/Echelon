import os
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from typing import List, Optional
import datetime
import base64
import numpy as np
import cv2
import google.generativeai as genai
import json
import re

# Local imports
from database import get_all_workouts, create_workout
import posenet

app = FastAPI()

# Global model variable
model = None

# Configure the Gemini API key
try:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
except KeyError:
    print("[ERROR] GEMINI_API_KEY environment variable not set.")
    # You might want to exit or handle this more gracefully
    # For now, the app will fail at runtime if the key is needed.

@app.on_event("startup")
async def startup_event():
    """Loads the PoseNet model on application startup."""
    print("[INIT] Loading PoseNet MobileNet 50...")
    global model
    model = posenet.load_model(101)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def parse_ai_response(text: str) -> List[dict]:
    """Parses the AI's text response to extract exercises into a structured list."""
    try:
        # Attempt to find a JSON block in the response
        json_match = re.search(r"```json\n([\s\S]*?)\n```", text)
        if json_match:
            json_str = json_match.group(1)
            # The AI might output a string that is a JSON representation of a list
            # e.g., '"[{\\"name\\": \\"Push-ups\\", ...}]"'
            # Or it might just be the list itself.
            # json.loads can handle both cases.
            loaded_json = json.loads(json_str)
            if isinstance(loaded_json, str):
                 # If it's a string, parse it again
                return json.loads(loaded_json)
            return loaded_json
        else:
            # Fallback for plain text if no JSON block is found (less reliable)
            print("[PARSER] No JSON block found, attempting plain text parsing.")
            exercises = []
            # Simple parsing logic, can be improved
            for line in text.split('\n'):
                if '. ' in line:
                    parts = line.split('. ', 1)
                    if len(parts) > 1 and parts[0].isdigit():
                        exercises.append({"name": parts[1], "reps": "10", "sets": 3}) # Dummy values
            return exercises
    except (json.JSONDecodeError, TypeError) as e:
        print(f"[PARSER ERROR] Failed to parse AI response: {e}")
        print(f"[PARSER ERROR] Raw text was: {text}")
        return [] # Return empty list on failure

@app.post("/api/generate-and-save")
async def generate_and_save(data: dict = Body(...)):
    """Generates a workout using an AI model, saves it, and returns it."""
    prompt = data.get("prompt", "Give me a good workout")
    user_id = data.get("userId", "anon")

    print(f"[API] Generating workout for prompt: '{prompt}'")

    try:
        model = genai.GenerativeModel('gemini-pro')
        
        # A more specific prompt to guide the AI towards a JSON output
        full_prompt = f"""
        Based on the user's request: "{prompt}", generate a list of 6 exercises.
        Return the response as a single JSON object enclosed in ```json ... ```.
        The JSON object should be a list of dictionaries. Each dictionary must contain these keys: 'index', 'name', 'description', 'equipment', 'reps', 'sets'.
        Example format:
        ```json
        [
            {{"index": 1, "name": "Push-ups", "description": "Standard push-ups", "equipment": "Bodyweight", "reps": "15", "sets": 3}},
            {{"index": 2, "name": "Squats", "description": "Bodyweight squats", "equipment": "Bodyweight", "reps": "20", "sets": 3}}
        ]
        ```
        """
        
        response = await model.generate_content_async(full_prompt)
        raw_text = response.text
        
        print(f"[AI RESPONSE] Raw text received:\n{raw_text}")

        exercises = parse_ai_response(raw_text)

        if not exercises:
            raise HTTPException(status_code=500, detail="Failed to parse workout from AI response.")

        workout_data = {
            "userId": user_id,
            "prompt": prompt,
            "rawText": raw_text,
            "exercises": exercises,
            "createdAt": datetime.datetime.utcnow(),
            "updatedAt": datetime.datetime.utcnow(),
        }

        workout_id = create_workout(workout_data)
        
        response_data = workout_data.copy()
        response_data["_id"] = str(workout_id)
        response_data["createdAt"] = response_data["createdAt"].isoformat()
        response_data["updatedAt"] = response_data["updatedAt"].isoformat()

        return response_data

    except Exception as e:
        print(f"[API ERROR] Failed to generate or save workout: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/workouts", response_model=List[dict])
async def list_workouts(userId: Optional[str] = "anon"):
    workouts = get_all_workouts(userId)
    return workouts

@app.post("/frame")
async def process_frame(data: dict = Body(...)):
    """Receives a video frame, estimates pose, and returns keypoints."""
    image_data = data.get("image")
    if not image_data:
        raise HTTPException(status_code=400, detail="No image data provided.")

    # Use the global model to estimate pose
    pose_scores, keypoint_scores, keypoint_coords = model(image_data)
    keypoints = keypoint_coords[0]  # Get first pose
    return {"keypoints": keypoints}