import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Feedback from "./Feedback.jsx";

const MeetingRedirect = () => {
  const [countdown, setCountdown] = useState(3);
  const [showFeedback, setShowFeedback] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Get meeting data from location state or URL params
  const meetingData = location.state?.meetingData || {};
  const { redirectLink, meetingStatus, endReason } = meetingData;

  useEffect(() => {
    // Start countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleRedirect = () => {
    if (redirectLink && redirectLink.trim() !== "") {
      // Redirect to external link
      window.location.href = redirectLink;
    } else {
      // Show feedback component
      setShowFeedback(true);
    }
  };

  // If showing feedback, render the Feedback component
  if (showFeedback) {
    return <Feedback />;
  }

  // Get appropriate message based on end reason
  const getMessage = () => {
    switch (endReason) {
      case "host_ended":
        return "Meeting ended by host";
      case "user_left":
        return "You left the meeting";
      case "meeting_completed":
        return "Meeting completed";
      case "timeout":
        return "Meeting timed out";
      default:
        return "Meeting ended";
    }
  };

  // Get redirect destination
  const getRedirectDestination = () => {
    if (redirectLink && redirectLink.trim() !== "") {
      return redirectLink;
    }
    return "Feedback page";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#232323",
        color: "#fff",
        textAlign: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#2d2d2d",
          padding: "40px",
          borderRadius: "16px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
          maxWidth: "500px",
          width: "100%",
        }}
      >
        {/* Icon */}
        <div
          style={{
            fontSize: "64px",
            marginBottom: "24px",
            color: "#00baff",
          }}
        >
          {endReason === "host_ended" ? "👋" : "🏁"}
        </div>

        {/* Message */}
        <h1
          style={{
            fontSize: "28px",
            marginBottom: "16px",
            color: "#fff",
            fontWeight: "600",
          }}
        >
          {getMessage()}
        </h1>

        {/* Countdown */}
        <div
          style={{
            fontSize: "18px",
            marginBottom: "24px",
            color: "#ccc",
          }}
        >
          Redirecting to {getRedirectDestination()} in{" "}
          <span
            style={{
              color: "#00baff",
              fontWeight: "bold",
              fontSize: "24px",
            }}
          >
            {countdown}
          </span>{" "}
          seconds...
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: "100%",
            height: "6px",
            background: "#444",
            borderRadius: "3px",
            overflow: "hidden",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: `${((3 - countdown) / 3) * 100}%`,
              height: "100%",
              background: "#00baff",
              transition: "width 1s linear",
            }}
          />
        </div>

        {/* Skip button */}
        <button
          onClick={handleRedirect}
          style={{
            background: "transparent",
            border: "2px solid #00baff",
            color: "#00baff",
            padding: "12px 24px",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "500",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.target.style.background = "#00baff";
            e.target.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.target.style.background = "transparent";
            e.target.style.color = "#00baff";
          }}
        >
          Skip Countdown
        </button>

        {/* Additional info */}
        {redirectLink && redirectLink.trim() !== "" && (
          <div
            style={{
              marginTop: "24px",
              padding: "16px",
              background: "rgba(0, 186, 255, 0.1)",
              borderRadius: "8px",
              border: "1px solid rgba(0, 186, 255, 0.3)",
            }}
          >
            <p style={{ margin: "0", fontSize: "14px", color: "#00baff" }}>
              You will be redirected to: {redirectLink}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingRedirect;




