import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Feedback from "./Feedback.jsx";

const MeetingRedirect = () => {
  const [countdown, setCountdown] = useState(3);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isLoadingRedirect, setIsLoadingRedirect] = useState(false);
  const location = useLocation();

  // Get meeting data from location state or URL params
  const meetingData = location.state?.meetingData || {};
  const { redirectLink, meetingStatus, endReason, userRole, userType } = meetingData;
  
  // Debug logging
  console.log("🔄 MeetingRedirect received data:", meetingData);
  console.log("🔄 MeetingRedirect extracted values:", { redirectLink, meetingStatus, endReason, userRole, userType });

  useEffect(() => {
    // Only start countdown when we have a redirectLink (for hosts/mentors) or when we're sure we should show feedback
    const isHost = userRole === 1 || userRole === "1";
    const isMentor = userType === "mentor";
    
    // If user is host/mentor but no redirectLink yet, wait for it
    if ((isHost || isMentor) && !redirectLink) {
      console.log("⏳ Waiting for redirect link to be available...");
      setIsLoadingRedirect(true);
      return;
    }
    
    // If we have a redirectLink or user is not host/mentor, stop loading
    setIsLoadingRedirect(false);
    
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
  }, [redirectLink, userRole, userType]); // Re-run when redirectLink changes

  const handleRedirect = () => {
    // Check if user is host (role = 1 or "1") or mentor (userType = "mentor")
    const isHost = userRole === 1 || userRole === "1";
    const isMentor = userType === "mentor";
    
    console.log("🔄 handleRedirect called with:", { isHost, isMentor, userRole, userType, redirectLink });
    
    if ((isHost || isMentor) && redirectLink && redirectLink.trim() !== "") {
      // Redirect to external link for hosts/mentors
      console.log("🔄 Redirecting to external link:", redirectLink);
      window.location.href = redirectLink;
    } else {
      // Show feedback component for non-hosts/non-mentors
      console.log("🔄 Showing feedback component instead of redirect");
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
    const isHost = userRole === 1 || userRole === "1";
    const isMentor = userType === "mentor";
    
    if ((isHost || isMentor) && redirectLink && redirectLink.trim() !== "") {
      return redirectLink;
    }
    return "Feedback page";
  };

  return (
    <div className="meetingRedirectContainer">
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 0.6; }
            50% { opacity: 1; }
            100% { opacity: 0.6; }
          }
        `}
      </style>
      <div className="meetingRedirectBox">
        {/* Icon */}
        <div
          style={{
            fontSize: "64px",
            marginBottom: "24px",
            color: "#0E77D3",
          }}
        >
        </div>

        <div className="meetingEndedHost">
          <img src="/assest/svg/meetingEnded.svg" alt="" />
        </div>

        <h1
          style={{
            fontSize: "20px",
            marginBottom: "16px",
            color: "#101010",
            fontWeight: "600",
          }}
        >
          {getMessage()}
        </h1>

        {/* Countdown */}
        <div
          style={{
            fontSize: "14px",
            marginBottom: "24px",
            color: "#444",
          }}
        >
          {isLoadingRedirect ? (
            <>
              Loading redirect link...{" "}
              <span
                style={{
                  color: "#0E77D3",
                  fontWeight: "bold",
                  fontSize: "24px",
                }}
              >
                ⏳
              </span>
            </>
          ) : (
            <>
              Redirecting to {getRedirectDestination()} in{" "}
              <span
                style={{
                  color: "#0E77D3",
                  fontWeight: "bold",
                  fontSize: "24px",
                }}
              >
                {countdown}
              </span>{" "}
              seconds...
            </>
          )}
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
              width: isLoadingRedirect ? "100%" : `${((3 - countdown) / 3) * 100}%`,
              height: "100%",
              background: isLoadingRedirect ? "#FFA500" : "#0E77D3",
              transition: isLoadingRedirect ? "none" : "width 1s linear",
              animation: isLoadingRedirect ? "pulse 1.5s ease-in-out infinite" : "none",
            }}
          />
        </div>

        {/* Skip button */}
        <button
          onClick={handleRedirect}
          disabled={isLoadingRedirect}
          style={{
            background: "transparent",
            border: "2px solid #ABABAB",
            color: "#ABABAB",
            padding: "10px 20px",
            borderRadius: "6px",
            cursor: isLoadingRedirect ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: "600",
            lineHeight: "150%",
            transition: "all 0.2s ease",
            opacity: isLoadingRedirect ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isLoadingRedirect) {
              e.target.style.background = "#101010";
              e.target.style.color = "#fff";
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoadingRedirect) {
              e.target.style.background = "transparent";
              e.target.style.color = "#101010";
            }
          }}
        >
          {isLoadingRedirect ? "Loading..." : "Skip Countdown"}
        </button>

        {/* Additional info - only show for hosts/mentors */}
        {(() => {
          const isHost = userRole === 1 || userRole === "1";
          const isMentor = userType === "mentor";
          return (isHost || isMentor) && redirectLink && redirectLink.trim() !== "";
        })() && (
          <div
            style={{
              marginTop: "24px",
              padding: "16px",
              background: "rgba(0, 186, 255, 0.1)",
              borderRadius: "8px",
              border: "1px solid rgba(0, 186, 255, 0.3)",
            }}
          >
            <p style={{ margin: "0", fontSize: "14px", color: "#0E77D3", wordBreak: "break-all" , textAlign:"justify"}}>
              You will be redirected to: {redirectLink}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingRedirect;



























