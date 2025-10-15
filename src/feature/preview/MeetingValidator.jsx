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
          <div className="meeting-validator-icon"><img src="/assest/greenTick.gif" alt="" style={{ width: "70px" }} /></div>
          <h2 className="meeting-validator-title">Validating Meeting Access...</h2>
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
                ? <img src="/assest/svg/accessDenied.svg" alt="" />
                : errorType === "unauthorized"
                  ? <img src="/assest/svg/accessDenied.svg" alt="" />
                  : <img src="/assest/svg/accessDenied.svg" alt="" />}
          </div>
          <h2 className="meeting-validator-title" style={{ color: "#101010" }}>
            {errorType === "expired"
              ? "Meeting Time Has Passed"
              : errorType === "not_found"
                ? "Meeting Not Found"
                : errorType === "unauthorized"
                  ? "Access Denied"
                  : "Access Denied"}
          </h2>
          <p className="meeting-validator-message">{error}</p>
          {errorType === "expired" && (
            <p className="meeting-validator-info">
              This meeting has ended. Please contact the meeting organizer for
              more information.
            </p>
          )}
          {/* <button
            className="meeting-validator-button"
            onClick={() => navigate("/")}
          >
            Go Back
          </button> */}
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
            <div className="meeting-validator-icon"><img src="/assest/svg/accessDenied.svg" alt="" /></div>
            <h2 className="meeting-validator-title warning">
              Meeting is already completed
            </h2>
            <p className="meeting-validator-message">
              This meeting has already been completed. Please contact the meeting organizer for more information.
            </p>
            {/* <button
              className="meeting-validator-button"
              onClick={() => navigate("/")}
            >
              Go Back
            </button> */}
          </div>
        </div>
      );
    }

    // Determine if user is mentor or mentee
    const isMentor = meetingData.mentorId === userId;
    const userType = isMentor ? "mentor" : "mentee";
    const role = isMentor ? "1" : "0"; // 1 = host, 0 = attendee

    return (
      <div className="meeting-validator-container">
        <div className="meeting-validator-content meeting-validator-success">
          <div className="meeting-validator-icon"><img src="/assest/tetr-logo.svg" alt="" style={{ width: "100px" }} /></div>
          
          {isMentor ? (
            <>
              <h2 className="meeting-validator-title success">
                Welcome <strong style={{textTransform: "capitalize"}}>{meetingData.mentorName || "Interviewer"}</strong>!
              </h2>
              <div className="meeting-validator-details">
                <p className="meeting-validator-message">
                  This is a personal interview round with <strong style={{textTransform: "capitalize"}}>{meetingData.menteeName || "the candidate"}</strong>
                </p>
                <div className="evaluation-criteria">
                  <h3 className="criteria-title">What We're Looking For:</h3>
                  <ul className="criteria-list">
                    <li>Strong communication skills</li>
                    <li>Leadership potential</li>
                    <li>Curiosity and resilience</li>
                    <li>Global perspective</li>
                    <li>Passion for entrepreneurship</li>
                    <li>Genuine alignment with Tetr's vision and values</li>
                  </ul>
                  <div className="guideLine">Please Read the 
                    <a href="https://docs.google.com/document/d/18-e4SZmzbe10sJvfISiYEUiIrrJ5ASV34ygfQv0ic34/edit?tab=t.0#heading=h.d2c1t41r538t" target="_blank" rel="noopener noreferrer" className="guideline-link">
                      Interviewer Guidelines
                    </a>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className="meeting-validator-title success">
                Welcome to Your Interview Round <br /> <strong style={{textTransform: "capitalize"}}>{meetingData.menteeName || "Candidate"}</strong>!
              </h2>
              <div className="meeting-validator-details">
                <p className="meeting-validator-message">
                  This stage evaluates interpersonal skills, emotional intelligence, and cultural fit that cannot be fully captured through written applications or standardized assessments.
                </p>
                <div className="interview-preparation">
                  <h3 className="preparation-title">Interview Preparation</h3>
                  <ul className="preparation-list">
                    <li>Reflect on how your experiences connect to your future goals</li>
                    <li>Arrange a professional setting with appropriate technical setup</li>
                    <li>Review your application materials to ensure consistency in how you present yourself</li>
                  </ul>
                </div>
              </div>
            </>
          )}
          
          <button
            className="meeting-validator-button"
            onClick={() => {
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
