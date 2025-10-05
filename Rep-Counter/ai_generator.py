import os
import google.generativeai as genai
import re

# This configuration will fail, which is what we want for now to trigger the fallback.
try:
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not found in environment variables.")
    
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-pro')
    print("[AI] Gemini Pro model initialized (will likely fail).")
except Exception as e:
    print(f"[AI] ERROR: Failed to initialize Gemini model: {e}")
    model = None

def parse_ai_response(raw_text: str):
    """Parses the raw text from the AI into a list of exercise dictionaries."""
    exercises = []
    # Regex to find all exercise blocks
    pattern = re.compile(r"\{\!Exercise#(\d+)\!(.*?)\!(.*?)\!(.*?)\!(.*?)\!(\d+)\!\}")
    matches = pattern.findall(raw_text)

    for match in matches:
        exercises.append({
            "index": int(match[0]),
            "name": match[1].strip(),
            "description": match[2].strip(),
            "equipment": match[3].strip(),
            "reps": match[4].strip(),
            "sets": int(match[5])
        })
    return exercises

def generate_workout_from_prompt(prompt: str):
    """
    Generates a workout plan from a text prompt.
    If the AI fails, it returns a hardcoded fallback workout.
    """
    prompt_template = f"""
    Generate a workout plan based on the user's request: "{prompt}".
    The output must be a single, unbroken string with no newlines.
    Each exercise must be in the format: {{!Exercise#index!Name!Description!Equipment!Reps!Sets!}}
    Example: {{!Exercise#1!Push-ups!Classic push-ups!Bodyweight!15!3!}}{{!Exercise#2!Squats!Go as low as you can!Bodyweight!20!3!}}
    """
    try:
        if not model:
            raise Exception("Gemini model is not initialized.")

        print(f"[AI] Sending prompt to Gemini for: '{prompt}'")
        response = model.generate_content(prompt_template)
        raw_text = response.text
        exercises = parse_ai_response(raw_text)
        
        if not exercises:
            raise Exception("Parsing failed or AI returned empty response.")
            
        return exercises, raw_text

    except Exception as e:
        print(f"[AI] ERROR: Failed to generate content from Gemini: {e}")
        # --- THIS IS THE FALLBACK LOGIC THAT RETURNS A DEFAULT WORKOUT ---
        print("[AI] Returning hardcoded fallback workout.")
        fallback_text = "{!Exercise#1!API Error Push-ups!Classic push-ups!Bodyweight!15!3!}"
        fallback_exercises = [{
            "index": 1,
            "name": "API Error Push-ups",
            "description": "Classic push-ups",
            "equipment": "Bodyweight",
            "reps": "15",
            "sets": 3
        }]
        return fallback_exercises, fallback_text
