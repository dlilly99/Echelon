# ---- Base Image ----
FROM tensorflow/tensorflow:2.12.0-gpu  
WORKDIR /app

# ---- Install system dependencies ----
RUN apt-get update && apt-get install -y \
    python3-opencv \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# ---- Copy project files ----
COPY . .

# ---- Install Python dependencies ----
RUN pip install --upgrade pip setuptools wheel \
    && if [ -f requirements.txt ]; then pip install -r requirements.txt; fi \
    && pip install fastapi uvicorn python-multipart

# ---- Default port ----
EXPOSE 8000

# ---- Run FastAPI ----
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
