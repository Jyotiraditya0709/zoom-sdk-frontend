import React, { useState } from 'react';
import axios from 'axios';
import config from '../../config/config';
import './MeetingCreator.css';

const MeetingCreator = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState(null);
  const [error, setError] = useState(null);

  // Function to generate random UUID
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Function to generate random names
  const generateRandomName = () => {
    const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Chris', 'Emma', 'Alex', 'Maria'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${firstName} ${lastName}`;
  };

  // Function to generate random agenda
  const generateRandomAgenda = () => {
    const agendas = [
      'Weekly 1-on-1 Meeting',
      'Project Review Session',
      'Mentorship Discussion',
      'Career Development Talk',
      'Technical Interview',
      'Performance Review',
      'Goal Setting Session',
      'Feedback Discussion',
      'Training Session',
      'Strategy Planning'
    ];
    return agendas[Math.floor(Math.random() * agendas.length)];
  };

  // Function to generate meeting times
  const generateMeetingTimes = () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + (30 * 60 * 1000)); // 30 minutes from now
    const endTime = new Date(startTime.getTime() + (60 * 60 * 1000)); // 1 hour duration
    
    return {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    };
  };

  const handleCreateMeeting = async () => {
    setIsCreating(true);
    setError(null);
    setCreatedMeeting(null);

    try {
      // Generate automatic data
      const mentorId = generateUUID();
      const menteeId = generateUUID();
      const mentorName = generateRandomName();
      const menteeName = generateRandomName();
      const agenda = generateRandomAgenda();
      const { startTime, endTime } = generateMeetingTimes();
      const orgId = "00324e7c-0a3e-40d6-a583-ae54105c6311"; // Default org ID

      const meetingData = {
        mentorId,
        menteeId,
        mentorName,
        menteeName,
        agenda,
        startTime,
        endTime,
        orgId
      };

      console.log('Creating meeting with data:', meetingData);

      // Call the backend API
      const response = await axios.post(
        config.getApiUrl(config.API_ENDPOINTS.CREATE_MEETING),
        meetingData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.IsSuccess) {
        const meeting = response.data.Data;
        
        // Generate meeting links that go through validation
        const localBaseUrl = window.location.origin;
        const liveBaseUrl = "https://master.d1i6jrqa49nh2k.amplifyapp.com";
        
        const localMentorLink = `${localBaseUrl}/pre-join/${meeting.meetingId}/${mentorId}`;
        const localMenteeLink = `${localBaseUrl}/pre-join/${meeting.meetingId}/${menteeId}`;
        const liveMentorLink = `${liveBaseUrl}/pre-join/${meeting.meetingId}/${mentorId}`;
        const liveMenteeLink = `${liveBaseUrl}/pre-join/${meeting.meetingId}/${menteeId}`;
        
        setCreatedMeeting({
          ...meeting,
          localMentorLink,
          localMenteeLink,
          liveMentorLink,
          liveMenteeLink,
          meetingData
        });
      } else {
        throw new Error(response.data.Message || 'Failed to create meeting');
      }
    } catch (err) {
      console.error('Error creating meeting:', err);
      setError(err.response?.data?.Message || err.message || 'Failed to create meeting');
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Link copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy link');
    });
  };

  return (
    <div className="meeting-creator">
      <div className="meeting-creator-header">
        <h2>🎯 Quick Meeting Creator</h2>
        <p>Click the button below to automatically create a meeting with populated data</p>
      </div>

      <div className="meeting-creator-actions">
        <button 
          className="create-meeting-btn"
          onClick={handleCreateMeeting}
          disabled={isCreating}
        >
          {isCreating ? (
            <>
              <span className="spinner"></span>
              Creating Meeting...
            </>
          ) : (
            <>
              🚀 Create Meeting
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <h3>❌ Error</h3>
          <p>{error}</p>
        </div>
      )}

      {createdMeeting && (
        <div className="meeting-result">
          <div className="success-header">
            <h3>✅ Meeting Created Successfully!</h3>
            <p>Meeting ID: <code>{createdMeeting.meetingId}</code></p>
          </div>

          <div className="meeting-details">
            <h4>📋 Meeting Details</h4>
            <div className="details-grid">
              <div className="detail-item">
                <label>Mentor:</label>
                <span>{createdMeeting.mentorName} ({createdMeeting.mentorId})</span>
              </div>
              <div className="detail-item">
                <label>Mentee:</label>
                <span>{createdMeeting.menteeName} ({createdMeeting.menteeId})</span>
              </div>
              <div className="detail-item">
                <label>Agenda:</label>
                <span>{createdMeeting.agenda}</span>
              </div>
              <div className="detail-item">
                <label>Start Time:</label>
                <span>{new Date(createdMeeting.startTime).toLocaleString()}</span>
              </div>
              <div className="detail-item">
                <label>End Time:</label>
                <span>{new Date(createdMeeting.endTime).toLocaleString()}</span>
              </div>
              <div className="detail-item">
                <label>Status:</label>
                <span className="status-badge">{createdMeeting.meetingStatus}</span>
              </div>
            </div>
          </div>

          <div className="meeting-links">
            <h4>🔗 Meeting Links</h4>
            <div className="link-section">
              <div className="link-category">
                <h5>🏠 Local Links (Development)</h5>
                <div className="link-item">
                  <label>👨‍🏫 Local Mentor Link:</label>
                  <div className="link-container">
                    <input 
                      type="text" 
                      value={createdMeeting.localMentorLink} 
                      readOnly 
                      className="link-input"
                    />
                    <button 
                      className="copy-btn"
                      onClick={() => copyToClipboard(createdMeeting.localMentorLink)}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
                <div className="link-item">
                  <label>👨‍🎓 Local Mentee Link:</label>
                  <div className="link-container">
                    <input 
                      type="text" 
                      value={createdMeeting.localMenteeLink} 
                      readOnly 
                      className="link-input"
                    />
                    <button 
                      className="copy-btn"
                      onClick={() => copyToClipboard(createdMeeting.localMenteeLink)}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="link-category">
                <h5>🌐 Live Links (Production)</h5>
                <div className="link-item">
                  <label>👨‍🏫 Live Mentor Link:</label>
                  <div className="link-container">
                    <input 
                      type="text" 
                      value={createdMeeting.liveMentorLink} 
                      readOnly 
                      className="link-input"
                    />
                    <button 
                      className="copy-btn"
                      onClick={() => copyToClipboard(createdMeeting.liveMentorLink)}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
                <div className="link-item">
                  <label>👨‍🎓 Live Mentee Link:</label>
                  <div className="link-container">
                    <input 
                      type="text" 
                      value={createdMeeting.liveMenteeLink} 
                      readOnly 
                      className="link-input"
                    />
                    <button 
                      className="copy-btn"
                      onClick={() => copyToClipboard(createdMeeting.liveMenteeLink)}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="quick-actions">
            <h4>⚡ Quick Actions (Local)</h4>
            <div className="action-buttons">
              <a 
                href={createdMeeting.localMentorLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="action-btn mentor-btn"
              >
                🎯 Join as Mentor (Local)
              </a>
              <a 
                href={createdMeeting.localMenteeLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="action-btn mentee-btn"
              >
                🎓 Join as Mentee (Local)
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingCreator;
