import React, { createContext, useContext, useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import config from '../config/config';

const MeetingContext = createContext();

export const useMeeting = () => {
  const context = useContext(MeetingContext);
  if (!context) {
    throw new Error('useMeeting must be used within a MeetingProvider');
  }
  return context;
};

export const MeetingProvider = ({ children }) => {
  const { meetingId, userId } = useParams();
  const location = useLocation();
  const [meetingData, setMeetingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get meetingId and userId from URL params or search params
  const currentMeetingId = meetingId || new URLSearchParams(location.search).get('meetingId');
  const currentUserId = userId || new URLSearchParams(location.search).get('userId');

  const fetchMeetingData = async () => {
    if (!currentMeetingId || !currentUserId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        config.getApiUrl(
          `${config.API_ENDPOINTS.GET_MEETING_INFO}/${currentMeetingId}/${currentUserId}`
        ),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.IsSuccess && data.Data) {
        setMeetingData(data.Data);
        console.log("✅ Meeting data fetched:", data.Data);
      } else {
        throw new Error(data.Message || "Failed to fetch meeting data");
      }
    } catch (err) {
      console.error("❌ Failed to fetch meeting data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetingData();
  }, [currentMeetingId, currentUserId]);

  const value = {
    meetingData,
    loading,
    error,
    orgId: meetingData?.orgId,
    refetch: fetchMeetingData,
  };

  return (
    <MeetingContext.Provider value={value}>
      {children}
    </MeetingContext.Provider>
  );
};
