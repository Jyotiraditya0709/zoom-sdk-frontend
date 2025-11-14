import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import config from "../../config/config";

const MeetingExit = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // Try to get info from location.state or fallback to URL params
  const params = new URLSearchParams(location.search);
  const meetingId = location.state?.meetingId || params.get("meetingId");
  const userId = location.state?.userId || params.get("userId");
  const role = location.state?.role || params.get("role") || "0"; // 1=host, 0=attendee

  const isHost = role === "1" || role === 1;

  const handleEndOrLeave = async () => {
    try {
      console.log("🏁 Meeting exit action:", {
        isHost,
        meetingId,
        userId,
        role,
        action: isHost ? "end meeting" : "leave meeting",
      });

      // Make API call to update backend
      const endpoint = isHost
        ? config.API_ENDPOINTS.MEETING_END
        : config.API_ENDPOINTS.USER_LEFT;

      const requestBody = {
        meetingId,
        userId,
        ...(isHost && {
          userType: "mentor",
          role: "1",
          isMentor: true,
          isHost: true,
          mentorId: userId,
        }),
        ...(!isHost && {
          userType: "mentee",
          role: "0",
          isMentor: false,
          isHost: false,
          menteeId: userId,
        }),
      };

      console.log("📡 Making API call to:", endpoint);
      console.log("📡 Request body:", requestBody);

      const response = await fetch(config.getApiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Backend Error Response:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });

        // Even if API fails, navigate to feedback
        console.warn("⚠️ API call failed, but continuing with navigation");
      } else {
        const data = await response.json();
        console.log("✅ Backend updated successfully:", data);
      }

      // Navigate to feedback page
      navigate("/feedback");
    } catch (err) {
      console.error("❌ Error in handleEndOrLeave:", err);
      // Navigate anyway even if there's an error
      navigate("/feedback");
    }
  };

  const handleRejoin = () => {
    // Clear any preventAutoRejoin flag since user is intentionally rejoining
    sessionStorage.removeItem("preventAutoRejoin");

    // Prefer the UUID saved by meeting pages during unload
    let effectiveUserId = userId;
    try {
      const stored = sessionStorage.getItem("meetingExitInfo");
      console.log("🔍 MeetingExit - sessionStorage.meetingExitInfo:", stored);
      if (stored) {
        const info = JSON.parse(stored);
        console.log("🔍 MeetingExit - parsed info:", info);
        if (info && info.userId) {
          effectiveUserId = info.userId; // this should be the actual UUID
          console.log("🔍 MeetingExit - using UUID from sessionStorage:", effectiveUserId);
        }
        // Remove sessionStorage after using it
        sessionStorage.removeItem("meetingExitInfo");
      }
    } catch (err) {
      console.error("🔍 MeetingExit - error parsing sessionStorage:", err);
    }

    console.log("🔍 MeetingExit - final userId for rejoin:", effectiveUserId);
    console.log("🔍 MeetingExit - original userId from props:", userId);

    // Go to pre-join page with UUID
    navigate(
      `/pre-join?meetingId=${encodeURIComponent(
        meetingId
      )}&userId=${encodeURIComponent(effectiveUserId)}&role=${role}`
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8f9fa",
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 32,
          borderRadius: 12,
          boxShadow: "0 2px 16px #0002",
          maxWidth: 500,
          textAlign: "center",
        }}
      >
        <h2 style={{ marginBottom: 18 }}>
          {isHost
            ? "Do you want to end this meeting for everyone?"
            : "Do you want to leave this meeting?"}
        </h2>
        {isHost && (
          <div
            style={{
              background: "#fff3cd",
              border: "1px solid #fcd34d",
              color: "#92400e",
              borderRadius: 12,
              padding: "12px 16px",
              marginTop: 16,
              textAlign: "left",
              display: "flex",
              gap: 12,
            }}
          >
            <span role="img" aria-label="warning" style={{ fontSize: 20 }}>
              ⚠️
            </span>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              <strong>Warning:</strong> If you end this meeting, it will be marked as completed in the
              system. You and all participants will no longer be able to rejoin using this link.
            </div>
          </div>
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginTop: isHost ? 24 : 24,
          }}
        >
          <button
            onClick={handleEndOrLeave}
            style={{
              background: isHost ? "#e53935" : "#e53935",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "12px 0",
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            {isHost
              ? "Yes, I want to end this meeting"
              : "I want to leave this meeting"}
          </button>
          <button
            onClick={handleRejoin}
            style={{
              background: "#fff",
              color: "#1976f6",
              border: "1px solid #1976f6",
              borderRadius: 8,
              padding: "12px 0",
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            No, I want to Rejoin
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingExit;
