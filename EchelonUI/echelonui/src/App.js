import React, { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";

function App() {
  const webcamRef = useRef(null);
  const [count, setCount] = useState(0);
  const [angle, setAngle] = useState(0);
  const [status, setStatus] = useState("idle");
  const [lastCount, setLastCount] = useState(0);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let isSending = false;

    const interval = setInterval(async () => {
      if (isSending || !webcamRef.current) return;
      isSending = true;

      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        const blob = await fetch(imageSrc).then((res) => res.blob());
        const formData = new FormData();
        formData.append("file", blob, "frame.jpg");

        try {
          const res = await fetch("http://localhost:8000/frame", {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const data = await res.json();
            setAngle(data.angle ? data.angle.toFixed(1) : 0);
            setStatus(data.status || "ok");

            // Flash green when a rep is counted
            if (data.count > lastCount) {
              setFlash(true);
              setTimeout(() => setFlash(false), 250);
              setLastCount(data.count);
            }

            setCount(data.count);
          } else {
            setStatus("error");
          }
        } catch (err) {
          console.error("Error sending frame:", err);
          setStatus("error");
        } finally {
          isSending = false;
        }
      } else {
        isSending = false;
      }
    }, 100); // ~10 FPS

    return () => clearInterval(interval);
  }, [lastCount]);

  // ---- Status color mapping ----
  const getStatusColor = () => {
    if (status.includes("no person")) return "gold";
    if (status.includes("low_conf")) return "red";
    if (status.includes("error")) return "gray";
    return "limegreen"; // "ok" or "ok (left/right)"
  };

  return (
    <div style={{ textAlign: "center", padding: "2rem", backgroundColor: "#111", color: "white", minHeight: "100vh" }}>
      <h1>💪 Rep Counter</h1>

      <Webcam
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        width={640}
        height={480}
        videoConstraints={{
          width: 320,
          height: 240,
          facingMode: "user",
        }}
        style={{ borderRadius: "12px", boxShadow: "0 0 12px rgba(0,0,0,0.6)" }}
      />

      <h2
        style={{
          color: flash ? "limegreen" : "white",
          transition: "color 0.2s ease",
          marginTop: "1rem",
        }}
      >
        Reps: {count}
      </h2>

      <h3>Arm Angle: {angle}°</h3>

      <div
        style={{
          margin: "1rem auto",
          width: "12px",
          height: "12px",
          borderRadius: "50%",
          backgroundColor: getStatusColor(),
          boxShadow: `0 0 12px ${getStatusColor()}`,
        }}
      ></div>

      <p style={{ color: "#ccc" }}>
        {status === "idle"
          ? "Initializing camera..."
          : status.includes("no person")
          ? "🟡 No person detected"
          : status.includes("low_conf")
          ? "🔴 Low confidence — move closer to the camera"
          : "🟢 Tracking active"}
      </p>
    </div>
  );
}

export default App;
