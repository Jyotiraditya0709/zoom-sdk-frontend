// Backend configuration
const config = {
  // Backend URL - change this for production
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || "https://zoom-sdk-be-1-spk1.onrender.com/",

  // API endpoints
  API_ENDPOINTS: {
    GENERATE_SIGNATURE: "/generateSignature",
    USER_JOINED: "/api/userJoined",
    USER_LEFT: "/api/userLeft",
    MEETING_END: "/api/meetingEnd",
    GET_MEETING_INFO: "/api/getMeetingInfo",
    CREATE_MEETING: "/api/createMeeting",
    REMOVE_USER: "/api/removeUser",
  },

  // Get full URL for an endpoint
  //mew comment added
  getApiUrl: (endpoint) => {
    return `${config.BACKEND_URL}${endpoint}`;
  },
};

export default config;
