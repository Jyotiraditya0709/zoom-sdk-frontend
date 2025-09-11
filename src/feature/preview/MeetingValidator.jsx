import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import config from "../../config/config.js";
import "./MeetingValidator.css";

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
      <div className="meeting-validator-container">
        <div className="meeting-validator-content">
          <div className="meeting-validator-icon">⏳</div>
          <h2 className="meeting-validator-title">Validating Meeting...</h2>
          <p className="meeting-validator-message">Please wait while we validate your meeting access.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="meeting-validator-container">
        <div className={`meeting-validator-content meeting-validator-error`}>
          <div className="meeting-validator-icon">
            {errorType === "expired"
              ? "⏰"
              : errorType === "not_found"
                ? "❌"
                : errorType === "unauthorized"
                  ? "🚫"
                  : "❌"}
          </div>
          <h2 className="meeting-validator-title error">
            {errorType === "expired"
              ? "Meeting Time Has Passed"
              : errorType === "not_found"
                ? "Meeting Not Found"
                : errorType === "unauthorized"
                  ? "Access Denied"
                  : "Error"}
          </h2>
          <p className="meeting-validator-message">{error}</p>
          {errorType === "expired" && (
            <p className="meeting-validator-info">
              This meeting has ended. Please contact the meeting organizer for
              more information.
            </p>
          )}
          <button
            className="meeting-validator-button"
            onClick={() => navigate("/")}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (meetingData) {
    // Check if meeting is already completed
    if (meetingData.meetingStatus === "completed" || meetingData.isCompleted) {
      return (
        <div className="meeting-validator-container">
          <div className="meeting-validator-content meeting-validator-warning">
            <div className="meeting-validator-icon">🏁</div>
            <h2 className="meeting-validator-title warning">
              Meeting is already completed
            </h2>
            <div className="meeting-validator-details">
              <p>
                <strong>Meeting ID:</strong> {meetingData.meetingId}
              </p>
              <p>
                <strong>Joinee:</strong> {
                  meetingData.mentorId === userId 
                    ? (meetingData.mentorName || meetingData.mentorId)
                    : (meetingData.menteeName || meetingData.menteeId)
                }
              </p>
              <p>
                <strong>Agenda:</strong> {meetingData.agenda}
              </p>
              <p>
                <strong>Status:</strong> {meetingData.meetingStatus}
              </p>
            </div>
            <button
              className="meeting-validator-button"
              onClick={() => navigate("/")}
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="meeting-validator-container">
        <div className="meeting-validator-content meeting-validator-success">
          <div className="meeting-validator-icon">✅</div>
          <h2 className="meeting-validator-title success">
            Meeting Validated!
          </h2>
          <div className="meeting-validator-details">
            <p>
              <strong>Meeting ID:</strong> {meetingData.meetingId}
            </p>
            <p>
              <strong>Joinee:</strong> {
                meetingData.mentorId === userId 
                  ? (meetingData.mentorName || meetingData.mentorId)
                  : (meetingData.menteeName || meetingData.menteeId)
              }
            </p>
            <p>
              <strong>Agenda:</strong> {meetingData.agenda}
            </p>
            <p>
              <strong>Status:</strong> {meetingData.meetingStatus}
            </p>
          </div>
          <button
            className="meeting-validator-button"
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
      </div>
    );
  }

  return null;
};

export default MeetingValidator;
