import React from "react";
import { Link } from "react-router-dom";

function Home() {
  return (
    <div
      style={{
        textAlign: "center",
        backgroundColor: "#111",
        color: "white",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <h1>🏠 Welcome to Echelon</h1>
      <p>Your intelligent workout assistant</p>

      <Link to="/tracker">
        <button
          style={{
            backgroundColor: "limegreen",
            color: "#111",
            fontWeight: "bold",
            fontSize: "1.2rem",
            padding: "1rem 2rem",
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            marginTop: "1rem",
          }}
        >
          Start Rep Counter 💪
        </button>
      </Link>
    </div>
  );
}

export default Home;
