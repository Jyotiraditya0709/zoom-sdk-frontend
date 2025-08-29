// Backend configuration
const config = {
  // Backend URL - change this for production
  BACKEND_URL: "https://zoom-sdk.mastersunion.org" || "http://localhost:4000",
  
  // API endpoints
  API_ENDPOINTS: {
    GENERATE_SIGNATURE: "/generateSignature",
    USER_JOINED: "/api/userJoined",
    USER_LEFT: "/api/userLeft",
    MEETING_END: "/api/meetingEnd",
    GET_MEETING_INFO: "/api/getMeetingInfo",
  },

  // Get full URL for an endpoint
  getApiUrl: (endpoint) => {
    return `${config.BACKEND_URL}${endpoint}`;
  },
};

export default config;
