import React, { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import axios from "axios";

function RepCounter() {
  const webcamRef = useRef(null);
  const [count, setCount] = useState(0);
  const [angle, setAngle] = useState(null);
  const [status, setStatus] = useState("Waiting for frames...");
  const [isSending, setIsSending] = useState(false);

  // Capture and send frames continuously
  useEffect(() => {
    const interval = setInterval(() => {
      sendFrame();
    }, 500); // every 500 ms (2 frames per second)

    return () => clearInterval(interval);
  }, []);

  const sendFrame = async () => {
    if (!webcamRef.current || isSending) return;

    setIsSending(true);
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        setStatus("No webcam frame captured");
        setIsSending(false);
        return;
      }

      const blob = await fetch(imageSrc).then((res) => res.blob());
      const formData = new FormData();
      formData.append("file", blob, "frame.jpg");

      const res = await axios.post("/frame", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setCount(res.data.count);
      setAngle(res.data.angle ? res.data.angle.toFixed(2) : "–");
      setStatus(res.data.status || "Tracking...");
    } catch (error) {
      console.error("Error sending frame:", error);
      setStatus("Error connecting to backend");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      style={{
        textAlign: "center",
        background: "#0d1117",
        color: "#fff",
        minHeight: "100vh",
        padding: "2rem",
      }}
    >
      <h1 style={{ color: "#58a6ff" }}>🏋️‍♂️ Rep Counter</h1>
      <Webcam
        ref={webcamRef}
        audio={false}
        mirrored={true}
        screenshotFormat="image/jpeg"
        width={480}
        videoConstraints={{ width: 480, height: 360 }}
      />
      <div style={{ marginTop: "1rem", fontSize: "1.2rem" }}>
        <p>💪 Reps Counted: <strong>{count}</strong></p>
        <p>🦾 Elbow Angle: <strong>{angle}°</strong></p>
        <p>{status}</p>
      </div>
    </div>
  );
}

export default RepCounter;
