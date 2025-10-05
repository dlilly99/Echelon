import io
import time
import cv2
import numpy as np
import tensorflow.compat.v1 as tf
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import posenet
import os

# ---- FastAPI setup ----
app = FastAPI()

# Serve built React frontend
app.mount("/static", StaticFiles(directory="frontend/build/static"), name="static")

@app.get("/")
def serve_react():
    return FileResponse("frontend/build/index.html")

# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Globals ----
rep_count = 0
angle_value = 0.0
current_state = ["down"]

# ---- Detection / Rep logic thresholds ----
SCALE_FACTOR = 0.9
MIN_POSE_SCORE = 0.05
MIN_JOINT_CONF = 0.05
LOW_TH = 70.0
HIGH_TH = 140.0
EMA_ALPHA = 0.4
COOLDOWN_SEC = 0.5

# ---- TensorFlow / PoseNet ----
tf.disable_eager_execution()
sess = tf.Session()
print("[INIT] Loading PoseNet MobileNet 50...")
model_cfg, model_outputs = posenet.load_model(50, sess)
output_stride = model_cfg["output_stride"]

# Weak-frame tracking for model upgrade
low_conf_count = 0
low_conf_limit = 10  # upgrade after too many weak frames

def switch_to_resnet():
    """Upgrade to higher-accuracy PoseNet model."""
    global model_cfg, model_outputs, output_stride, sess
    print("\n⚙️ [MODEL UPGRADE] Switching to PoseNet ResNet-101 for higher accuracy...\n")
    sess.close()
    sess = tf.Session()
    model_cfg, model_outputs = posenet.load_model(101, sess)
    output_stride = model_cfg["output_stride"]

# ---- Helpers ----
def calculate_angle(a, b, c):
    """Calculate joint angle from three keypoints."""
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba, bc = a - b, c - b
    cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
    return np.degrees(np.arccos(np.clip(cosine, -1.0, 1.0)))

def preprocess_frame(frame, scale_factor, output_stride):
    """Resize, normalize, and prepare frame for PoseNet."""
    h, w = frame.shape[:2]
    target_w = int(w * scale_factor)
    target_h = int(h * scale_factor)
    img = cv2.resize(frame, (target_w, target_h))
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    img = np.expand_dims(img, axis=0)
    return img, frame.copy(), 1.0 / scale_factor

def _ensure_attrs():
    """Initialize persistent variables used for tracking."""
    if not hasattr(process_frame, "ema_angle"):
        process_frame.ema_angle = None
    if not hasattr(process_frame, "last_rep_time"):
        process_frame.last_rep_time = 0.0
    if not hasattr(process_frame, "state"):
        process_frame.state = "down"

# ---- Main endpoint ----
@app.post("/frame")
async def process_frame(file: UploadFile = File(...)):
    global rep_count, angle_value, low_conf_count
    _ensure_attrs()

    # ---- Read frame ----
    contents = await file.read()
    npimg = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    if frame is None:
        return JSONResponse({"count": rep_count, "angle": None, "status": "bad frame"})

    # ---- PoseNet inference ----
    input_image, _, output_scale = preprocess_frame(frame, SCALE_FACTOR, output_stride)
    heatmaps, offsets, disp_fwd, disp_bwd = sess.run(model_outputs, feed_dict={"image:0": input_image})

    pose_scores, keypoint_scores, keypoint_coords = posenet.decode_multi.decode_multiple_poses(
        heatmaps.squeeze(0),
        offsets.squeeze(0),
        disp_fwd.squeeze(0),
        disp_bwd.squeeze(0),
        output_stride=output_stride,
        max_pose_detections=1,
        min_pose_score=MIN_POSE_SCORE,
    )

    # ---- Guard: no detections ----
    if pose_scores is None or len(pose_scores) == 0:
        low_conf_count += 1
        if low_conf_count >= low_conf_limit:
            switch_to_resnet()
            low_conf_count = 0
        return JSONResponse({"count": rep_count, "angle": None, "status": "no person"})

    keypoint_coords *= output_scale
    pose_score = float(pose_scores[0])

    # ---- Debug info ----
    print(f"[DEBUG] pose_score={pose_score:.3f}")
    print(f"[DEBUG] left_arm_conf={keypoint_scores[0][5]:.2f}, {keypoint_scores[0][7]:.2f}, {keypoint_scores[0][9]:.2f}")
    print(f"[DEBUG] right_arm_conf={keypoint_scores[0][6]:.2f}, {keypoint_scores[0][8]:.2f}, {keypoint_scores[0][10]:.2f}")

    # ---- Handle weak detections ----
    if pose_score < MIN_POSE_SCORE:
        low_conf_count += 1
        if low_conf_count >= low_conf_limit:
            switch_to_resnet()
            low_conf_count = 0
        return JSONResponse({"count": rep_count, "angle": None, "status": "no person"})
    else:
        low_conf_count = 0

    # ---- Select stronger arm ----
    left_conf = np.sum(keypoint_scores[0][[5, 7, 9]])
    right_conf = np.sum(keypoint_scores[0][[6, 8, 10]])
    if right_conf >= left_conf:
        shoulder, elbow, wrist = keypoint_coords[0][6], keypoint_coords[0][8], keypoint_coords[0][10]
        arm = "right"
    else:
        shoulder, elbow, wrist = keypoint_coords[0][5], keypoint_coords[0][7], keypoint_coords[0][9]
        arm = "left"

    # ---- Check joint confidence ----
    if np.any(keypoint_scores[0][[5, 7, 9]] < MIN_JOINT_CONF) and np.any(keypoint_scores[0][[6, 8, 10]] < MIN_JOINT_CONF):
        return JSONResponse({"count": rep_count, "angle": None, "status": "low confidence"})

    # ---- Compute angle and smooth ----
    raw_angle = float(calculate_angle(shoulder, elbow, wrist))
    if process_frame.ema_angle is None:
        process_frame.ema_angle = raw_angle
    else:
        process_frame.ema_angle = EMA_ALPHA * raw_angle + (1 - EMA_ALPHA) * process_frame.ema_angle
    angle_smoothed = process_frame.ema_angle
    angle_value = angle_smoothed

    # ---- Rep counting ----
    now = time.time()

    if angle_smoothed > HIGH_TH:
        process_frame.state = "down"
    elif angle_smoothed < LOW_TH and process_frame.state == "down" and (now - process_frame.last_rep_time) > COOLDOWN_SEC:
        rep_count += 1
        process_frame.state = "up"
        process_frame.last_rep_time = now
        print(f"✅ REP COUNTED! total={rep_count}, arm={arm}, angle={angle_smoothed:.1f}")

    return JSONResponse({
        "count": rep_count,
        "angle": round(angle_smoothed, 1),
        "status": f"ok ({arm})"
    })

# ---- Quick check endpoint ----
@app.get("/count")
def get_count():
    return JSONResponse({"count": rep_count, "angle": angle_value})
