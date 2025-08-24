import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import config from "../../config/config.js";

const MeetingValidator = () => {
  const { meetingId, userId } = useParams();
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = useState(true);
  const [meetingData, setMeetingData] = useState(null);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null); // 'not_found', 'expired', 'unauthorized', 'other'

  useEffect(() => {
    const validateMeeting = async () => {
      try {
        console.log("🔍 Validating meeting:", meetingId, "for user:", userId);

        const response = await axios.get(
          config.getApiUrl(
            `${config.API_ENDPOINTS.GET_MEETING_INFO}/${meetingId}/${userId}`
          )
        );

        if (response.data.IsSuccess) {
          console.log("✅ Meeting validated successfully");
          setMeetingData(response.data.Data);
          setIsValidating(false);
        } else {
          console.log("❌ Meeting validation failed:", response.data.Message);
          setError(response.data.Message);
          setIsValidating(false);
        }
      } catch (err) {
        console.error("❌ Error validating meeting:", err);

        // Determine error type based on response status
        if (err.response) {
          if (err.response.status === 410) {
            setErrorType("expired");
            setError("Meeting time has passed");
          } else if (err.response.status === 404) {
            setErrorType("not_found");
            setError("Meeting not found");
          } else if (err.response.status === 403) {
            setErrorType("unauthorized");
            setError("You are not authorized for this meeting");
          } else {
            setErrorType("other");
            setError(
              err.response.data?.Message || "Failed to validate meeting"
            );
          }
        } else {
          setErrorType("other");
          setError("Failed to validate meeting");
        }
        setIsValidating(false);
      }
    };

    if (meetingId && userId) {
      validateMeeting();
    }
  }, [meetingId, userId]);

  if (isValidating) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "18px",
        }}
      >
        🔍 Validating meeting...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <h2>
          {errorType === "expired"
            ? "⏰ Meeting Time Has Passed"
            : errorType === "not_found"
              ? "❌ Meeting Not Found"
              : errorType === "unauthorized"
                ? "🚫 Access Denied"
                : "❌ Error"}
        </h2>
        <p>{error}</p>
        {errorType === "expired" && (
          <p style={{ color: "#666", fontSize: "14px" }}>
            This meeting has ended. Please contact the meeting organizer for
            more information.
          </p>
        )}
        <button onClick={() => navigate("/")}>Go Back</button>
      </div>
    );
  }

  if (meetingData) {
    // Check if meeting is already completed
    if (meetingData.meetingStatus === "completed" || meetingData.isCompleted) {
      return (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <h2>🏁 Meeting is already completed</h2>
          <div>
            <p>
              <strong>Meeting ID:</strong> {meetingData.meetingId}
            </p>
            <p>
              <strong>Agenda:</strong> {meetingData.agenda}
            </p>
            <p>
              <strong>Status:</strong> {meetingData.meetingStatus}
            </p>
          </div>
          <button onClick={() => navigate("/")}>Go Back</button>
        </div>
      );
    }

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <h2>✅ Meeting Validated!</h2>
        <div>
          <p>
            <strong>Meeting ID:</strong> {meetingData.meetingId}
          </p>
          <p>
            <strong>Agenda:</strong> {meetingData.agenda}
          </p>
          <p>
            <strong>Status:</strong> {meetingData.meetingStatus}
          </p>
        </div>
        <button
          onClick={() => {
            // Determine if user is mentor or mentee
            const isMentor = meetingData.mentorId === userId;
            const userType = isMentor ? "mentor" : "mentee";
            const role = isMentor ? "1" : "0"; // 1 = host, 0 = attendee

            console.log("🔍 User type determined:", {
              userId,
              userType,
              role,
              mentorId: meetingData.mentorId,
              menteeId: meetingData.menteeId,
            });

            navigate(
              `/pre-join?meetingId=${meetingId}&userId=${userId}&agenda=${encodeURIComponent(
                meetingData.agenda || ""
              )}&status=${encodeURIComponent(
                meetingData.meetingStatus || ""
              )}&userType=${userType}&role=${role}`
            );
          }}
        >
          Continue to Pre-Join
        </button>
      </div>
    );
  }

  return null;
};

export default MeetingValidator;
