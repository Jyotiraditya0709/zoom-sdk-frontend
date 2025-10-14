import React, { useRef, useState, useEffect, useCallback } from "react";

import { useZoom } from "../preview/ZoomContext";

import axios from "axios";

import ZoomVideo from "@zoom/videosdk";

import { useNavigate, useLocation, useParams } from "react-router-dom";



import "./JoinerScreen.css";

import Header from "../../Layout/Header/Header";

import {

  ChatIcon,

  MicroPhone,

  OffVideoCamera,

  RecordingIcon,

  ShareScreenIcon,

  UnMicroPhone,

  VideoCamera,

} from "../../icon/icon";

import config from "../../config/config";

import ChatSidebar from "../preview/ChatSidebar/ChatSidebar";

import ZoomDotsLoader from "../../components/ZoomDotsLoader/ZoomDotsLoader";

// Add new imports for icons

import {

  FaMicrophone,

  FaMicrophoneSlash,

  FaVideo,

  FaVideoSlash,

  FaChevronUp,

  FaSignal,

  FaChevronDown,
} from "react-icons/fa";

import BlinkDot from "../../components/BlinkDot/BlinkDot";



// Helper functions for robust device fallback (like MeetingPage.jsx)

async function createSafeLocalVideoTrack(selectedCamera) {

  try {

    return await ZoomVideo.createLocalVideoTrack({

      cameraId: selectedCamera?.deviceId,

    });

  } catch (err) {

    if (err.name === "OverconstrainedError" || err.name === "NotFoundError") {

      return await ZoomVideo.createLocalVideoTrack();

    }

    throw err;

  }

}



async function createSafeLocalAudioTrack(selectedMic) {

  try {

    return await ZoomVideo.createLocalAudioTrack({

      microphoneId: selectedMic?.deviceId,

    });

  } catch (err) {

    if (err.name === "OverconstrainedError" || err.name === "NotFoundError") {

      return await ZoomVideo.createLocalAudioTrack();

    }

    throw err;

  }

}



// Helper to get deviceId string (like MeetingPage.jsx)

function getDeviceId(device) {

  if (!device) return undefined;

  if (typeof device === "string") return device;

  if (typeof device === "object" && device.deviceId) return device.deviceId;

  return undefined;

}



// Utility to safely start a video track with retries and error suppression (like MeetingPage.jsx)

async function safeStartVideoTrack(track, videoEl, retries = 3, delay = 300) {

  if (!track || !videoEl) return;

  try {

    videoEl.srcObject = null;

    if (videoEl.load) videoEl.load();

  } catch { }

  for (let attempt = 1; attempt <= retries; attempt++) {

    try {

      await new Promise((res) => setTimeout(res, delay));

      await track.start(videoEl);

      return;

    } catch (err) {

      const msg = err?.message || "";

      if (

        msg.includes("play() request was interrupted") ||

        msg.includes("Timeout starting video source")

      ) {

        console.warn(`Attempt ${attempt} to start video failed:`, msg);

        if (attempt === retries) throw err;

        continue;

      }

      throw err;

    }

  }

}



function JoinerScreen() {

  //state

  const [isMute, setIsMute] = useState(false);

  const [isVideoOff, setIsVideoOff] = useState(false);

  const [isChatOpen, setIsChatOpen] = useState(false);

  const [isScreenShare, setIsScreenShare] = useState(false);

  const [isRecording, setIsRecording] = useState(false);



  const [error, setError] = useState("");

  const [participants, setParticipants] = useState([]);

  const [isAudioOn, setIsAudioOn] = useState(true);

  const [meetingData, setMeetingData] = useState(null);

  // Store names from URL parameters for immediate display on video tiles
  const [urlParamNames, setUrlParamNames] = useState({
    mentorName: "",
    menteeName: ""
  });

  const [isVideoOn, setIsVideoOn] = useState(true);

  const [isJoining, setIsJoining] = useState(false);

  const [localUser, setLocalUser] = useState(null);

  const [isTogglingVideo, setIsTogglingVideo] = useState(false);

  const [isSharing, setIsSharing] = useState(false);



  const [showVideoOptions, setShowVideoOptions] = useState(null);

  const [chatMessages, setChatMessages] = useState([]);

  const [chatInput, setChatInput] = useState("");

  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const [showModals, setShowModals] = useState({

    participants: false,

    chat: false,

    info: false,

  });

  // Add device selection states (like MeetingPage.jsx)

  const [selectedCamera, setSelectedCamera] = useState("");

  const [selectedMic, setSelectedMic] = useState("");

  const [selectedSpeaker, setSelectedSpeaker] = useState("");

  const [meetingStartTime, setMeetingStartTime] = useState(null);

  const [videoDevices, setVideoDevices] = useState([]);

  const [audioDevices, setAudioDevices] = useState([]);

  const [speakerDevices, setSpeakerDevices] = useState([]);

  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  const [isSharingScreen, setIsSharingScreen] = useState(false);

  const [isRemoteSharing, setIsRemoteSharing] = useState(false);

  const [currentSharerId, setCurrentSharerId] = useState(null);

  // const [isAnnotating, setIsAnnotating] = useState(false);

  const [showRecordingNotice, setShowRecordingNotice] = useState(false);

  const [recordingStatus, setRecordingStatus] = useState("stopped"); // "stopped" | "recording" | "paused"

  const [recordingState, setRecordingState] = useState("idle"); // "idle" | "recording" | "paused" | "stopped"

  const [showEndMeetingConfirm, setShowEndMeetingConfirm] = useState(false);

  const [showLeaveMeetingConfirm, setShowLeaveMeetingConfirm] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const [localUserRemoved, setLocalUserRemoved] = useState(false);



  // Mobile responsive effect

  useEffect(() => {

    const handleResize = () => {

      setIsMobile(window.innerWidth <= 768);

    };



    window.addEventListener("resize", handleResize);



    // cleanup on unmount

    return () => {

      window.removeEventListener("resize", handleResize);

    };

  }, []);



  const recordingClientRef = useRef(null);

  const remoteShareContainerRef = useRef(null);



  const mediaStreamRef = useRef(null);

  const videoContainerRefs = useRef({});

  const selfUserIdRef = useRef(null);

  // Dynamic video quality based on network conditions

  const [videoQuality, setVideoQuality] = useState(3); // 1: 360p, 3: 720p

  const VIDEO_QUALITY = videoQuality; // Use dynamic quality



  // Environment detection for debugging

  const isProduction =

    window.location.hostname !== "localhost" &&

    window.location.hostname !== "127.0.0.1";

  // Environment info removed for cleaner console



  // Check SharedArrayBuffer support (critical for Zoom SDK remote video)

  const hasSharedArrayBuffer = typeof SharedArrayBuffer === 'function';

  const hasCrossOriginIsolation = crossOriginIsolated;

  // SharedArrayBuffer info removed for cleaner console



  if (isProduction && !hasSharedArrayBuffer) {

    console.error(`❌ CRITICAL: SharedArrayBuffer not available in production!`);

    console.error(`❌ This will cause remote video to not display.`);

    console.error(`❌ Server needs Cross-Origin-Opener-Policy: same-origin`);

    console.error(`❌ Server needs Cross-Origin-Embedder-Policy: require-corp`);





    setError("⚠️ Remote video may not display properly. Please refresh the page or contact support if the issue persists.");

  }



  // zoom context

  const { getClient, cleanup, bgMode, setBgMode } = useZoom();



  const [networkQuality, setNetworkQuality] = useState({}); // { userId: level }

  const aspectRatioRefs = useRef({}); // { userId: aspectRatio }

  const [showMediaWarning, setShowMediaWarning] = useState(false);

  const [mediaWarningMessage, setMediaWarningMessage] = useState("");

  const [notifications, setNotifications] = useState([]);

  const [permissionError, setPermissionError] = useState("");

  // Permission error modal state
  const [showPermissionErrorModal, setShowPermissionErrorModal] = useState(false);



  //refs

  const videoRef = useRef(null);

  const clientRef = useRef(null);

  const localUserIdRef = useRef(null);

  const localVideoTrackRef = useRef(null);

  const localAudioTrackRef = useRef(null);



  const shareCanvasRef = useRef(null);

  const shareRenderVideoRef = useRef(null);

  const cameraBtnRef = useRef(null);

  const videoRefs = useRef({});

  const videoCanvasRefs = useRef({});



  // Utility: Clean up camera/video resources fully (like MeetingPage.jsx)

  async function cleanupCamera(userId) {

    const track = localVideoTrackRef.current;

    if (track) {

      await track.stop();

      const m = track.mediaStreamTrack;

      if (m?.stop) m.stop();

      // If Zoom SDK exposes a localMediaStream, stop all tracks

      if (

        track.mediaStream &&

        typeof track.mediaStream.getTracks === "function"

      ) {

        track.mediaStream.getTracks().forEach((t) => t.stop());

      }

      localVideoTrackRef.current = null;

    }

    // Clean up the video element

    const el = videoRefs.current[userId];

    if (el) {

      el.srcObject = null;

      if (el.load) el.load();

    }

  }



  //function for notification

  const notifyUserJoined = async () => {

    try {

      // Webhook call info removed for cleaner console



      const response = await fetch(

        config.getApiUrl(config.API_ENDPOINTS.USER_JOINED),

        {

          method: "POST",

          headers: {

            "Content-Type": "application/json",

          },

          body: JSON.stringify({

            meetingId: meetingId,

            userId: userName,

            userType: isHost ? "mentor" : "mentee",

          }),

        }

      );



      if (!response.ok) {

        const errorText = await response.text();

        console.error("❌ Backend Error Response:", {

          status: response.status,

          statusText: response.statusText,

          body: errorText,

        });

        throw new Error(

          `HTTP error! status: ${response.status} - ${errorText}`

        );

      }



      const data = await response.json();

      // Webhook success info removed for cleaner console

    } catch (err) {

      console.error("❌ Failed to send user joined webhook:", err);

      console.error("❌ Error details:", {

        message: err.message,

        status: err.status,

      });

    }

  };


  // Function to handle self-duplicate (when someone else joins with same ID)
  const handleSelfDuplicate = async () => {
    try {
      console.warn("⚠️ Duplicate detected for myself, leaving meeting...");

      // Step 1: Actually leave meeting (cleanup)
      await cleanupMediaAndLeave();

      // Step 2: Redirect to exit page WITH modal
      navigate(
        `/meeting-exit?meetingId=${encodeURIComponent(sessionName)}&userId=${encodeURIComponent(userName)}&role=${role}`
      );

    } catch (err) {
      console.error("❌ Error handling self-duplicate:", err);
    }
  };

  // Function to handle duplicate participants - if someone else joins with same ID, I leave
  const handleDuplicateParticipants = async () => {
    try {
      const allUsers = clientRef.current?.getAllUser() || [];

      // My real fixed ID (mentorId or menteeId from URL)
      const myRealId = userName;

      // My connection id from SDK
      const myConnectionId = selfUserIdRef.current;

      // Don't check for duplicates if we don't have our own connection ID yet
      if (!myConnectionId) {
        console.log("🔍 Skipping duplicate check - connection ID not set yet");
        return 0;
      }

      // Check if there is any OTHER connection with the same real userId
      const duplicateExists = allUsers.some(user =>
        user.displayName === myRealId && user.userId !== myConnectionId
      );

      if (duplicateExists) {
        console.warn("⚠️ Duplicate detected (same real userId). Leaving myself...");
        await handleSelfDuplicate();
        return 1;
      }

      return 0;
    } catch (err) {
      console.error("❌ Error in handleDuplicateParticipants:", err);
      return 0;
    }
  };



  const notifyUserLeft = async (isTemporaryLeave = false) => {

    // Prevent calling userLeft during initial join process

    if (isJoining) {

      console.log("🚫 Skipping userLeft webhook during join process");

      return;

    }



    try {

      console.log("🎯 Calling userLeft webhook with:", {

        meetingId: meetingId,

        userId: userName,

        isHost: isHost,

        isTemporaryLeave: isTemporaryLeave,

      });



      const response = await fetch(

        config.getApiUrl(config.API_ENDPOINTS.USER_LEFT),

        {

          method: "POST",

          headers: {

            "Content-Type": "application/json",

          },

          body: JSON.stringify({

            meetingId: meetingId,

            userId: userName,

            userType: isHost ? "mentor" : "mentee",

            isHost: isHost,

            isTemporaryLeave: isTemporaryLeave,

          }),

        }

      );



      if (!response.ok) {

        const errorText = await response.text();

        console.error("❌ Backend Error Response:", {

          status: response.status,

          statusText: response.statusText,

          body: errorText,

        });

        throw new Error(

          `HTTP error! status: ${response.status} - ${errorText}`

        );

      }



      const data = await response.json();

      console.log("✅ User left webhook sent:", data);

    } catch (err) {

      console.error("❌ Failed to send user left webhook:", err);

      console.error("❌ Error details:", {

        message: err.message,

        status: err.status,

      });

    }

  };



  // Meeting end notification with proper API call

  const notifyMeetingEnd = async () => {

    try {

      console.log("🏁 Meeting ended by host:", {

        meetingId: sessionName,

        userId: userName,

        role: role,

        userType: userType,

      });



      const requestBody = {

        meetingId: sessionName,

        userId: userName,

        userType: userType,

        role: role.toString(),

        isMentor: userType === "mentor",

        isHost: role === 1,

        ...(userType === "mentor" && { mentorId: userName }),

        ...(userType === "mentee" && { menteeId: userName }),

      };



      console.log("📡 Making meeting end API call with:", requestBody);



      const response = await fetch(

        config.getApiUrl(config.API_ENDPOINTS.MEETING_END),

        {

          method: "POST",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify(requestBody),

        }

      );



      if (!response.ok) {

        const errorText = await response.text();

        console.error("❌ Meeting end API Error:", {

          status: response.status,

          statusText: response.statusText,

          body: errorText,

        });

      } else {

        const data = await response.json();

        console.log("✅ Meeting end API call successful:", data);

      }

    } catch (err) {

      console.error("❌ Failed to notify meeting end:", err);

    }

  };



  // notification helper with deduplication and connection throttling

  const addNotification = useCallback((msg) => {

    // Check if the same message already exists in recent notifications

    setNotifications((prev) => {

      const recentTime = Date.now() - 2000; // 2 seconds ago

      const isDuplicate = prev.some(n =>

        n.msg === msg &&

        (Date.now() - n.timestamp) < 2000 // Same message within 2 seconds

      );



      if (isDuplicate) {

        console.log("🚫 Skipping duplicate notification:", msg);

        return prev; // Don't add duplicate

      }



      // Special handling for connection notifications - longer cooldown

      const isConnectionMsg = msg.includes("Connected to") || msg.includes("reconnected") || msg.includes("Page refreshed");

      if (isConnectionMsg) {

        const hasRecentConnection = prev.some(n =>

          (n.msg.includes("Connected to") || n.msg.includes("reconnected") || n.msg.includes("Page refreshed")) &&

          (Date.now() - n.timestamp) < 5000 // 5 seconds cooldown for connection messages

        );



        if (hasRecentConnection) {

          console.log("🚫 Skipping connection notification (recent connection exists):", msg);

          return prev;

        }

      }



      const id = Date.now() + Math.random();



      // Auto-remove notification after 2 seconds

      setTimeout(() => {

        setNotifications((prev) => prev.filter((n) => n.id !== id));

      }, 2000); // Set to 2 seconds as requested



      const next = [...prev, { id, msg, timestamp: Date.now() }];

      return next.slice(-3); // Limit to last 3 (reduced from 4)

    });

  }, []);



  // Parse URL Params

  const navigate = useNavigate();

  const location = useLocation();

  const { meetingId, userId } = useParams();

  const { sessionName, userName, displayName, role, userType, initialVideoOff, initialMute, mentorName, menteeName } =

    React.useMemo(() => {

      const params = new URLSearchParams(location.search);



      // URL parameters parsed



      const userTypeParam = params.get("userType") || (parseInt(params.get("role") || "1", 10) === 1 ? "mentor" : "mentee");
      const mentorNameParam = params.get("mentorName") || "";
      const menteeNameParam = params.get("menteeName") || "";
      
      // Determine the actual name to use for recording based on user type
      const actualUserName = userTypeParam === "mentor" ? mentorNameParam : menteeNameParam;
      const displayUserName = actualUserName || userId || "Guest";

      return {

        sessionName: meetingId || "default-session",

        userName: displayUserName, // Use actual name for recording, fallback to userId

        displayName: userId || "Guest", // Keep original for backend identification

        role: parseInt(params.get("role") || "1", 10),

        userType: userTypeParam,

        initialVideoOff: params.get("videoOff") === "true",

        initialMute: params.get("mute") === "true",

        // Get names from URL parameters to show immediately on video tiles

        mentorName: mentorNameParam,

        menteeName: menteeNameParam,

      };

    }, [location.search, meetingId, userId]);



  const isHost = role === 1;

  // Set URL parameter names for immediate use
  useEffect(() => {
    setUrlParamNames({
      mentorName: mentorName || "",
      menteeName: menteeName || ""
    });
  }, [mentorName, menteeName]);

  // Set default background based on user type
  useEffect(() => {
    if (userType === "mentor") {
      // Set Tetr background as default for mentors
      setBgMode("image");
    } else if (userType === "mentee") {
      // Set None as default for mentees
      setBgMode("none");
    }
  }, [userType, setBgMode]);

  // Fetch meeting data to get proper names

  useEffect(() => {

    const fetchMeetingData = async () => {

      if (!meetingId || !userId) return;



      try {

        const response = await fetch(

          config.getApiUrl(

            `${config.API_ENDPOINTS.GET_MEETING_INFO}/${meetingId}/${userId}`

          )

        );



        if (response.ok) {

          const data = await response.json();

          // Meeting data fetch info removed for cleaner console

          if (data.IsSuccess && data.Data) {

            // Meeting data setting info removed for cleaner console

            setMeetingData(data.Data);

          }

        }

      } catch (error) {

        console.error("Failed to fetch meeting data:", error);

      }

    };



    fetchMeetingData();

  }, [meetingId, userId]);

  // Update URL parameter names when meeting data is fetched (as a fallback)
  useEffect(() => {
    if (meetingData && (!urlParamNames.mentorName || !urlParamNames.menteeName)) {
      setUrlParamNames(prev => ({
        mentorName: prev.mentorName || meetingData.mentorName || "",
        menteeName: prev.menteeName || meetingData.menteeName || ""
      }));
    }
  }, [meetingData, urlParamNames.mentorName, urlParamNames.menteeName]);



  // Helper function to get proper display name for any user (following chat system logic)

  const getProperDisplayName = useCallback((userId, displayName) => {
    // If this is the current user, return "You"
    if (userId === selfUserIdRef.current) return "You";

    // Try to get proper name from meetingData
    // Note: displayName contains the mentor/mentee ID, userId is the connection ID
    if (meetingData) {
      if (displayName === meetingData.mentorId) {
        return meetingData.mentorName || displayName || userId;
      }
      if (displayName === meetingData.menteeId) {
        return meetingData.menteeName || displayName || userId;
      }
    }

    // Fallback to URL parameters if meetingData is not yet available
    if (userId === selfUserIdRef.current) {
      if (role === 1 && urlParamNames.mentorName) {
        return urlParamNames.mentorName;
      } else if (role === 0 && urlParamNames.menteeName) {
        return urlParamNames.menteeName;
      }
    }

    // For other participants, use opposite role's name if available
    if (urlParamNames.mentorName && urlParamNames.menteeName && userId !== selfUserIdRef.current) {
      return role === 1 ? urlParamNames.menteeName : urlParamNames.mentorName;
    }

    // Final fallback
    return displayName || userId || "Guest";
  }, [meetingData, urlParamNames, role]);



  // Function to transform participants with proper names
  const transformParticipantsWithNames = useCallback((participants) => {
    if (!meetingData || !participants) {
      return participants;
    }

    const transformed = participants.map(participant => {
      const properName = getProperDisplayName(participant.userId, participant.displayName);
      return {
        ...participant,
        displayName: properName
      };
    });

    return transformed;
  }, [meetingData, getProperDisplayName]);



  // Function to update participant names from meetingData

  const updateParticipantNames = useCallback(() => {

    if (meetingData && participants.length > 0) {

      setParticipants(prev => transformParticipantsWithNames(prev));

    }

  }, [meetingData, participants.length, transformParticipantsWithNames]);



  // Update displayName when meetingData becomes available

  useEffect(() => {

    updateParticipantNames();

  }, [updateParticipantNames]);



  // Force update participants when meetingData changes
  useEffect(() => {
    if (meetingData && participants.length > 0) {
      setParticipants(prev => transformParticipantsWithNames(prev));
    }
  }, [meetingData, transformParticipantsWithNames]);



  // Update local user displayName when meetingData becomes available
  useEffect(() => {
    if (meetingData) {
      const properName = meetingData.mentorId === userId
        ? meetingData.mentorName
        : meetingData.menteeId === userId
          ? meetingData.menteeName
          : displayName;
    }
  }, [meetingData, userId, displayName]);



  // Set initial camera/mic states based on URL parameters

  useEffect(() => {

    // Initial state setting info removed for cleaner console



    setIsVideoOn(!initialVideoOff);

    setIsAudioOn(!initialMute);

  }, [initialVideoOff, initialMute]);



  const attachVideo = useCallback(

    async (userId) => {

      const container = videoContainerRefs.current[userId];

      if (container && mediaStreamRef.current) {

        try {

          // Video attachment info removed for cleaner console



          // Environment info removed for cleaner console



          // Video quality info removed for cleaner console


          const userVideo = await mediaStreamRef.current.attachVideo(

            userId,

            VIDEO_QUALITY

          );

          // Video element creation info removed for cleaner console



          container.innerHTML = "";

          container.appendChild(userVideo);



          // Video attachment success info removed for cleaner console



          // Ensure container is visible

          container.style.display = "flex";

          container.style.visibility = "visible";

          container.style.opacity = "1";



          // Immediate check for black tile (after 500ms)

          setTimeout(() => {

            if (container && container.children.length > 0) {

              const videoElement = container.querySelector("video");

              // Video element found info removed for cleaner console

              if (videoElement) {

                // Video dimensions info removed for cleaner console



                // Check if video has actual content (only for remote users)

                if (

                  userId !== selfUserIdRef.current &&

                  (videoElement.videoWidth === 0 ||

                    videoElement.videoHeight === 0)

                ) {

                  console.log(

                    `🧹 Immediate aggressive cleanup of black tile for remote user: ${userId}`

                  );

                  container.innerHTML = "";

                  container.style.display = "none";

                  // Remove from DOM completely

                  if (container.parentNode) {

                    container.parentNode.removeChild(container);

                  }

                  // Remove from refs

                  delete videoContainerRefs.current[userId];



                  if (mediaStreamRef.current) {

                    mediaStreamRef.current

                      .detachVideo(userId)

                      .catch((e) =>

                        console.error(`Failed to detach video for ${userId}`, e)

                      );

                  }



                  // Force UI update

                  setParticipants(transformParticipantsWithNames(clientRef.current?.getAllUser() || []));

                } else {

                  console.log(

                    `🎥 Video is displaying properly for user: ${userId}`

                  );

                }

              }

            }

          }, 500); // Check after 500ms for immediate cleanup



          // Additional timeout to clean up black tiles that don't load

          setTimeout(() => {

            if (container && container.children.length > 0) {

              const videoElement = container.querySelector("video");

              if (videoElement && videoElement.videoWidth === 0) {

                console.log(

                  `🧹 Aggressive cleanup of persistent black tile for user: ${userId}`

                );

                container.innerHTML = "";

                container.style.display = "none";

                // Remove from DOM completely

                if (container.parentNode) {

                  container.parentNode.removeChild(container);

                }

                // Remove from refs

                delete videoContainerRefs.current[userId];



                // Use mediaStreamRef directly to avoid circular dependency

                if (mediaStreamRef.current) {

                  mediaStreamRef.current

                    .detachVideo(userId)

                    .catch((e) =>

                      console.error(`Failed to detach video for ${userId}`, e)

                    );

                }



                // Force UI update

                setParticipants(transformParticipantsWithNames(clientRef.current?.getAllUser() || []));

              }

            }

          }, 2000); // Reduced to 2 seconds for faster cleanup



          // Additional check for video element that doesn't start playing

          // Only apply aggressive cleanup to remote users, not local user

          if (userId !== selfUserIdRef.current) {

            setTimeout(() => {

              if (container && container.children.length > 0) {

                const videoElement = container.querySelector("video");

                if (videoElement && videoElement.paused) {

                  console.log(

                    `🧹 Aggressive cleanup of non-playing video for remote user: ${userId}`

                  );

                  container.innerHTML = "";

                  container.style.display = "none";

                  // Remove from DOM completely

                  if (container.parentNode) {

                    container.parentNode.removeChild(container);

                  }

                  // Remove from refs

                  delete videoContainerRefs.current[userId];



                  if (mediaStreamRef.current) {

                    mediaStreamRef.current

                      .detachVideo(userId)

                      .catch((e) =>

                        console.error(`Failed to detach video for ${userId}`, e)

                      );

                  }



                  // Force UI update

                  setParticipants(transformParticipantsWithNames(clientRef.current?.getAllUser() || []));

                }

              }

            }, 2000); // Check after 2 seconds

          } else {

            // Aggressive cleanup info removed for cleaner console

          }

        } catch (e) {

          console.error(`Failed to attach video for ${userId}`, e);

          // Clean up container if attachment fails

          if (container) {

            container.innerHTML = "";

          }

        }

      }

    },

    [VIDEO_QUALITY]

  );



  const detachVideo = useCallback(async (userId) => {

    if (mediaStreamRef.current) {

      try {

        await mediaStreamRef.current.detachVideo(userId);

      } catch (e) {

        console.error(`Failed to detach video for ${userId}`, e);

      }

    }

  }, []);



  // Complete user removal function - handles all cleanup

  const completeUserRemoval = useCallback((userId) => {

    // Complete user removal info removed for cleaner console



    // 1. Clean up video container

    if (videoContainerRefs.current[userId]) {

      // Complete cleanup info removed for cleaner console

      const container = videoContainerRefs.current[userId];

      container.innerHTML = "";

      container.style.display = "none";

      if (container.parentNode) {

        container.parentNode.removeChild(container);

      }

      delete videoContainerRefs.current[userId];

    }



    // 2. Remove from participants list

    setParticipants((prevParticipants) => {

      const updatedParticipants = prevParticipants.filter(

        (p) => p.userId !== userId

      );

      console.log(

        `📊 Complete removal - Participants updated: ${prevParticipants.length} -> ${updatedParticipants.length}`

      );

      return transformParticipantsWithNames(updatedParticipants);

    });



    // 3. Force additional cleanup

    setTimeout(() => {

      // Final check and cleanup

      const remainingContainer = videoContainerRefs.current[userId];

      if (remainingContainer) {

        console.log(

          `🧹 Final cleanup of remaining container for user: ${userId}`

        );

        remainingContainer.innerHTML = "";

        remainingContainer.style.display = "none";

        if (remainingContainer.parentNode) {

          remainingContainer.parentNode.removeChild(remainingContainer);

        }

        delete videoContainerRefs.current[userId];

      }



      // Force final participants update

      setParticipants((prevParticipants) => {

        const finalParticipants = prevParticipants.filter(

          (p) => p.userId !== userId

        );

        console.log(

          `🔄 Complete removal - Final participants count: ${finalParticipants.length}`

        );

        return transformParticipantsWithNames(finalParticipants);

      });

    }, 100);

  }, []);



  // Simple cleanup function (like MeetingPage.jsx)

  const cleanupMediaAndLeave = async () => {

    try {

      // Stop screen sharing if active

      if (isSharingScreen && mediaStreamRef.current) {

        await mediaStreamRef.current.stopShareScreen();

        setIsSharingScreen(false);

      }



      // Stop recording if active

      if (recordingClientRef.current && recordingStatus !== "stopped") {

        try {

          await recordingClientRef.current.stopCloudRecording();

          setRecordingStatus("stopped");

        } catch (err) {

          console.warn("Failed to stop recording:", err);

        }

      }



      // Leave the session

      if (clientRef.current) {

        await clientRef.current.leave();

      }

    } catch (err) {

      console.error("Error during cleanup:", err);

    }

  };

  // Handle refresh detection and automatic redirect

  // Enhanced to prevent host refresh from ending meeting for all participants

  useEffect(() => {

    // Only set up refresh detection if we have valid meeting info

    if (!sessionName || !userName) {

      return;

    }



    const handleBeforeUnload = () => {

      // Store meeting info in sessionStorage for after refresh
      // Use actual UUID instead of display name for proper API calls
      const actualUserId = meetingData ? 
        (userType === "mentor" ? meetingData.mentorId : meetingData.menteeId) : 
        userName; // fallback to userName if meetingData not available

      sessionStorage.setItem(

        "meetingExitInfo",

        JSON.stringify({

          meetingId: sessionName,

          userId: actualUserId, // Store actual UUID instead of display name

          displayName: userName, // Keep display name for UI purposes

          role: role,

          timestamp: Date.now(),

          isHost: isHost,

          reason: "page_unload"

        })

      );



      // 🔑 CRITICAL: Handle page unload based on user role

      try {

        if (

          clientRef.current &&

          clientRef.current.getCurrentUserInfo()?.userId

        ) {

          console.log(

            `🔄 Page unloading - handling based on role: ${isHost ? "host" : "participant"

            }`

          );



          if (isHost) {

            // For hosts: Don't end the meeting, just leave as participant

            // This prevents ending the meeting for all other participants

            console.log(

              "👑 Host refreshing - leaving as participant to preserve meeting"

            );

            clientRef.current.leave(false); // false => leave as participant, don't end meeting

          } else {

            // For participants: Normal leave behavior

            console.log("👤 Participant refreshing - normal leave behavior");

            clientRef.current.leave(true); // true => force immediate leave

          }

        }

      } catch (err) {

        console.error("❌ Error leaving meeting on page unload:", err);

      }

    };



    const handleVisibilityChange = () => {

      // Only handle visibility change if we're actually leaving the page

      // Tab switches should NOT cause users to leave the meeting

      if (document.visibilityState === "hidden") {

        // Check if this is likely a page unload vs just a tab switch

        // We'll use a small delay to differentiate between tab switch and page unload

        setTimeout(() => {

          // If the page is still hidden after a short delay, it might be a page unload

          // But we won't force leave here - let the beforeunload and pagehide handlers deal with it

          console.log(

            "🔄 Tab hidden - but not forcing leave (likely just tab switch)"

          );

        }, 100);

      } else if (document.visibilityState === "visible") {

        // Tab visible again info removed for cleaner console

      }

    };



    const handlePageHide = () => {

      // Immediately notify backend that user is leaving due to refresh/page close

      if (clientRef.current && clientRef.current.getCurrentUserInfo()?.userId) {

        console.log(

          `🔄 User leaving page - notifying backend (role: ${isHost ? "host" : "participant"

          })`

        );



        // Try multiple methods to ensure the webhook is called

        const data = JSON.stringify({

          meetingId: sessionName,

          userId: userName,

          userType: isHost ? "mentor" : "mentee",

          isHost: isHost,

          // For hosts, indicate this is a temporary leave (refresh) not a meeting end

          isTemporaryLeave: isHost,

        });



        // Method 1: sendBeacon (most reliable for page unload)

        if (navigator.sendBeacon) {

          const success = navigator.sendBeacon(

            config.getApiUrl(config.API_ENDPOINTS.USER_LEFT),

            data

          );

          // sendBeacon result info removed for cleaner console

        }



        // Method 2: Synchronous XMLHttpRequest (fallback)

        try {

          const xhr = new XMLHttpRequest();

          xhr.open(

            "POST",

            config.getApiUrl(config.API_ENDPOINTS.USER_LEFT),

            false

          );

          xhr.setRequestHeader("Content-Type", "application/json");

          xhr.send(data);

          // XMLHttpRequest status info removed for cleaner console

        } catch (err) {

          console.error("📡 XMLHttpRequest failed:", err);

        }



        // Method 3: Store in sessionStorage for next page load

        sessionStorage.setItem("pendingUserLeft", data);

      }

    };



    const handleLoad = () => {

      // Check if we have stored meeting info from a refresh

      const storedInfo = sessionStorage.getItem("meetingExitInfo");

      if (storedInfo) {

        try {

          const info = JSON.parse(storedInfo);

          const timeDiff = Date.now() - info.timestamp;



          // Only redirect if the refresh happened within the last 5 seconds

          if (timeDiff < 5000) {

            sessionStorage.removeItem("meetingExitInfo");



            // For both hosts and participants, show the meeting exit modal on refresh

            console.log(

              `🔄 User refreshing - showing meeting exit modal (role: ${info.role === 1 || info.role === "1" ? "host" : "participant"})`

            );



            // Set flag to prevent automatic rejoin

            sessionStorage.setItem("preventAutoRejoin", "true");



            // Navigate to meeting-exit modal for both hosts and participants

            navigate(

              `/meeting-exit?meetingId=${encodeURIComponent(

                info.meetingId

              )}&userId=${encodeURIComponent(info.userId)}&role=${info.role}`

            );

          } else {

            sessionStorage.removeItem("meetingExitInfo");

          }

        } catch (err) {

          sessionStorage.removeItem("meetingExitInfo");

        }

      }



      // Check for pending user left notification

      const pendingUserLeft = sessionStorage.getItem("pendingUserLeft");

      if (pendingUserLeft) {

        try {

          const data = JSON.parse(pendingUserLeft);

          // Sending pending user left notification info removed for cleaner console



          // Send the pending notification

          fetch(config.getApiUrl(config.API_ENDPOINTS.USER_LEFT), {

            method: "POST",

            headers: { "Content-Type": "application/json" },

            body: pendingUserLeft,

          })

            .then(() => {

              // Pending user left notification sent info removed for cleaner console

            })

            .catch((err) => {

              console.error(

                "❌ Failed to send pending user left notification:",

                err

              );

            });



          sessionStorage.removeItem("pendingUserLeft");

        } catch (err) {

          console.error("❌ Failed to parse pending user left data:", err);

          sessionStorage.removeItem("pendingUserLeft");

        }

      }

    };



    window.addEventListener("beforeunload", handleBeforeUnload);

    window.addEventListener("pagehide", handlePageHide);

    window.addEventListener("unload", handleBeforeUnload); // Backup unload handler

    window.addEventListener("visibilitychange", handleVisibilityChange);

    window.addEventListener("load", handleLoad);



    // Check immediately on mount

    handleLoad();



    return () => {

      window.removeEventListener("beforeunload", handleBeforeUnload);

      window.removeEventListener("pagehide", handlePageHide);

      window.removeEventListener("unload", handleBeforeUnload);

      window.removeEventListener("visibilitychange", handleVisibilityChange);

      window.removeEventListener("load", handleLoad);

    };

  }, [navigate, sessionName, userName, role]);



  // Main session lifecycle effect

  useEffect(() => {

    const client = getClient();

    clientRef.current = client;



    // Only proceed if we have valid meeting info

    if (!sessionName || !userName) {

      return;

    }



    // Check if we should prevent automatic rejoin (user just left due to refresh)

    const preventAutoRejoin = sessionStorage.getItem("preventAutoRejoin");

    if (preventAutoRejoin === "true") {

      sessionStorage.removeItem("preventAutoRejoin");

      // Preventing automatic rejoin info removed for cleaner console

      return;

    }





    // Fetch devices and set state

    const fetchDevices = async () => {

      try {

        const devices = await ZoomVideo.getDevices();

        const cams = devices.filter((d) => d.kind === "videoinput");

        const mics = devices.filter((d) => d.kind === "audioinput");

        const speakers = devices.filter((d) => d.kind === "audiooutput");

        setVideoDevices(cams);

        setAudioDevices(mics);

        setSpeakerDevices(speakers);



        // Set default devices if not already set

        if (!selectedCamera && cams[0]) setSelectedCamera(cams[0].deviceId);

        if (!selectedMic && mics[0]) setSelectedMic(mics[0].deviceId);

        if (!selectedSpeaker && speakers[0])

          setSelectedSpeaker(speakers[0].deviceId);



        // Clear any previous device errors

        setError("");

        setPermissionError("");

      } catch (err) {

        // Device fetch warning info removed for cleaner console



        // Only show error if it's a permission issue, not just no devices

        if (

          err.name === "NotAllowedError" ||

          err.name === "PermissionDeniedError"

        ) {

          setPermissionError(

            "We can't detect your microphone/camera because it's blocked in your browser or system settings.\n\nTo fix this:\n\nClick \"Allow\" in the permission popup at the top of your browser.\n\nIf you don't see it, click the 🔒 lock icon next to the address bar.\n\nGo to Site settings → Permissions.\n\nSet Microphone/Camera to Allow.\n\nAfter updating, refresh the page and try again."

          );

          setShowPermissionErrorModal(true);

        } else if (

          err.name === "NotFoundError" ||

          err.name === "NotReadableError"

        ) {

          setError(

            "No camera or microphone found. Please connect a device and refresh the page."

          );

        } else {

          // For other errors, just log them but don't show to user

          // Device fetch error info removed for cleaner console

        }

      }

    };

    // Try to request permissions first, then fetch devices

    const initializeDevices = async () => {

      try {

        // Only request camera permissions if video is not off from preview

        if (!initialVideoOff) {

          // Camera permission request info removed for cleaner console

          await navigator.mediaDevices.getUserMedia({

            video: true,

            audio: true,

          });

        } else {

          // Skipping camera permission request info removed for cleaner console

          // Still request audio permissions for microphone

          await navigator.mediaDevices.getUserMedia({

            audio: true,

          });

        }



        // If successful, fetch devices

        await fetchDevices();

      } catch (err) {

        console.log(

          "Permission request failed, trying to fetch devices anyway:",

          err

        );

        // Even if permission request fails, try to fetch devices

        await fetchDevices();

      }

    };



    initializeDevices();



    // Listen for device-change event

    client.on("device-change", fetchDevices);



    // Listen for permission-change event

    client.on("permission-change", (payload) => {

      setPermissionError(

        "We can't detect your microphone/camera because it's blocked in your browser or system settings.\n\nTo fix this:\n\nClick \"Allow\" in the permission popup at the top of your browser.\n\nIf you don't see it, click the 🔒 lock icon next to the address bar.\n\nGo to Site settings → Permissions.\n\nSet Microphone/Camera to Allow.\n\nAfter updating, refresh the page and try again."

      );

      setShowPermissionErrorModal(true);

    });



    // Device plug/unplug and permission changes

    client.on("device-change", fetchDevices);

    client.on("device-permission-change", (payload) => {

      addNotification(`${payload.name} permission is ${payload.state}`);

      if (payload.state === "denied") {

        setMediaWarningMessage(

          `Media error: Your mic is muted in system or browser settings. Please open your settings to unmute and adjust the level.`

        );

        setShowMediaWarning(true);

      }

    });



    // Media failure handling

    client.on("active-media-failed", (payload) => {

      const message = payload.message || payload.code || "Unknown media error";

      console.error("Active media failed:", payload);

      // Don't show notification to avoid disrupting user experience
      // addNotification(`Media error: ${message}`);

      // Try to automatically recover from media failures
      const handleMediaRecovery = async () => {
        try {
          // Get available devices
          const devices = await ZoomVideo.getDevices();
          const mics = devices.filter((d) => d.kind === "audioinput");
          const speakers = devices.filter((d) => d.kind === "audiooutput");

          // Try to switch to a working device
          if (mics.length > 0 && mediaStreamRef.current) {
            // Find a non-communication device
            const nonCommMic = mics.find(mic =>
              !mic.label.toLowerCase().includes('communication') &&
              !mic.label.toLowerCase().includes('comm')
            ) || mics[0];

            try {
              await mediaStreamRef.current.switchMicrophone(nonCommMic.deviceId);
              setSelectedMic(nonCommMic.deviceId);
              // Auto-recovered microphone info removed for cleaner console
            } catch (micErr) {
              console.error("Failed to auto-recover microphone:", micErr);
            }
          }

          if (speakers.length > 0 && mediaStreamRef.current) {
            // Find a non-communication device
            const nonCommSpeaker = speakers.find(speaker =>
              !speaker.label.toLowerCase().includes('communication') &&
              !speaker.label.toLowerCase().includes('comm')
            ) || speakers[0];

            try {
              await mediaStreamRef.current.switchSpeaker(nonCommSpeaker.deviceId);
              setSelectedSpeaker(nonCommSpeaker.deviceId);
              // Auto-recovered speaker info removed for cleaner console
            } catch (speakerErr) {
              console.error("Failed to auto-recover speaker:", speakerErr);
            }
          }
        } catch (recoveryErr) {
          console.error("Media recovery failed:", recoveryErr);
        }
      };

      // Attempt recovery after a short delay
      setTimeout(handleMediaRecovery, 1000);

      // Only show warning for critical errors that can't be auto-recovered
      if (payload.code && (payload.code === 2001 || payload.code === 2002)) {
        setMediaWarningMessage(
          `We detected an issue with your audio device. We've automatically switched to a compatible device.\n\nIf you continue to have issues, please check your system audio settings.`
        );
        setShowMediaWarning(true);
      }

    });



    // Audio/video state changes

    client.on("current-audio-change", (payload) => {

      if (payload.action === "Leave") {

        addNotification(`Audio ended: ${payload.source}`);

      } else if (payload.action === "Muted") {

        addNotification(`Audio muted: ${payload.source}`);

        // Show warning for system-level mute

        if (payload.source && payload.source.includes("system")) {

          setMediaWarningMessage(

            `Your microphone has been muted by the system.\n\nPlease check your system audio settings and unmute your microphone.`

          );

          setShowMediaWarning(true);

        }

      }

    });



    // Auto-play audio failure

    client.on("auto-play-audio-failed", () => {

      addNotification(

        `Audio playback blocked. Click anywhere to resume audio.`

      );

    });



    // Network quality indicator

    client.on("network-quality-change", (payload) => {

      // Convert network quality levels to numeric values for consistent rendering
      const getNetworkQualityLevel = (level) => {
        // Handle both string and numeric values from Zoom SDK
        if (typeof level === 'number') {
          return level;
        }

        switch (level) {
          case 'Excellent':
          case 'Good':
          case '4':
            return 4;
          case 'Fair':
          case '3':
            return 3;
          case 'Poor':
          case '2':
            return 2;
          case 'Very Poor':
          case '1':
            return 1;
          default:
            return 0;
        }
      };

      const numericLevel = getNetworkQualityLevel(payload.level);

      setNetworkQuality((prev) => ({

        ...prev,

        [payload.userId]: numericLevel,

      }));



      // Log network quality changes for debugging

      // Network quality info removed for cleaner console



      // If network quality is poor, log it for debugging

      if (payload.level === 'Poor' || payload.level === 'Very Poor') {

        // Poor network quality info removed for cleaner console

      }

    });



    // Add connection state monitoring

    client.on("connection-change", (payload) => {

      // Connection state info removed for cleaner console



      if (payload.state === 'Reconnecting') {

        // Reconnection attempt info removed for cleaner console

        addNotification('Reconnecting to meeting...');

      } else if (payload.state === 'Connected') {

        // Successfully connected info removed for cleaner console

        addNotification('Connected to meeting');

      } else if (payload.state === 'Disconnected') {

        // Disconnected info removed for cleaner console

        addNotification('Disconnected from meeting');

      }

    });



    // Dynamic video aspect ratio

    client.on("video-aspect-ratio-change", (payload) => {

      aspectRatioRefs.current[payload.userId] = payload.aspectRatio;

      // Optionally, force a re-render

      // Removed notification for aspect ratio change

      // addNotification(`Aspect ratio changed for user ${payload.userId}`);

    });



    const getSignature = async () => {

      try {

        const response = await fetch(

          config.getApiUrl(config.API_ENDPOINTS.GENERATE_SIGNATURE),

          {

            method: "POST",

            headers: {

              "Content-Type": "application/json",

            },

            body: JSON.stringify({ sessionName, role }),

          }

        );



        if (!response.ok) {

          throw new Error(`HTTP error! status: ${response.status}`);

        }



        const data = await response.json();

        return data.signature;

      } catch (err) {

        setError("Failed to get a valid signature.");

        return null;

      }

    };



    client.on("chat-on-message", (payload) => {

      // Handle recording status messages from host

      if (payload.message.includes("🔴 LIVE - This meeting is being recorded")) {

        // Host started recording - update local state for all participants

        setRecordingState("recording");

        setRecordingStatus("recording");

        setShowRecordingNotice(true);

        addNotification("🔴 LIVE - This meeting is being recorded");

        playRecordingBeep();

        // Recording started info removed for cleaner console

      } else if (payload.message.includes("⏸️ Recording paused — waiting for participant")) {

        // Host paused recording - update local state for all participants

        setRecordingState("paused");

        setRecordingStatus("paused");

        setShowRecordingNotice(false);

        addNotification("⏸️ Recording paused — waiting for participant");

        playRecordingBeep();

        // Recording paused info removed for cleaner console

      } else if (payload.message.includes("🔴 Recording resumed")) {

        // Host resumed recording - update local state for all participants

        setRecordingState("recording");

        setRecordingStatus("recording");

        setShowRecordingNotice(true);

        addNotification("🔴 Recording resumed");

        playRecordingBeep();

        // Recording resumed info removed for cleaner console

      } else if (payload.message.includes("⏹️ Recording has stopped")) {

        // Host stopped recording - update local state for all participants

        setRecordingState("stopped");

        setRecordingStatus("stopped");

        setShowRecordingNotice(false);

        addNotification("⏹️ Recording has stopped");

        playRecordingBeep();

        // Recording stopped info removed for cleaner console

      }

      setChatMessages((prev) => {

        // Check if this message already exists to prevent duplicates

        const messageExists = prev.some(

          (msg) =>

            msg.sender === payload.sender.name &&

            msg.content === payload.message &&

            // Compare timestamps more reliably by checking if they're within 1 second

            Math.abs(new Date(msg.timestamp).getTime() - new Date(payload.timestamp).getTime()) < 1000

        );



        if (messageExists) {

          return prev; // Don't add duplicate

        }



        // Increment unread count if chat is closed and message is not from current user

        if (!showModals.chat && payload.sender.name !== userName) {

          setUnreadChatCount(prev => prev + 1);

          // Unread chat message count info removed for cleaner console

        }



        return [

          ...prev,

          {

            sender: payload.sender.name,

            content: payload.message,

            timestamp: payload.timestamp, // Store the original timestamp, not formatted string

          },

        ];

      });

    });



    client.on("peer-video-state-change", async (payload) => {

      const { action, userId } = payload;

      if (userId === selfUserIdRef.current) return; // Ignore self events



      // Video state change info removed for cleaner console



      if (action === "Start") {

        // Check if user is still in the meeting before attaching video

        const allUsers = client.getAllUser();

        const user = allUsers.find((u) => u.userId === userId);

        if (!user) {

          console.log(

            `🚫 User ${userId} no longer in meeting - skipping video attachment`

          );

          return;

        }



        // User video start info removed for cleaner console



        // Show video container if it was hidden

        if (videoContainerRefs.current[userId]) {

          // Showing video container info removed for cleaner console

          const container = videoContainerRefs.current[userId];

          container.style.display = "block";

        }



        await attachVideo(userId);

      } else if (action === "Stop") {

        // User video stop info removed for cleaner console

        await detachVideo(userId);



        // Only hide the video container, don't remove the user

        if (videoContainerRefs.current[userId]) {

          // Hiding video container info removed for cleaner console

          const container = videoContainerRefs.current[userId];

          container.style.display = "none";

          // Don't remove from refs or participants - user is still in meeting

        }

      }



      // Update participants state so UI reflects remote video changes

      setParticipants(transformParticipantsWithNames(client.getAllUser()));

    });



    // Add peer-audio-state-change listener to update participants state

    client.on("peer-audio-state-change", (payload) => {

      if (payload && payload.userId) {

        setParticipants((prev) => {

          const updated = prev.map((user) =>

            user.userId === payload.userId

              ? { ...user, muted: payload.action === "Muted" }

              : user

          );

          return transformParticipantsWithNames(updated);

        });

      } else {

        setParticipants(transformParticipantsWithNames(client.getAllUser()));

      }

    });

    client.on("user-updated", () => {

      setParticipants(transformParticipantsWithNames(client.getAllUser()));

    });



    const joinSession = async () => {

      try {

        setIsJoining(true);

        await client.init("en-US", "Global", {

          patchJsMedia: true,

          enforceVirtualBackground: true,

          virtualBackground: { isSupport: true },

          // Add TURN/STUN server configuration for production environments

          webRTC: {

            iceServers: [

              { urls: 'stun:stun.zoom.us:3478' },

              { urls: 'stun:stun1.zoom.us:3478' },

              {

                urls: 'turn:turn.zoom.us:3478',

                username: 'zoom',

                credential: 'zoom'

              },

              {

                urls: 'turn:turn1.zoom.us:3478',

                username: 'zoom',

                credential: 'zoom'

              }

            ],

            iceCandidatePoolSize: 10,

            bundlePolicy: 'max-bundle',

            rtcpMuxPolicy: 'require'

          }

        });

        const signature = await getSignature();

        if (!signature) return;



        await client.join(sessionName, signature, userName);



        // Set meeting start time when successfully joined

        setMeetingStartTime(new Date().toISOString());



        // If camera should be off from preview, try to stop video immediately after join

        if (initialVideoOff) {

          try {

            // Camera stop attempt info removed for cleaner console

            const tempMediaStream = client.getMediaStream();

            if (tempMediaStream) {

              await tempMediaStream.stopVideo();

              // Video stopped immediately info removed for cleaner console

            }

          } catch (err) {

            // Could not stop video info removed for cleaner console

          }

        }



        // notify backend that user joined

        await notifyUserJoined();



        // Enable leave on page unload after successful join

        client.leaveOnPageUnload = true;



        // Handle duplicate participants after joining
        setTimeout(async () => {
          const currentUserInfo = client.getCurrentUserInfo();

          // Only proceed if we successfully joined and have user info
          if (currentUserInfo && currentUserInfo.userId) {
            const duplicateCount = await handleDuplicateParticipants();

            if (duplicateCount > 0) {
              // Duplicate participant detection info removed for cleaner console
            }
          } else {
            // No current user info info removed for cleaner console
          }
        }, 5000); // Wait 5 seconds after join to ensure user is fully connected



        // Store meeting info for refresh detection

        sessionStorage.setItem("meetingInfo", JSON.stringify({

          meetingId: sessionName,

          userId: userName,

          timestamp: Date.now(),

          isHost: isHost

        }));



        // If this is a host reconnecting after refresh, show notification

        if (isHost) {

          const storedInfo = sessionStorage.getItem("meetingExitInfo");

          if (storedInfo) {

            try {

              const info = JSON.parse(storedInfo);

              const timeDiff = Date.now() - info.timestamp;

              if (timeDiff < 5000) {

                addNotification("Host reconnected to the meeting");

              }

            } catch (err) {

              // Ignore parsing errors

            }

          }

        }



        // Check if this is a page refresh (not initial load)

        const isRefresh = performance.navigation && performance.navigation.type === 1;

        if (isRefresh) {

          // Page refresh info removed for cleaner console

          addNotification("Page refreshed - reconnected to meeting");

        }



        // Add network error handling

        window.addEventListener('online', () => {

          // Network reconnected info removed for cleaner console

          addNotification("Network reconnected");

        });



        window.addEventListener('offline', () => {

          // Network disconnected info removed for cleaner console

          addNotification("Network disconnected - trying to reconnect...");

        });



        mediaStreamRef.current = client.getMediaStream();

        selfUserIdRef.current = client.getCurrentUserInfo().userId;

        setParticipants(transformParticipantsWithNames(client.getAllUser()));



        // MediaStream obtained info removed for cleaner console



        // If camera should be off from preview, immediately stop any camera that might have been initialized

        if (initialVideoOff) {

          try {

            // Camera stopping info removed for cleaner console

            // Stop video immediately to prevent camera light from staying on

            await mediaStreamRef.current.stopVideo();

            setIsVideoOn(false);

            // Camera stopped info removed for cleaner console



            // Also try to stop any tracks that might be running

            if (mediaStreamRef.current && mediaStreamRef.current.getVideoTrack) {

              const videoTrack = mediaStreamRef.current.getVideoTrack();

              if (videoTrack) {

                videoTrack.stop();

                // Video track stopped info removed for cleaner console

              }

            }

          } catch (err) {

            // Camera stop error info removed for cleaner console

          }

        }



        setTimeout(async () => {

          // Always start audio track, but mute it if muted from preview

          try {

            await mediaStreamRef.current.startAudio();

            // Audio track started info removed for cleaner console

            if (initialMute) {

              // Mute the audio if it was muted in preview

              await mediaStreamRef.current.muteAudio();

              setIsAudioOn(false);

              // Audio muted info removed for cleaner console

            } else {

              setIsAudioOn(true);

              // Audio started and unmuted info removed for cleaner console

            }

          } catch (err) {

            console.error("🎤 Failed to start audio track:", err);

            setIsAudioOn(false);

          }



          // Start and attach self video only if not off from preview

          if (!initialVideoOff) {

            try {

              let vbOptions = {};

              if (bgMode === "blur") {

                vbOptions = { virtualBackground: { imageUrl: "blur" } };

              } else if (bgMode === "image") {

                vbOptions = {

                  virtualBackground: {

                    imageUrl: "/lib/vb-resource/background.jpg",

                  },

                };

              }



              // Ensure video container is visible before starting video

              const localContainer = videoContainerRefs.current[selfUserIdRef.current];

              if (localContainer) {

                localContainer.style.display = "flex";

                // Local video container info removed for cleaner console

              }



              await mediaStreamRef.current.startVideo(vbOptions);

              setIsVideoOn(true);

              await attachVideo(selfUserIdRef.current);

              // Video started with background info removed for cleaner console

            } catch (e) {

              if (e?.errorCode === 6105) {

                // Camera is still starting, show a small message and optionally retry

                setError("Camera is still starting, please wait and try again.");

                // Optionally, retry after 1 second:

                // setTimeout(() => toggleVideo(), 1000);

                return;

              }

              console.error("Failed to start self video", e);

              setError("Could not start camera. Check permissions.");

            }

          } else {

            console.log("📹 Video not started (off from preview)");

            // Ensure video state is properly set to off

            setIsVideoOn(false);

            // Hide the local video container when camera is off from preview

            const localContainer = videoContainerRefs.current[selfUserIdRef.current];

            if (localContainer) {

              localContainer.style.display = "none";

            }

          }



          // Attach videos for users already in the session

          client.getAllUser().forEach(async (user) => {

            if (user.bVideoOn && user.userId !== selfUserIdRef.current) {

              console.log(

                `🎥 Attaching video for existing user: ${user.userId} (${user.displayName})`

              );

              await attachVideo(user.userId);

            } else if (

              !user.bVideoOn &&

              user.userId !== selfUserIdRef.current

            ) {

              console.log(

                `📹 Skipping video for user without video: ${user.userId} (${user.displayName})`

              );

            }

          });



          // Cloud recording logic

          recordingClientRef.current = client.getRecordingClient();



          // 🆕 Set up automatic recording when BOTH mentor AND mentee join

          const checkMentorMenteeJoined = () => {

            // Check if we have both mentor and mentee in the meeting

            const hasMentor = participants.some(p => p.role === 'host' || p.isHost);

            const hasMentee = participants.some(p => p.role === 'attendee' || !p.isHost);



            if (hasMentor && hasMentee && !showRecordingNotice) {

              console.log("✅ Both mentor and mentee joined - starting automatic recording");

              startAutomaticRecording();

            }

          };



          // Check when participants change

          if (participants.length > 0) {

            checkMentorMenteeJoined();

          }

        }, 500); // Small delay to allow React to render containers



        const setupEventListeners = () => {

          // This function is called but not defined

          console.log("Setting up event listeners");

        };

      } catch (err) {

        console.error("Join error:", err);

        setError("Failed to join the session.");

      } finally {

        setIsJoining(false);

      }

    };



    joinSession();



    // Advanced screen sharing event handlers (like MeetingPage.jsx)

    const handleShareStarted = () => {

      setIsSharingScreen(true);

      setCurrentSharerId(selfUserIdRef.current);

      // Set up browser screen sharing handlers for the sharer

      setTimeout(() => {

        if (isSharingScreen && currentSharerId === selfUserIdRef.current) {

          setupBrowserScreenShareHandlers();

        }

      }, 100);

    };

    const handleShareStopped = () => {

      console.log("🛑 Share stopped event detected, cleaning up share...", {
        isSharingScreen,
        currentSharerId,
        selfUserId: selfUserIdRef.current
      });

      // Always cleanup when share is stopped, regardless of current state
      stopScreenShareCleanup();

    };



    // For viewers: always use canvas for incoming share (like MeetingPage.jsx)

    const handleActiveShareChange = ({ userId, state }) => {

      if (!mediaStreamRef.current) return;

      if (state === "Active") {

        if (remoteShareContainerRef.current) {

          mediaStreamRef.current.startShareView(

            remoteShareContainerRef.current,

            userId

          );

        }

        setIsRemoteSharing(true);

        setCurrentSharerId(userId);

        const displayName = getProperDisplayName(userId, null);

        addNotification(`Screen sharing started by ${displayName}`);

      } else {

        mediaStreamRef.current.stopShareView();

        setIsRemoteSharing(false);

        setCurrentSharerId(null);

      }

    };



    // Use client.on/off instead of mediaStream.on/off (like MeetingPage.jsx)

    client.on("share-content-started", handleShareStarted);

    client.on("share-content-stopped", handleShareStopped);

    client.on("active-share-change", handleActiveShareChange);

    // Listen for browser "Stop sharing" button (passively-stop-share event)

    client.on("passively-stop-share", () => {

      console.log("[SCREEN SHARE] Browser 'Stop sharing' button detected via passively-stop-share event", {
        isSharingScreen,
        currentSharerId,
        selfUserId: selfUserIdRef.current,
        isActuallySharing: mediaStreamRef.current?.isSharingScreen
      });

      // ALWAYS cleanup when browser stops sharing - this is the most reliable approach
      console.log("[SCREEN SHARE] Force cleaning up due to browser stop share event");
      stopScreenShareCleanup();

    });



    // Listen for browser screen sharing events to sync UI - ONLY for the user who is sharing

    const handleBrowserScreenShareEnd = async () => {

      console.log("[SCREEN SHARE] Browser screen share ended");

      // Only handle if this user is actually sharing their screen

      if (isSharingScreen && currentSharerId === selfUserIdRef.current) {

        console.log("🛑 Browser stop detected in handleBrowserScreenShareEnd, cleaning up share...");

        stopScreenShareCleanup();

      }

    };



    // Add event listeners for browser screen sharing - ONLY for the user who is sharing

    let originalGetDisplayMedia = null;

    let isGetDisplayMediaOverridden = false;



    const setupBrowserScreenShareHandlers = () => {

      // Only set up handlers if this user is the one sharing

      if (

        isSharingScreen &&

        currentSharerId === selfUserIdRef.current &&

        !isGetDisplayMediaOverridden

      ) {

        console.log(

          "[SCREEN SHARE] Setting up browser screen share handlers for sharer"

        );



        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {

          // Store original function

          originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;



          // Override getDisplayMedia to add event listeners

          navigator.mediaDevices.getDisplayMedia = function (constraints) {

            return originalGetDisplayMedia

              .call(this, constraints)

              .then((stream) => {

                // Add event listener to the stream to detect when it ends

                stream.getVideoTracks().forEach((track) => {

                  track.addEventListener("ended", handleBrowserScreenShareEnd);

                  track.addEventListener("stop", handleBrowserScreenShareEnd);

                });



                // Also listen for the stream's ended event

                stream.addEventListener("ended", handleBrowserScreenShareEnd);



                return stream;

              });

          };

          isGetDisplayMediaOverridden = true;

        }



        // Add visibility change listener only for the sharer

        const handleVisibilityChange = () => {

          if (

            document.visibilityState === "hidden" &&

            isSharingScreen &&

            currentSharerId === selfUserIdRef.current

          ) {

            setTimeout(() => {

              if (

                isSharingScreen &&

                currentSharerId === selfUserIdRef.current

              ) {

                console.log(

                  "[SCREEN SHARE] Tab hidden during screen share - checking if stopped"

                );

                handleBrowserScreenShareEnd();

              }

            }, 100);

          }

        };



        document.addEventListener("visibilitychange", handleVisibilityChange);



        // Add page unload listener only for the sharer

        const handlePageUnload = () => {

          if (isSharingScreen && currentSharerId === selfUserIdRef.current) {

            console.log("[SCREEN SHARE] Page unloading during screen share");

            handleBrowserScreenShareEnd();

          }

        };



        window.addEventListener("beforeunload", handlePageUnload);

        window.addEventListener("pagehide", handlePageUnload);



        // Store references for cleanup

        window._screenShareVisibilityHandler = handleVisibilityChange;

        window._screenSharePageUnloadHandler = handlePageUnload;

      }

    };



    const cleanupBrowserScreenShareHandlers = () => {

      // Restore original getDisplayMedia if it was overridden

      if (isGetDisplayMediaOverridden && originalGetDisplayMedia) {

        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;

        isGetDisplayMediaOverridden = false;

        originalGetDisplayMedia = null;

      }



      // Remove event listeners

      if (window._screenShareVisibilityHandler) {

        document.removeEventListener(

          "visibilitychange",

          window._screenShareVisibilityHandler

        );

        window._screenShareVisibilityHandler = null;

      }

      if (window._screenSharePageUnloadHandler) {

        window.removeEventListener(

          "beforeunload",

          window._screenSharePageUnloadHandler

        );

        window.removeEventListener(

          "pagehide",

          window._screenSharePageUnloadHandler

        );

        window._screenSharePageUnloadHandler = null;

      }

    };



    // Set up handlers when screen sharing starts

    if (isSharingScreen && currentSharerId === selfUserIdRef.current) {

      setupBrowserScreenShareHandlers();

    }



    // Periodic check to ensure screen sharing state is accurate - ONLY for the sharer

    const screenShareCheckInterval = setInterval(() => {

      if (

        isSharingScreen &&

        currentSharerId === selfUserIdRef.current &&

        mediaStreamRef.current

      ) {

        try {

          if (!mediaStreamRef.current.isSharingScreen) {

            console.log(

              "[SCREEN SHARE] Periodic check detected screen sharing ended"

            );

            handleBrowserScreenShareEnd();

          }

        } catch (error) {

          console.log(

            "[SCREEN SHARE] Periodic check error - screen sharing may have ended"

          );

          handleBrowserScreenShareEnd();

        }

      }

    }, 2000); // Check every 2 seconds



    // Optional: Listen for annotation privilege changes

    // client.on(

    //   "annotation-privilege-change",

    //   ({ userId, isAnnotationEnabled }) => {

    //     if (!isAnnotationEnabled && isAnnotating) {

    //       stopAnnotation();

    //     }

    //   }

    // );



    // Listen for active speaker changes

    client.on("video-active-change", (payload) => {

      setActiveSpeakerId(payload.userId);

    });



    // User join/leave notifications

    // Enhanced to handle local user removal due to leaveOnPageUnload (refresh/close)

    const handleUserAdded = (payload) => {

      payload.forEach((item) => {

        // Get proper display name using the helper function

        const displayName = getProperDisplayName(item.userId, item.displayName);



        console.log("[USER] User joined:", {

          userId: item.userId,

          displayName: displayName,

          isLocal: item.userId === selfUserIdRef.current,

          timestamp: new Date().toISOString(),

          hasVideo: item.bVideoOn,

        });



        // Show notification for user join (duplicate detection now handled at container creation level)

        if (item.userId !== selfUserIdRef.current) {

          // Use URL parameters directly for notifications (simpler and more reliable)
          let displayName = item.displayName; // Default to SDK displayName

          // If we have URL parameters, use them to map the displayName to actual names
          if (urlParamNames.mentorName && urlParamNames.menteeName) {
            // Check if this is the mentor or mentee based on the displayName (which contains the mentor/mentee ID)
            if (item.displayName === meetingData?.mentorId || item.displayName === userName && userType === "mentor") {
              displayName = urlParamNames.mentorName;
            } else if (item.displayName === meetingData?.menteeId || item.displayName === userName && userType === "mentee") {
              displayName = urlParamNames.menteeName;
            } else {
              // For the other participant, use the opposite role's name
              displayName = userType === "mentor" ? urlParamNames.menteeName : urlParamNames.mentorName;
            }
          }

          console.log(`🔔 User join notification: ${item.userId} (${item.displayName}) -> ${displayName}`);
          console.log(`🔍 Using URL parameters:`, { urlParamNames, userType, displayName });

          addNotification(`${displayName} joined the session.`);



          // Check if recording is already active and inform new participant

          if (showRecordingNotice) {

            addNotification("🔴 LIVE - This meeting is being recorded");

            playRecordingBeep();

          }

        } else {

          // This is the local user joining

          console.log(`👤 Local user ${item.userId} joined the session`);

        }



        // If user joined without video, don't create a video container

        if (!item.bVideoOn && item.userId !== selfUserIdRef.current) {

          console.log(

            `📹 User ${item.userId} joined without video - skipping video container`

          );

        }



        // Re-register screen share event listeners for new participants

        if (item.userId !== selfUserIdRef.current) {

          console.log(

            "[SCREEN SHARE] Re-registering events for new participant:",

            item.userId

          );

          // Force a re-registration of screen share events

          client.off("active-share-change");

          client.on("active-share-change", (payload) => {

            console.log("[SCREEN SHARE] active-share-change (re-registered):", {

              state: payload.state,

              userId: payload.userId,

              isLocalUser: payload.userId === selfUserIdRef.current,

            });



            if (!mediaStreamRef.current) {

              console.log(

                "[SCREEN SHARE] ERROR: mediaStreamRef.current is null"

              );

              return;

            }



            if (payload.state === "Active") {

              console.log(

                "[SCREEN SHARE] Starting remote share view for user:",

                payload.userId

              );

              setIsRemoteSharing(true);



              // Wait for remote container to be available

              setTimeout(() => {

                if (!remoteShareContainerRef.current) {

                  console.log(

                    "[SCREEN SHARE] ERROR: Remote canvas ref is null"

                  );

                  return;

                }



                try {

                  console.log(

                    "[SCREEN SHARE] Remote canvas element:",

                    remoteShareContainerRef.current

                  );

                  mediaStreamRef.current.startShareView(

                    remoteShareContainerRef.current,

                    payload.userId

                  );

                  console.log(

                    "[SCREEN SHARE] Remote share view started successfully"

                  );

                  addNotification(

                    `Screen sharing started by ${payload.userId}`

                  );

                } catch (error) {

                  console.log(

                    "[SCREEN SHARE] Error starting remote share view:",

                    error

                  );

                }

              }, 100);

            } else if (payload.state === "Inactive") {

              console.log("[SCREEN SHARE] Stopping remote share view");

              setIsRemoteSharing(false);



              try {

                mediaStreamRef.current.stopShareView();

                console.log(

                  "[SCREEN SHARE] Remote share view stopped successfully"

                );

                addNotification("Screen sharing stopped");

              } catch (error) {

                console.log(

                  "[SCREEN SHARE] Error stopping remote share view:",

                  error

                );

              }

            }

          });

        }

      });



      console.log(`🔄 handleUserAdded: Updating participants with transformParticipantsWithNames`);

      const allUsers = client.getAllUser();

      console.log(`🔄 handleUserAdded: All users from client:`, allUsers);

      const transformedUsers = transformParticipantsWithNames(allUsers);

      console.log(`🔄 handleUserAdded: Transformed users:`, transformedUsers);

      setParticipants(transformedUsers);

      // Check for duplicates ONLY when OTHER users join (not when current user joins)
      // This prevents false positive duplicate detection when the current user's join event fires
      // Also ensure selfUserIdRef is set before checking duplicates
      const hasOtherUserJoined = payload.some(item => item.userId !== selfUserIdRef.current);
      
      if (hasOtherUserJoined && selfUserIdRef.current) {
        setTimeout(async () => {
          try {
            const duplicateCount = await handleDuplicateParticipants();
            if (duplicateCount > 0) {
              console.log(`🔄 handleUserAdded: Duplicate detected, leaving meeting...`);
            }
          } catch (err) {
            console.error("❌ Error checking duplicates in handleUserAdded:", err);
          }
        }, 1000); // Small delay to ensure the new user is fully added
      }

    };



    // Enhanced user removal handler that properly handles local user removal

    // due to leaveOnPageUnload (refresh/close tab/browser)

    const handleUserRemoved = async (payload) => {

      payload.forEach(async (item) => {

        const isLocalUser = item.userId === selfUserIdRef.current;



        console.log("[USER] User left:", {

          userId: item.userId,

          displayName: item.displayName,

          timestamp: new Date().toISOString(),

          isLocal: isLocalUser,

        });



        // Handle local user removal (due to refresh/close/leaveOnPageUnload)

        if (isLocalUser) {

          console.log(

            "🚫 Local user removed from meeting - handling UI cleanup"

          );



          // Set local user removed state to prevent further interactions

          setLocalUserRemoved(true);



          // Clean up local user's video container

          completeUserRemoval(item.userId);



          // Clean up local media resources

          cleanupCamera(item.userId);



          // Stop screen sharing if active

          if (isSharingScreen && mediaStreamRef.current) {

            try {

              mediaStreamRef.current.stopShareScreen();

              setIsSharingScreen(false);

              setCurrentSharerId(null);

            } catch (err) {

              console.warn(

                "Failed to stop screen sharing during local user removal:",

                err

              );

            }

          }



          // Stop recording if active (for host)

          if (recordingClientRef.current && recordingStatus !== "stopped") {

            try {

              recordingClientRef.current.stopCloudRecording();

              setRecordingStatus("stopped");

            } catch (err) {

              console.warn(

                "Failed to stop recording during local user removal:",

                err

              );

            }

          }



          // Update UI state to reflect local user is no longer in meeting

          setIsAudioOn(false);

          setIsVideoOn(false);

          setIsSharingScreen(false);

          setIsRemoteSharing(false);

          setCurrentSharerId(null);

          setIsAnnotating(false);

          setShowRecordingNotice(false);

          setRecordingStatus("stopped");



          // Clear any active modals

          setShowModals({

            participants: false,

            chat: false,

            info: false,

          });



          // Clear any active confirmations

          setShowEndMeetingConfirm(false);

          setShowLeaveMeetingConfirm(false);



          // Show notification that local user left

          addNotification("You have left the meeting");



          // Navigate to appropriate exit page

          // Check if this was due to page refresh/close (stored in sessionStorage)

          const meetingExitInfo = sessionStorage.getItem("meetingExitInfo");

          if (meetingExitInfo) {

            try {

              const info = JSON.parse(meetingExitInfo);

              const timeDiff = Date.now() - info.timestamp;



              // If refresh happened recently, navigate to meeting-exit

              if (timeDiff < 5000) {

                navigate(

                  `/meeting-exit?meetingId=${encodeURIComponent(

                    info.meetingId

                  )}&userId=${encodeURIComponent(info.userId)}&role=${info.role

                  }`

                );

              } else {

                await redirectToMeetingEnd("user_left");

              }

            } catch (err) {

              console.error("Failed to parse meeting exit info:", err);

              await redirectToMeetingEnd("user_left");

            }

          } else {

            // No stored info, redirect to MeetingRedirect

            await redirectToMeetingEnd("user_left");

          }



          return; // Exit early for local user

        }



        // Handle remote user removal (following Zoom guidance)

        console.log(

          `🚫 Complete removal of remote user: ${item.userId} (${item.displayName})`

        );



        // 1. Remove user from participants list immediately

        setParticipants((prev) => {

          const updated = prev.filter((p) => p.userId !== item.userId);

          console.log(

            `📊 Removed user ${item.userId} from participants list: ${prev.length} → ${updated.length}`

          );

          return transformParticipantsWithNames(updated);

        });



        // 2. Clean up video container directly (following Zoom guidance)

        const container = document.getElementById(`video-${item.userId}`);

        if (container) {

          container.innerHTML = "";

          console.log(`🧹 Cleaned up video container for user: ${item.userId}`);

        }



        // 3. Use the complete user removal function for thorough cleanup

        completeUserRemoval(item.userId);



        // 4. Additional detach video call

        detachVideo(item.userId);



        // 🆕 Clean up active participants map when user is removed
        // This ensures our duplicate tracking stays accurate
        console.log(`🗑️ Cleaning up participant tracking for removed user: ${item.userId}`);

        // Show notification for remote users

        // Use URL parameters directly for notifications (simpler and more reliable)
        let displayName = item.displayName; // Default to SDK displayName

        // If we have URL parameters, use them to map the displayName to actual names
        if (urlParamNames.mentorName && urlParamNames.menteeName) {
          // Check if this is the mentor or mentee based on the displayName (which contains the mentor/mentee ID)
          if (item.displayName === meetingData?.mentorId || item.displayName === userName && userType === "mentor") {
            displayName = urlParamNames.mentorName;
          } else if (item.displayName === meetingData?.menteeId || item.displayName === userName && userType === "mentee") {
            displayName = urlParamNames.menteeName;
          } else {
            // For the other participant, use the opposite role's name
            displayName = userType === "mentor" ? urlParamNames.menteeName : urlParamNames.mentorName;
          }
        }

        console.log(`🔔 User left notification: ${item.userId} (${item.displayName}) -> ${displayName}`);
        console.log(`🔍 Using URL parameters:`, { urlParamNames, userType, displayName });

        addNotification(`${displayName} left the session.`);

      });

    };

    client.on("user-added", handleUserAdded);

    client.on("user-removed", handleUserRemoved);



    // Connection status handling

    client.on("connection-change", async (payload) => {

      console.log("🔗 Connection change:", payload);



      if (payload.state === "Closed") {

        // Only notify if we were actually connected before

        if (client.getCurrentUserInfo()?.userId) {

          // For hosts, this might be a temporary leave (refresh), not a meeting end

          const isTemporaryLeave = isHost && payload.reason !== "ended by host";

          notifyUserLeft(isTemporaryLeave).catch((err) =>

            console.error("failed to notify user left: ", err)

          );

        }

        addNotification(

          payload.reason === "ended by host"

            ? "The host has ended the meeting."

            : `Session ended: ${payload.reason || "Closed by host or network"}`

        );



        // Redirect based on reason

        if (payload.reason === "ended by host") {

          await redirectToMeetingEnd("host_ended");

        } else {

          await redirectToMeetingEnd("meeting_completed");

        }

      } else if (payload.state === "Reconnecting") {

        addNotification(`Reconnecting to session...`);

      } else if (payload.state === "Connected") {

        addNotification(`Connected to session.`);

      } else if (payload.state === "Fail") {

        // Only notify if we were actually connected before

        if (client.getCurrentUserInfo()?.userId) {

          // For hosts, this might be a temporary leave (refresh), not a meeting end

          const isTemporaryLeave = isHost;

          notifyUserLeft(isTemporaryLeave).catch((err) =>

            console.error("Failed to notify user left:", err)

          );

        }



        addNotification(

          `Session failed: ${payload.reason || payload.errorCode}`

        );

        await redirectToMeetingEnd("meeting_completed");

      }

    });



    // Device plug/unplug and permission changes

    client.on("device-change", fetchDevices);

    client.on("device-permission-change", (payload) => {

      addNotification(`${payload.name} permission is ${payload.state}`);

      if (payload.state === "denied") {

        setMediaWarningMessage(

          `Access to your microphone or camera is blocked.\n\nplease click \"Allow\" in the permission popup at the top of your browser.\n\nIf you don't see the popup:\n\nClick the 🔒 lock icon next to the address bar\nGo to Site settings → Permissions\nSet Camera and Microphone to Allow\n\nTo apply the settings reload the page.`

        );

        setShowMediaWarning(true);

      }

    });



    // Media failure handling

    client.on("active-media-failed", (payload) => {

      const message = payload.message || payload.code || "Unknown media error";

      console.error("Active media failed:", payload);

      // Don't show notification to avoid disrupting user experience
      // addNotification(`Media error: ${message}`);

      // Try to automatically recover from media failures
      const handleMediaRecovery = async () => {
        try {
          // Get available devices
          const devices = await ZoomVideo.getDevices();
          const mics = devices.filter((d) => d.kind === "audioinput");
          const speakers = devices.filter((d) => d.kind === "audiooutput");

          // Try to switch to a working device
          if (mics.length > 0 && mediaStreamRef.current) {
            // Find a non-communication device
            const nonCommMic = mics.find(mic =>
              !mic.label.toLowerCase().includes('communication') &&
              !mic.label.toLowerCase().includes('comm')
            ) || mics[0];

            try {
              await mediaStreamRef.current.switchMicrophone(nonCommMic.deviceId);
              setSelectedMic(nonCommMic.deviceId);
              // Auto-recovered microphone info removed for cleaner console
            } catch (micErr) {
              console.error("Failed to auto-recover microphone:", micErr);
            }
          }

          if (speakers.length > 0 && mediaStreamRef.current) {
            // Find a non-communication device
            const nonCommSpeaker = speakers.find(speaker =>
              !speaker.label.toLowerCase().includes('communication') &&
              !speaker.label.toLowerCase().includes('comm')
            ) || speakers[0];

            try {
              await mediaStreamRef.current.switchSpeaker(nonCommSpeaker.deviceId);
              setSelectedSpeaker(nonCommSpeaker.deviceId);
              // Auto-recovered speaker info removed for cleaner console
            } catch (speakerErr) {
              console.error("Failed to auto-recover speaker:", speakerErr);
            }
          }
        } catch (recoveryErr) {
          console.error("Media recovery failed:", recoveryErr);
        }
      };

      // Attempt recovery after a short delay
      setTimeout(handleMediaRecovery, 1000);

      // Only show warning for critical errors that can't be auto-recovered
      if (payload.code && (payload.code === 2001 || payload.code === 2002)) {
        setMediaWarningMessage(
          `We detected an issue with your audio device. We've automatically switched to a compatible device.\n\nIf you continue to have issues, please check your system audio settings.`
        );
        setShowMediaWarning(true);
      }

    });



    // Audio/video state changes

    client.on("current-audio-change", (payload) => {

      if (payload.action === "Leave") {

        addNotification(`Audio ended: ${payload.source}`);

      } else if (payload.action === "Muted") {

        addNotification(`Audio muted: ${payload.source}`);

        // Show warning for system-level mute

        if (payload.source && payload.source.includes("system")) {

          setMediaWarningMessage(

            `Your microphone has been muted by the system.\n\nPlease check your system audio settings and unmute your microphone.`

          );

          setShowMediaWarning(true);

        }

      }

    });



    // Auto-play audio failure

    client.on("auto-play-audio-failed", () => {

      addNotification(

        `Audio playback blocked. Click anywhere to resume audio.`

      );

    });



    // Network quality indicator

    client.on("network-quality-change", (payload) => {

      // Convert network quality levels to numeric values for consistent rendering
      const getNetworkQualityLevel = (level) => {
        // Handle both string and numeric values from Zoom SDK
        if (typeof level === 'number') {
          return level;
        }

        switch (level) {
          case 'Excellent':
          case 'Good':
          case '4':
            return 4;
          case 'Fair':
          case '3':
            return 3;
          case 'Poor':
          case '2':
            return 2;
          case 'Very Poor':
          case '1':
            return 1;
          default:
            return 0;
        }
      };

      const numericLevel = getNetworkQualityLevel(payload.level);

      setNetworkQuality((prev) => ({

        ...prev,

        [payload.userId]: numericLevel,

      }));



      // Log network quality changes for debugging

      // Network quality info removed for cleaner console



      // If network quality is poor, log it for debugging

      if (payload.level === 'Poor' || payload.level === 'Very Poor') {

        // Poor network quality info removed for cleaner console

      }

    });



    // Add connection state monitoring

    client.on("connection-change", async (payload) => {

      // Connection state info removed for cleaner console



      if (payload.state === 'Reconnecting') {

        // Reconnection attempt info removed for cleaner console

        addNotification('Reconnecting to meeting...');

      } else if (payload.state === 'Connected') {

        // Successfully connected info removed for cleaner console

        addNotification('Connected to meeting');

      } else if (payload.state === 'Disconnected') {

        // Disconnected info removed for cleaner console

        addNotification('Disconnected from meeting');

      }

    });



    // Dynamic video aspect ratio

    client.on("video-aspect-ratio-change", (payload) => {

      aspectRatioRefs.current[payload.userId] = payload.aspectRatio;

      // Optionally, force a re-render

      // Removed notification for aspect ratio change

      // addNotification(`Aspect ratio changed for user ${payload.userId}`);

    });



    return () => {

      // Clean up screen sharing elements

      cleanupScreenShareElements();



      // Clean up all video containers immediately

      Object.keys(videoContainerRefs.current).forEach((userId) => {

        if (videoContainerRefs.current[userId]) {

          console.log(

            `🧹 Cleaning up video container on unmount for user: ${userId}`

          );

          videoContainerRefs.current[userId].innerHTML = "";

        }

      });

      videoContainerRefs.current = {};



      // Clean up camera resources

      cleanupCamera(selfUserIdRef.current);



      if (clientRef.current) {

        clientRef.current.leave();

      }

      cleanup();

      client.off("user-added", handleUserAdded);

      client.off("user-removed", handleUserRemoved);

      client.off("connection-change");

      client.off("device-change");

      client.off("device-permission-change");

      client.off("active-media-failed");

      client.off("current-audio-change");

      client.off("user-updated");

      client.off("auto-play-audio-failed");

      client.off("network-quality-change");

      client.off("video-aspect-ratio-change");



      // Clean up screen sharing event handlers

      client.off("share-content-started", handleShareStarted);

      client.off("share-content-stopped", handleShareStopped);

      client.off("active-share-change", handleActiveShareChange);

      client.off("passively-stop-share");



      // Clean up error handling event listeners

      client.off("device-permission-change");

      client.off("active-media-failed");

      client.off("current-audio-change");

      client.off("auto-play-audio-failed");



      // Clean up browser screen sharing handlers

      cleanupBrowserScreenShareHandlers();



      // Clean up periodic check interval

      if (screenShareCheckInterval) {

        clearInterval(screenShareCheckInterval);

      }

    };

  }, []);



  const toggleAudio = useCallback(async () => {

    console.log(

      "🎤 Toggle audio clicked, mediaStreamRef:",

      !!mediaStreamRef.current,

      "isAudioOn:",

      isAudioOn

    );

    if (mediaStreamRef.current) {

      try {

        if (isAudioOn) {

          console.log("🎤 Muting audio...");

          await mediaStreamRef.current.muteAudio();

        } else {

          console.log("🎤 Unmuting audio...");

          await mediaStreamRef.current.unmuteAudio();

        }

        setIsAudioOn(!isAudioOn);

        console.log("🎤 Audio state updated to:", !isAudioOn);

        // Force update participants to reflect local audio state

        if (clientRef.current) setParticipants(transformParticipantsWithNames(clientRef.current.getAllUser()));

        // Manually emit peer-audio-state-change for local user to update UI globally

        if (clientRef.current) {

          const event = new Event("peer-audio-state-change");

          clientRef.current.emit &&

            clientRef.current.emit("peer-audio-state-change", {

              userId: selfUserIdRef.current,

              action: isAudioOn ? "Muted" : "Unmuted",

            });

        }

      } catch (error) {

        console.error("Toggle audio error:", error);

        // Show warning instead of throwing error

        setMediaWarningMessage(

          `Media error: Your mic is muted in system or browser settings. Please open your settings to unmute and adjust the level.`

        );

        setShowMediaWarning(true);

      }

    } else {

      console.error("🎤 mediaStreamRef.current is null - cannot toggle audio");

    }

  }, [isAudioOn]);



  const toggleVideo = useCallback(async () => {

    console.log(

      "📹 Toggle video clicked, mediaStreamRef:",

      !!mediaStreamRef.current,

      "isVideoOn:",

      isVideoOn

    );

    if (!mediaStreamRef.current) {

      console.error("📹 mediaStreamRef.current is null - cannot toggle video");

      return;

    }

    try {

      if (isVideoOn) {

        console.log("📹 Stopping video...");

        await mediaStreamRef.current.stopVideo();

        await detachVideo(selfUserIdRef.current);

        setIsVideoOn(false);

        console.log("📹 Video stopped");

      } else {

        console.log("📹 Starting video...");



        // Apply virtual background if set (like MeetingPage.jsx)
        // Skip virtual backgrounds on mobile devices
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        let vbOptions = {};

        if (!isMobile) {
          if (bgMode === "blur") {

            vbOptions = { virtualBackground: { imageUrl: "blur" } };

          } else if (bgMode === "image") {

            vbOptions = {

              virtualBackground: { imageUrl: "/lib/vb-resource/background.jpg" },

            };

          }
        } else {
          console.log("📱 Mobile device detected - skipping virtual background");
        }



        try {

          // Show the video container BEFORE starting video and attaching

          const localContainer = videoContainerRefs.current[selfUserIdRef.current];

          if (localContainer) {

            localContainer.style.display = "flex";

            console.log("📹 Showing local video container (camera turning on)");

          }



          await mediaStreamRef.current.startVideo(vbOptions);

          await attachVideo(selfUserIdRef.current);

          setIsVideoOn(true);



          console.log("📹 Video started with background:", bgMode);

        } catch (vbErr) {

          if (vbErr.message?.includes("virtual background")) {

            console.warn("Virtual background not supported, falling back to normal video");

            // Show the video container BEFORE starting video and attaching (fallback)

            const localContainer = videoContainerRefs.current[selfUserIdRef.current];

            if (localContainer) {

              localContainer.style.display = "flex";

              console.log("📹 Showing local video container (camera turning on - fallback)");

            }



            // Fallback to normal video without virtual background

            await mediaStreamRef.current.startVideo();

            await attachVideo(selfUserIdRef.current);

            setIsVideoOn(true);

            setBgMode("none"); // Reset to none since VB failed



            console.log("📹 Video started without virtual background (fallback)");

          } else {

            throw vbErr; // Re-throw if it's not a VB error

          }

        }

      }

      // Force update participants to reflect local video state

      if (clientRef.current) setParticipants(transformParticipantsWithNames(clientRef.current.getAllUser()));

      // Manually emit peer-video-state-change for local user to update UI globally

      if (clientRef.current) {

        const event = new Event("peer-video-state-change");

        clientRef.current.emit &&

          clientRef.current.emit("peer-video-state-change", {

            userId: selfUserIdRef.current,

            action: isVideoOn ? "Start" : "Stop",

          });

      }

    } catch (e) {

      console.error("Toggle video error", e);

      // Check if it's a virtual background error on mobile
      const isMobile = /Mobi|Android/i.test(navigator.userAgent);
      const isVirtualBgError = e.message?.includes("virtual background") || 
                               e.message?.includes("SharedArrayBuffer") ||
                               e.reason?.includes("virtual background");

      if (isMobile && isVirtualBgError) {
        setError("Video features are limited on mobile devices. Please try again without virtual background.");
      } else {
        setError("Failed to toggle video: " + (e.reason || e.message));
      }

    }

  }, [isVideoOn, attachVideo, detachVideo, bgMode]);



  // const handleStartAnnotation = async () => {

  //   try {

  //     if (!mediaStreamRef.current) return;

  //     await mediaStreamRef.current.startAnnotation();

  //     const annotationController =

  //       mediaStreamRef.current.getAnnotationController();

  //     await annotationController.setToolType(1); // pen

  //     await annotationController.setToolWidth(8);

  //     setIsAnnotating(true);

  //     addNotification("Annotation started");

  //   } catch (err) {

  //     console.error("Failed to start annotation", err);

  //     setError(

  //       "Failed to start annotation: " + (err.message || "Unknown error")

  //     );

  //   }

  // };



  // const stopAnnotation = async () => {

  //   if (!mediaStreamRef.current) return;

  //   try {

  //     await mediaStreamRef.current.stopAnnotation();

  //     setIsAnnotating(false);

  //     addNotification("Annotation stopped");

  //   } catch (err) {

  //     console.error("Failed to stop annotation", err);

  //   }

  // };



  const handleBgChange = async (e) => {

    const newBgMode = e.target.value;

    console.log("🎨 Background changed to:", newBgMode);



    if (!mediaStreamRef.current) return;



    try {

      // Stop video to change background (like MeetingPage.jsx)

      await mediaStreamRef.current.stopVideo();



      let vbOptions = {};

      if (newBgMode === "blur") {

        vbOptions = { virtualBackground: { imageUrl: "blur" } };

      } else if (newBgMode === "image") {

        vbOptions = {

          virtualBackground: { imageUrl: "/lib/vb-resource/background.jpg" },

        };

      }



      // Show the video container BEFORE starting video

      const localContainer = videoContainerRefs.current[selfUserIdRef.current];

      if (localContainer) {

        localContainer.style.display = "flex";

        console.log("📹 Showing local video container (background changing)");

      }



      await mediaStreamRef.current.startVideo(vbOptions);

      setBgMode(newBgMode);

      setIsVideoOn(true);



      // Add notification for background change

      addNotification(`Virtual background changed to ${newBgMode}`);



      // Re-attach video after changing background

      await attachVideo(selfUserIdRef.current);

    } catch (err) {

      console.error("Error updating VB:", err);



      if (err.message?.includes("virtual background")) {

        console.warn("Virtual background not supported, falling back to normal video");

        setError("Virtual background not supported, using normal video.");

        // Show the video container BEFORE starting video (fallback)

        const localContainer = videoContainerRefs.current[selfUserIdRef.current];

        if (localContainer) {

          localContainer.style.display = "flex";

          console.log("📹 Showing local video container (background change fallback)");

        }



        // Fallback to normal video without virtual background

        try {

          await mediaStreamRef.current.startVideo();

          await attachVideo(selfUserIdRef.current);

          setIsVideoOn(true);

          setBgMode("none"); // Reset to none since VB failed

        } catch (fallbackErr) {

          setError("Failed to start video: " + (fallbackErr.reason || fallbackErr.message));

        }

      } else {

        setError("Failed to switch background.");

        // If it fails, try to restart video without VB

        if (!isVideoOn) {

          // Show the video container BEFORE starting video (final fallback)

          const localContainer = videoContainerRefs.current[selfUserIdRef.current];

          if (localContainer) {

            localContainer.style.display = "flex";

            console.log("📹 Showing local video container (final fallback)");

          }



          await mediaStreamRef.current.startVideo();

          await attachVideo(selfUserIdRef.current);

          setIsVideoOn(true);

        }

      }

    }

  };

  // Helper: Use Zoom SDK's built-in method to detect WebCodecs support
  // Removed custom detection - using SDK's isStartShareScreenWithVideoElement() instead



  // Centralized cleanup function for screen sharing

  const stopScreenShareCleanup = () => {

    console.log("🧹 Cleaning up screen share...");



    // Stop the screen sharing in the Zoom SDK

    if (mediaStreamRef.current) {

      try {

        mediaStreamRef.current.stopShareScreen();

      } catch (error) {

        console.log("[SCREEN SHARE] Error stopping share screen:", error);

      }

    }



    // Clean up video element

    if (shareRenderVideoRef.current) {

      shareRenderVideoRef.current.srcObject = null;

      shareRenderVideoRef.current.style.display = "none";

    }



    // Clean up canvas element

    if (shareCanvasRef.current) {

      const ctx = shareCanvasRef.current.getContext("2d");

      if (ctx) {

        ctx.clearRect(0, 0, shareCanvasRef.current.width, shareCanvasRef.current.height);

      }

      shareCanvasRef.current.style.display = "none";

    }



    // CRITICAL: Clean up the video element with ID 'my-screen-share-content-video'

    // This prevents black tiles from remaining when screen share is stopped

    const screenShareVideoElementInitial = document.getElementById('my-screen-share-content-video');

    if (screenShareVideoElementInitial) {

      console.log("[SCREEN SHARE] Cleaning up black tile video element");

      // Stop any video tracks

      if (screenShareVideoElementInitial.srcObject) {

        const tracks = screenShareVideoElementInitial.srcObject.getTracks();

        tracks.forEach(track => track.stop());

        screenShareVideoElementInitial.srcObject = null;

      }

      // Hide the element instead of removing it to allow reuse

      screenShareVideoElementInitial.style.display = "none";

    }



    // Also clean up any other potential screen share video elements

    const allScreenShareElements = document.querySelectorAll('[id*="screen-share"], [id*="share-content"]');

    allScreenShareElements.forEach(element => {

      if (element.tagName === 'VIDEO' && element.srcObject) {

        const tracks = element.srcObject.getTracks();

        tracks.forEach(track => track.stop());

        element.srcObject = null;

        // Hide the element instead of removing it to allow reuse

        element.style.display = "none";

      }

    });



    // Update state - use functional updates to ensure we get the latest state

    setIsSharingScreen(prev => {

      console.log("[SCREEN SHARE] Setting isSharingScreen from", prev, "to false");

      return false;

    });

    setCurrentSharerId(prev => {

      console.log("[SCREEN SHARE] Setting currentSharerId from", prev, "to null");

      return null;

    });

    setIsRemoteSharing(prev => {

      console.log("[SCREEN SHARE] Setting isRemoteSharing from", prev, "to false");

      return false;

    });

    // Immediate UI cleanup - don't wait for timeout

    if (shareRenderVideoRef.current) {

      shareRenderVideoRef.current.style.display = "none";

      shareRenderVideoRef.current.srcObject = null;

    }

    if (shareCanvasRef.current) {

      shareCanvasRef.current.style.display = "none";

      const ctx = shareCanvasRef.current.getContext("2d");

      if (ctx) {

        ctx.clearRect(0, 0, shareCanvasRef.current.width, shareCanvasRef.current.height);

      }

    }

    const screenShareVideoElement = document.getElementById('my-screen-share-content-video');

    if (screenShareVideoElement) {

      screenShareVideoElement.style.display = "none";

      screenShareVideoElement.srcObject = null;

    }

    // Force UI update by ensuring all screen share elements are hidden (with timeout as backup)

    setTimeout(() => {

      if (shareRenderVideoRef.current) {

        shareRenderVideoRef.current.style.display = "none";

        // Also clear any remaining video content

        shareRenderVideoRef.current.srcObject = null;

      }

      if (shareCanvasRef.current) {

        shareCanvasRef.current.style.display = "none";

        // Clear canvas content

        const ctx = shareCanvasRef.current.getContext("2d");

        if (ctx) {

          ctx.clearRect(0, 0, shareCanvasRef.current.width, shareCanvasRef.current.height);

        }

      }

      const screenShareVideoElementBackup = document.getElementById('my-screen-share-content-video');

      if (screenShareVideoElementBackup) {

        screenShareVideoElementBackup.style.display = "none";

        // Clear any remaining video content

        screenShareVideoElementBackup.srcObject = null;

      }

      // Also check for any other video elements that might be showing screen share content

      const allVideoElements = document.querySelectorAll('video');

      allVideoElements.forEach(video => {

        if (video.style.display !== 'none' && (video.id.includes('screen-share') || video.id.includes('share-content'))) {

          console.log("[SCREEN SHARE] Hiding video element:", video.id);

          video.style.display = 'none';

          video.srcObject = null;

        }

      });

      // Also check for any canvas elements that might be showing screen share content

      const allCanvasElements = document.querySelectorAll('canvas');

      allCanvasElements.forEach(canvas => {

        if (canvas.style.display !== 'none' && (canvas.id.includes('screen-share') || canvas.id.includes('share-content'))) {

          console.log("[SCREEN SHARE] Hiding canvas element:", canvas.id);

          canvas.style.display = 'none';

          // Clear canvas content

          const ctx = canvas.getContext("2d");

          if (ctx) {

            ctx.clearRect(0, 0, canvas.width, canvas.height);

          }

        }

      });

    }, 100);



    // Clean up browser screen sharing handlers (if function exists)

    if (typeof cleanupBrowserScreenShareHandlers === 'function') {

      cleanupBrowserScreenShareHandlers();

    }

    // Clean up additional status check interval

    if (window._screenShareStatusCheckInterval) {

      clearInterval(window._screenShareStatusCheckInterval);

      window._screenShareStatusCheckInterval = null;

    }



    addNotification("Screen sharing stopped");

  };



  // Clean up screen sharing elements (legacy function - now calls centralized cleanup)

  const cleanupScreenShareElements = () => {

    stopScreenShareCleanup();

  };



  // Advanced screen sharing with proper element setup (like MeetingPage.jsx)

  const startScreenShare = async () => {

    console.log(

      "[SCREEN SHARE] handleScreenShare called, isSharingScreen:",

      isSharingScreen

    );



    // Check if someone else is already sharing

    if (isRemoteSharing && !isSharingScreen) {

      console.log("[SCREEN SHARE] ERROR: Someone else is already sharing their screen");

      addNotification("Screen sharing is already in progress by another participant");

      return;

    }



    if (!mediaStreamRef.current) {

      console.log("[SCREEN SHARE] ERROR: mediaStreamRef.current is null");

      return;

    }



    if (!clientRef.current) {

      console.log("[SCREEN SHARE] ERROR: clientRef.current is null");

      return;

    }



    // Debug element availability

    console.log("[SCREEN SHARE] Element refs:", {

      shareRenderVideoRef: !!shareRenderVideoRef.current,

      shareCanvasRef: !!shareCanvasRef.current,

    });



    // Ensure elements are available

    if (!shareRenderVideoRef.current || !shareCanvasRef.current) {

      console.log("[SCREEN SHARE] ERROR: Screen share elements not available");

      console.log(

        "[SCREEN SHARE] shareRenderVideoRef:",

        shareRenderVideoRef.current

      );

      console.log("[SCREEN SHARE] shareCanvasRef:", shareCanvasRef.current);

      setError("Screen share elements not ready. Please try again.");

      return;

    }



    try {

      if (!isSharingScreen) {

        console.log("[SCREEN SHARE] Starting screen share...");



        // Close any open panels (chat, participants, info) before starting screen share

        setShowModals({

          participants: false,

          chat: false,

          info: false,

        });



        const mediaStream = clientRef.current.getMediaStream();



        let stream = null;

        // ✅ Use Zoom SDK's built-in method to determine element type
        if (mediaStream.isStartShareScreenWithVideoElement()) {

          // Use video element for screen sharing

          console.log("[SCREEN SHARE] Using video element (SDK recommendation)");

          // Ensure video element is properly set up

          if (shareRenderVideoRef.current) {

            // Reset any previous state

            shareRenderVideoRef.current.srcObject = null;

            shareRenderVideoRef.current.style.width = "850px";

            shareRenderVideoRef.current.style.height = "720px";

            // Ensure video element has proper attributes

            shareRenderVideoRef.current.autoplay = true;

            shareRenderVideoRef.current.playsInline = true;

            shareRenderVideoRef.current.muted = false;

            // Small delay to ensure element is ready

            await new Promise((resolve) => setTimeout(resolve, 100));

          }

          stream = await mediaStream.startShareScreen(shareRenderVideoRef.current);

          shareRenderVideoRef.current.style.display = "block";

          shareCanvasRef.current.style.display = "none";

        } else {

          // Use canvas element for screen sharing

          console.log("[SCREEN SHARE] Using canvas element (SDK recommendation)");

          // Ensure canvas element is properly set up

          if (shareCanvasRef.current) {

            // Clear any previous content

            const ctx = shareCanvasRef.current.getContext("2d");

            if (ctx) {

              ctx.clearRect(0, 0, shareCanvasRef.current.width, shareCanvasRef.current.height);

            }

            shareCanvasRef.current.width = 1280;

            shareCanvasRef.current.height = 720;

            // Small delay to ensure element is ready

            await new Promise((resolve) => setTimeout(resolve, 100));

          }

          stream = await mediaStream.startShareScreen(shareCanvasRef.current);

          shareCanvasRef.current.style.display = "block";

          shareRenderVideoRef.current.style.display = "none";

        }



        // ✅ Catch browser stop (the "Stop sharing" button)

        console.log("[SCREEN SHARE] Stream object:", stream);

        if (stream && stream.getVideoTracks) {

          const tracks = stream.getVideoTracks();

          console.log("[SCREEN SHARE] Video tracks:", tracks);

          if (tracks && tracks.length > 0) {

            const track = tracks[0];

            track.onended = () => {

              console.log("🛑 Browser stop detected via track.onended, cleaning up share...");

              stopScreenShareCleanup();

            };

            console.log("[SCREEN SHARE] Track onended listener added");

          }

        } else {

          console.log("[SCREEN SHARE] No stream or getVideoTracks method available");

        }



        setIsSharingScreen(true);

        setCurrentSharerId(selfUserIdRef.current);

        addNotification("Screen sharing started");



        // Set up browser screen sharing handlers for the sharer

        setTimeout(() => {

          if (isSharingScreen && currentSharerId === selfUserIdRef.current) {

            setupBrowserScreenShareHandlers();

            // Add additional detection for browser stop sharing
            const checkScreenShareStatus = () => {
              if (isSharingScreen && currentSharerId === selfUserIdRef.current) {
                try {
                  const isActuallySharing = mediaStreamRef.current?.isSharingScreen;
                  const hasActiveTracks = stream?.getVideoTracks()?.some(track => track.readyState === 'live');

                  // Check if tracks are ended (browser stopped sharing)
                  const tracksEnded = stream?.getVideoTracks()?.some(track => track.readyState === 'ended');

                  if (!isActuallySharing || !hasActiveTracks || tracksEnded) {
                    console.log("[SCREEN SHARE] Browser stop detected via visibility/status check", {
                      isActuallySharing,
                      hasActiveTracks,
                      tracksEnded,
                      trackStates: stream?.getVideoTracks()?.map(track => track.readyState)
                    });
                    stopScreenShareCleanup();
                    return;
                  }
                } catch (error) {
                  console.log("[SCREEN SHARE] Error checking screen share status:", error);
                }
              }
            };

            // Check immediately and then periodically
            checkScreenShareStatus();
            const statusCheckInterval = setInterval(checkScreenShareStatus, 500);

            // Store interval for cleanup
            window._screenShareStatusCheckInterval = statusCheckInterval;

          }

        }, 100);



        // Add a periodic check to detect when screen sharing has stopped

        // This is a fallback in case the track.onended event doesn't fire

        const screenShareCheckInterval = setInterval(() => {

          // Use a ref to get the current state value instead of stale closure
          const currentIsSharingScreen = isSharingScreen;
          const currentSharerId = selfUserIdRef.current;

          if (currentIsSharingScreen && currentSharerId === selfUserIdRef.current) {

            try {

              // Check multiple conditions to detect if screen sharing has stopped
              const isActuallySharing = mediaStreamRef.current?.isSharingScreen;
              const hasActiveTracks = stream?.getVideoTracks()?.some(track => track.readyState === 'live');
              const tracksEnded = stream?.getVideoTracks()?.some(track => track.readyState === 'ended');

              if (!isActuallySharing || !hasActiveTracks || tracksEnded) {

                console.log("[SCREEN SHARE] Periodic check detected screen sharing ended", {
                  isActuallySharing,
                  hasActiveTracks,
                  tracksEnded,
                  trackStates: stream?.getVideoTracks()?.map(track => track.readyState)
                });

                clearInterval(screenShareCheckInterval);

                stopScreenShareCleanup();

              }

            } catch (error) {

              console.log("[SCREEN SHARE] Periodic check error - screen sharing may have ended", error);

              clearInterval(screenShareCheckInterval);

              stopScreenShareCleanup();

            }

          } else {

            clearInterval(screenShareCheckInterval);

          }

        }, 1000); // Check every 1 second for faster detection

      } else {

        console.log("[SCREEN SHARE] Stopping screen share via our button...");

        // Manually trigger the passively-stop-share event to ensure consistent cleanup
        // This ensures both browser stop and our button use the same cleanup path
        try {
          // Trigger the same event that browser stop would trigger
          client.emit("passively-stop-share");
        } catch (error) {
          console.log("[SCREEN SHARE] Could not emit passively-stop-share event:", error);
          // Fallback to direct cleanup if event emission fails
          stopScreenShareCleanup();
        }

      }

    } catch (err) {

      console.log("[SCREEN SHARE] Error:", {

        reason: err?.reason,

        errorCode: err?.errorCode,

        message: err?.message,

        name: err?.name,

      });



      // Always reset the sharing state using centralized cleanup

      stopScreenShareCleanup();



      if (err?.reason === "user deny screen share" || err?.errorCode === 6200) {

        console.log("[SCREEN SHARE] User cancelled screen share");

        addNotification("Screen sharing cancelled");

        return;

      }



      setError(

        "Failed to start screen sharing: " + (err.reason || err.message)

      );

    }

  };



  // Recording control functions (host only)

  // 🆕 Automatic Recording Control

  const startAutomaticRecording = async () => {

    if (!recordingClientRef.current || !isHost) return;



    try {

      const res = await recordingClientRef.current.startCloudRecording();

      if (res === "") {

        setRecordingState("recording");

        setRecordingStatus("recording");

        setShowRecordingNotice(true);

        // Show professional recording notification to both host and participants

        addNotification("🔴 LIVE - This meeting is being recorded");

        // Play recording beep sound for both host and participants

        playRecordingBeep();



        // Broadcast recording status to all participants via chat

        try {

          const client = clientRef.current;

          if (client) {

            const chatClient = client.getChatClient();

            if (chatClient) {

              await chatClient.sendToAll("🔴 LIVE - This meeting is being recorded");

            }

          }

        } catch (err) {

          console.warn("Could not broadcast recording status:", err);

        }



        console.log("✅ Automatic recording started");

      }

    } catch (err) {

      console.error("❌ Failed to start automatic recording:", err);

      // Don't show error to user, just log it

    }

  };



  const pauseAutomaticRecording = async () => {

    if (!recordingClientRef.current || !isHost) return;

    try {

      const res = await recordingClientRef.current.pauseCloudRecording();

      if (res === "") {

        setRecordingState("paused");

        setRecordingStatus("paused");

        setShowRecordingNotice(false);



        // Show professional recording pause notification

        addNotification("⏸️ Recording paused — waiting for participant");

        playRecordingBeep();



        // Broadcast recording pause status to all participants via chat

        try {

          const client = clientRef.current;

          if (client && client.getChatClient) {

            const chatClient = client.getChatClient();

            if (chatClient) {

              await chatClient.sendToAll("⏸️ Recording paused — waiting for participant");

            }

          }

        } catch (chatErr) {

          console.warn("Failed to broadcast recording pause via chat:", chatErr);

        }



        console.log("⏸️ Automatic recording paused");

      }

    } catch (err) {

      console.error("❌ Failed to pause automatic recording:", err);

    }

  };



  const resumeAutomaticRecording = async () => {

    if (!recordingClientRef.current || !isHost) return;

    try {

      const res = await recordingClientRef.current.resumeCloudRecording();

      if (res === "") {

        setRecordingState("recording");

        setRecordingStatus("recording");

        setShowRecordingNotice(true);



        // Show professional recording resume notification

        addNotification("🔴 Recording resumed");

        playRecordingBeep();



        // Broadcast recording resume status to all participants via chat

        try {

          const client = clientRef.current;

          if (client && client.getChatClient) {

            const chatClient = client.getChatClient();

            if (chatClient) {

              await chatClient.sendToAll("🔴 Recording resumed");

            }

          }

        } catch (chatErr) {

          console.warn("Failed to broadcast recording resume via chat:", chatErr);

        }



        console.log("🔴 Automatic recording resumed");

      }

    } catch (err) {

      console.error("❌ Failed to resume automatic recording:", err);

    }

  };



  const stopAutomaticRecording = async () => {

    if (!recordingClientRef.current || !isHost) return;

    try {

      const res = await recordingClientRef.current.stopCloudRecording();

      if (res === "") {

        setRecordingState("stopped");

        setRecordingStatus("stopped");

        setShowRecordingNotice(false);

        // Show professional recording stop notification to both host and participants

        addNotification("⏹️ Recording has stopped");

        // Play recording stop beep sound for both host and participants

        playRecordingBeep();



        // Broadcast recording stop status to all participants via chat

        try {

          const client = clientRef.current;

          if (client) {

            const chatClient = client.getChatClient();

            if (chatClient) {

              await chatClient.sendToAll("⏹️ Recording has stopped");

            }

          }

        } catch (err) {

          console.warn("Could not broadcast recording stop status:", err);

        }



        console.log("✅ Automatic recording stopped");

      }

    } catch (err) {

      console.error("❌ Failed to stop automatic recording:", err);

    }

  };



  // 🆕 Monitor participant changes for automatic recording with pause/resume

  useEffect(() => {

    if (participants.length > 0) {

      const hasMentor = participants.some(p => p.role === 'host' || p.isHost);

      const hasMentee = participants.some(p => p.role === 'attendee' || !p.isHost);

      const participantCount = participants.length;



      console.log(`👥 Participant monitoring: ${participantCount} participants, mentor: ${hasMentor}, mentee: ${hasMentee}, recordingState: ${recordingState}`);



      if (hasMentor && hasMentee && recordingState === "idle") {

        console.log("✅ Both mentor and mentee joined - starting automatic recording");

        if (isHost) {

          // Only host starts the actual recording

          startAutomaticRecording();

        } else {

          // For participants, just update their local state to show recording indicator

          setRecordingState("recording");

          setRecordingStatus("recording");

          setShowRecordingNotice(true);

          addNotification("🔴 LIVE - This meeting is being recorded");

          playRecordingBeep();

        }

      } else if ((!hasMentor || !hasMentee) && recordingState === "recording") {

        // Either mentor or mentee left - pause recording

        console.log("⏸️ Mentor or mentee left - pausing automatic recording");

        if (isHost) {

          // Only host pauses the actual recording

          pauseAutomaticRecording();

        } else {

          // For participants, just update their local state to show paused indicator

          setRecordingState("paused");

          setRecordingStatus("paused");

          setShowRecordingNotice(false);

          addNotification("⏸️ Recording paused — waiting for participant");

          playRecordingBeep();

        }

      } else if (hasMentor && hasMentee && recordingState === "paused") {

        // Both mentor and mentee are back - resume recording

        console.log("🔴 Both mentor and mentee back - resuming automatic recording");

        if (isHost) {

          // Only host resumes the actual recording

          resumeAutomaticRecording();

        } else {

          // For participants, just update their local state to show recording indicator

          setRecordingState("recording");

          setRecordingStatus("recording");

          setShowRecordingNotice(true);

          addNotification("🔴 Recording resumed");

          playRecordingBeep();

        }

      }

    }

  }, [participants, recordingState, isHost]);



  // Function to play recording beep sound (similar to Zoom)

  const playRecordingBeep = () => {

    try {

      // Create audio context for beep sound

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      const oscillator = audioContext.createOscillator();

      const gainNode = audioContext.createGain();



      oscillator.connect(gainNode);

      gainNode.connect(audioContext.destination);



      // Set beep properties (800Hz, short duration - similar to Zoom)

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);

      oscillator.type = 'sine';



      // Fade in/out for smooth sound with reduced volume

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);

      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1); // Reduced from 0.3 to 0.1

      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);



      oscillator.start(audioContext.currentTime);

      oscillator.stop(audioContext.currentTime + 0.3);



      // Clean up audio context after beep

      setTimeout(() => {

        audioContext.close();

      }, 500);

    } catch (err) {

      console.warn("Could not play recording beep:", err);

    }

  };



  // Function to redirect to MeetingRedirect with appropriate data

  const redirectToMeetingEnd = async (endReason) => {

    // Get meeting data from context or props

    console.log("🔄 Starting redirect to meeting end. SessionName:", sessionName);

    // Only fetch redirect link from DB when host explicitly ends the meeting

    const redirectLink = (endReason === "host_ended" && sessionName) ? await getMeetingRedirectLink(sessionName) : null;

    console.log("🔗 Retrieved redirect link:", redirectLink);



    const meetingData = {

      redirectLink: redirectLink,

      meetingStatus: "completed",

      endReason: endReason,

      meetingId: sessionName,

      userId: userName,

      role: role,

      userRole: role,  // Add userRole for MeetingRedirect component

      userType: userType  // Add userType for MeetingRedirect component

    };



    console.log("🔄 Redirecting to meeting end page with data:", meetingData);

    // Navigate to MeetingRedirect with meeting data

    navigate("/meeting-redirect", {

      state: { meetingData }

    });

  };



  // Helper function to get redirect link from meeting data

  const getMeetingRedirectLink = async (meetingId) => {

    if (!meetingId) return null;



    try {

      // Fetch meeting info from backend to get redirectLink

      const response = await axios.get(

        config.getApiUrl(

          `${config.API_ENDPOINTS.GET_MEETING_INFO}/${meetingId}/${userName}`

        )

      );



      console.log("🔗 Meeting redirect API response:", response.data);

      if (response.data?.IsSuccess && response.data?.Data?.redirectLink) {
        console.log("✅ Found redirect link:", response.data.Data.redirectLink);
        return response.data.Data.redirectLink;
      } else {
        console.log("❌ No redirect link found in response. Available fields:", Object.keys(response.data?.Data || {}));
      }

      return null;

    } catch (err) {

      console.error("Failed to fetch meeting redirect link:", err);

      return null;

    }

  };



  const handleEndMeeting = async () => {

    setShowEndMeetingConfirm(true);

  };



  const confirmEndMeeting = async () => {

    setShowEndMeetingConfirm(false);



    try {

      // Simple cleanup like MeetingPage.jsx

      await cleanupCamera(selfUserIdRef.current);



      // Stop screen sharing if active

      if (isSharingScreen && mediaStreamRef.current) {

        try {

          await mediaStreamRef.current.stopShareScreen();

          setIsSharingScreen(false);

        } catch (err) {

          console.warn("Failed to stop screen sharing:", err);

        }

      }



      // Stop recording if active

      if (recordingClientRef.current && recordingStatus !== "stopped") {

        try {

          await recordingClientRef.current.stopCloudRecording();

          setRecordingStatus("stopped");

        } catch (err) {

          console.warn("Failed to stop recording:", err);

        }

      }



      // Leave the session (this will end it for all participants if host)

      if (clientRef.current) {

        await clientRef.current.leave(true);

      }



      // Clean up zoom context

      cleanup();



      // Notify backend that meeting ended

      await notifyMeetingEnd();



      addNotification("Meeting ended successfully");



      // Redirect to MeetingRedirect instead of meeting-exit

      await redirectToMeetingEnd("host_ended");

    } catch (err) {

      console.error("Failed to end meeting:", err);



      // Even if cleanup fails, try to leave and navigate

      try {

        if (clientRef.current) {

          await clientRef.current.leave(true);

        }

        cleanup();

      } catch (fallbackErr) {

        console.error("Fallback leave failed:", fallbackErr);

      }



      // Redirect anyway

      await redirectToMeetingEnd("host_ended");

    }

  };



  const handleLeave = async () => {

    if (clientRef.current) {

      try {

        // notify backend that user is leaving (not temporary)

        await notifyUserLeft(false);



        await clientRef.current.leave(); // Participant leaves session

      } catch (err) {

        setError("Failed to leave meeting.");

      }

    }



    // Redirect to MeetingRedirect instead of meeting-exit

    await redirectToMeetingEnd("user_left");

  };



  const confirmLeaveSession = async () => {

    setShowLeaveMeetingConfirm(false);



    try {

      // Simple cleanup like MeetingPage.jsx

      await cleanupCamera(selfUserIdRef.current);



      // Stop screen sharing if active

      if (isSharingScreen && mediaStreamRef.current) {

        try {

          await mediaStreamRef.current.stopShareScreen();

          setIsSharingScreen(false);

        } catch (err) {

          console.warn("Failed to stop screen sharing:", err);

        }

      }



      // Leave the session

      if (clientRef.current) {

        await clientRef.current.leave();

      }



      // Clean up zoom context

      cleanup();



      addNotification("You have left the meeting");



      // Redirect to MeetingRedirect

      redirectToMeetingEnd("user_left");

    } catch (err) {

      console.error("Error leaving session:", err);



      // Even if cleanup fails, try to leave and navigate

      try {

        if (clientRef.current) {

          await clientRef.current.leave();

        }

        cleanup();

      } catch (fallbackErr) {

        console.error("Fallback leave failed:", fallbackErr);

      }



      // Redirect anyway

      redirectToMeetingEnd("user_left");

    }

  };



  // Centralized modal management (like MeetingPage.jsx)

  const handleModal = (modal, state) => {

    if (state) {

      // If opening a modal, close all other modals first

      setShowModals({

        participants: false,

        chat: false,

        info: false,

        [modal]: true,

      });



      // Clear unread chat count when opening chat

      if (modal === "chat") {

        setUnreadChatCount(0);

        console.log("📬 Cleared unread chat count");

      }

    } else {

      // If closing a modal, just close that specific one

      setShowModals((prev) => ({ ...prev, [modal]: false }));



      // Clear unread chat count when closing chat

      if (modal === "chat") {

        console.log("📬 Chat panel closed");

      }

    }

  };



  // Helper function to get dynamic heading based on modal type

  const getModalHeading = (modalType) => {

    switch (modalType) {

      case 'info':

        return 'Info';

      case 'participants':

        return `Participants (${participants.length})`;

      case 'chat':

        return 'Chat';

      default:

        return 'Panel';

    }

  };



  // Device switching functions (like MeetingPage.jsx)

  const switchCamera = async (deviceId) => {

    if (mediaStreamRef.current) {

      try {

        await mediaStreamRef.current.switchCamera(deviceId);

        setSelectedCamera(deviceId);

        addNotification("Camera switched successfully");

      } catch (err) {

        console.error("Failed to switch camera:", err);

        setError("Failed to switch camera");

      }

    }

  };



  // Helper function to validate if a device is problematic
  const isProblematicDevice = (deviceLabel) => {
    const label = deviceLabel.toLowerCase();
    return label.includes('communication') || label.includes('comm') ||
      label.includes('default -') || label.includes('communications -');
  };

  // Helper function to find a safe alternative device
  const findSafeDevice = (devices, currentDeviceId) => {
    // First try to find a non-communication device
    const nonCommDevice = devices.find(device =>
      device.deviceId !== currentDeviceId && !isProblematicDevice(device.label)
    );

    if (nonCommDevice) return nonCommDevice;

    // If no non-comm device found, return the first available device
    return devices.find(device => device.deviceId !== currentDeviceId) || devices[0];
  };

  const switchMicrophone = async (deviceId) => {

    if (mediaStreamRef.current) {

      try {

        // Store previous device for fallback
        const previousDevice = selectedMic;

        // Check if the selected device is problematic
        const devices = await ZoomVideo.getDevices();
        const mics = devices.filter((d) => d.kind === "audioinput");
        const selectedDevice = mics.find(d => d.deviceId === deviceId);

        if (selectedDevice && isProblematicDevice(selectedDevice.label)) {
          console.log("Detected problematic communication device, finding alternative");
          const safeDevice = findSafeDevice(mics, deviceId);
          if (safeDevice) {
            deviceId = safeDevice.deviceId;
            console.log("Switching to safe device:", safeDevice.label);
          }
        }

        // Attempt to switch microphone with timeout
        const switchPromise = mediaStreamRef.current.switchMicrophone(deviceId);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Device switch timeout')), 5000)
        );

        await Promise.race([switchPromise, timeoutPromise]);

        setSelectedMic(deviceId);

        addNotification("Microphone switched successfully");

      } catch (err) {

        console.error("Failed to switch microphone:", err);

        // Don't show error to user, silently fallback to previous device
        console.log("Silently falling back to previous microphone device");

        // Try to revert to previous device if available
        if (selectedMic && mediaStreamRef.current) {
          try {
            await mediaStreamRef.current.switchMicrophone(selectedMic);
            console.log("Successfully reverted to previous microphone");
          } catch (revertErr) {
            console.error("Failed to revert microphone:", revertErr);
            // If revert fails, try default device
            try {
              const devices = await ZoomVideo.getDevices();
              const mics = devices.filter((d) => d.kind === "audioinput");
              if (mics.length > 0) {
                await mediaStreamRef.current.switchMicrophone(mics[0].deviceId);
                setSelectedMic(mics[0].deviceId);
                console.log("Fell back to default microphone");
              }
            } catch (defaultErr) {
              console.error("All microphone fallbacks failed:", defaultErr);
            }
          }
        }

      }

    }

  };



  const switchSpeaker = async (deviceId) => {

    if (mediaStreamRef.current) {

      try {

        // Store previous device for fallback
        const previousDevice = selectedSpeaker;

        // Check if the selected device is problematic
        const devices = await ZoomVideo.getDevices();
        const speakers = devices.filter((d) => d.kind === "audiooutput");
        const selectedDevice = speakers.find(d => d.deviceId === deviceId);

        if (selectedDevice && isProblematicDevice(selectedDevice.label)) {
          console.log("Detected problematic communication device, finding alternative");
          const safeDevice = findSafeDevice(speakers, deviceId);
          if (safeDevice) {
            deviceId = safeDevice.deviceId;
            console.log("Switching to safe device:", safeDevice.label);
          }
        }

        // Attempt to switch speaker with timeout
        const switchPromise = mediaStreamRef.current.switchSpeaker(deviceId);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Device switch timeout')), 5000)
        );

        await Promise.race([switchPromise, timeoutPromise]);

        setSelectedSpeaker(deviceId);

        addNotification("Speaker switched successfully");

      } catch (err) {

        console.error("Failed to switch speaker:", err);

        // Don't show error to user, silently fallback to previous device
        console.log("Silently falling back to previous speaker device");

        // Try to revert to previous device if available
        if (selectedSpeaker && mediaStreamRef.current) {
          try {
            await mediaStreamRef.current.switchSpeaker(selectedSpeaker);
            console.log("Successfully reverted to previous speaker");
          } catch (revertErr) {
            console.error("Failed to revert speaker:", revertErr);
            // If revert fails, try default device
            try {
              const devices = await ZoomVideo.getDevices();
              const speakers = devices.filter((d) => d.kind === "audiooutput");
              if (speakers.length > 0) {
                await mediaStreamRef.current.switchSpeaker(speakers[0].deviceId);
                setSelectedSpeaker(speakers[0].deviceId);
                console.log("Fell back to default speaker");
              }
            } catch (defaultErr) {
              console.error("All speaker fallbacks failed:", defaultErr);
            }
          }
        }

      }

    }

  };



  const sendChatMessage = async (e) => {

    e.preventDefault();

    if (!chatInput.trim()) return;

    try {

      const client = clientRef.current;

      if (!client) {

        setError("Chat client not available");

        return;

      }



      const chatClient = client.getChatClient();

      if (!chatClient) {

        setError("Chat client not initialized");

        return;

      }



      await chatClient.sendToAll(chatInput);

      // Don't add message here - it will be added by the chat-on-message event

      setChatInput("");

    } catch (err) {

      console.error("Chat send error:", err);

      setError("Failed to send message: " + (err.message || "Unknown error"));

    }

  };



  // Modal overlay click handler

  const handleOverlayClick = (closeFn) => (e) => {

    if (e.target.classList.contains("modal")) closeFn();

  };



  // Start camera for self-preview only if video is not off from preview

  useEffect(() => {

    // Only initialize camera if video is not off from preview

    if (!initialVideoOff) {

      navigator.mediaDevices

        .getUserMedia({ video: true, audio: true })

        .then((stream) => {

          if (videoRef.current) {

            videoRef.current.srcObject = stream;

          }

        })

        .catch((err) => {

          console.error("Error accessing camera:", err);

        });

    } else {

      console.log("📹 Skipping camera initialization (camera off from preview)");

    }



    return () => {

      if (videoRef.current?.srcObject) {

        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());

      }

    };

  }, [initialVideoOff]);



  //=====camera drop down=====

  useEffect(() => {

    console.log("🎨 showVideoOptions changed to:", showVideoOptions);

  }, [showVideoOptions]);



  useEffect(() => {

    function handleClick(e) {

      // Close dropdowns when clicking outside

      const isClickInsideDropdown = e.target.closest(".video-options-menu");

      const isClickInsideButton = e.target.closest(".video-options-toggle");



      if (!isClickInsideDropdown && !isClickInsideButton) {

        setShowVideoOptions(null);

      }

    }



    if (showVideoOptions) {

      document.addEventListener("mousedown", handleClick);

    } else {

      document.removeEventListener("mousedown", handleClick);

    }

    return () => document.removeEventListener("mousedown", handleClick);

  }, [showVideoOptions]);



  const count = participants.length;



  let gridClass = "";

  if (count === 1) gridClass = "grid-1";

  else if (count <= 4) gridClass = `grid-${count}`;

  else if (count <= 9) gridClass = `grid-${count}`;

  else if (count <= 16) gridClass = `grid-${count}`;

  else if (count <= 25) gridClass = `grid-${count}`;

  else gridClass = "grid-25";



  // Early returns for loading and error states

  if (isJoining) return <ZoomDotsLoader />;

  // // if (error)

  //   return (

  //     // <div className="error-page">

  //     //   Error: {error}{" "}

  //     //   <button onClick={async () => await redirectToMeetingEnd("user_left")}>Go Back</button>

  //     // </div>

  //   );

  if (localUserRemoved) return <div>Redirecting...</div>;





  //mobile responsive



  return (

    <div

      className={`joinerScreen ${isSharingScreen || isRemoteSharing ? "sharingScreenActive" : ""
        }`}

      style={{ overflow: "hidden", height: "100vh" }}

    >

      <Header

        userEmail={`${displayName}@example.com`}

        userName={getProperDisplayName(userId, displayName)}

        meetingTitle={meetingData?.agenda || sessionName}

        startTime={meetingStartTime}

        showTimer={true}

      />



      <div className="joinerScreenContainer" style={{ overflow: "hidden" }}>

        {/* Clean Recording Indicator */}

        {(showRecordingNotice || recordingState === "paused") && (

          <div

            style={{

              position: "absolute",

              top: "10px",

              right: "20px",

              background: recordingState === "paused" ? "#f59e0b" : "#dc3545",

              color: "#fff",

              padding: "6px 12px",

              borderRadius: "20px",

              fontSize: "12px",

              fontWeight: "600",

              zIndex: 100,

              display: "flex",

              alignItems: "center",

              gap: "6px",

              boxShadow: recordingState === "paused" ? "0 2px 8px rgba(245, 158, 11, 0.3)" : "0 2px 8px rgba(220, 53, 69, 0.3)",

              animation: recordingState === "paused" ? "none" : "pulse 2s infinite",

            }}

          >

            <div

              style={{

                width: "6px",

                height: "6px",

                background: "#fff",

                borderRadius: "50%",

                animation: recordingState === "paused" ? "none" : "pulse 1s infinite",

              }}

            />

            {recordingState === "paused" ? "PAUSED" : "REC"}

          </div>

        )}



        <div className="joinerScreenBlock">

          <div

            className={`joinerVideoScreen ${gridClass} ${isSharingScreen || isRemoteSharing ? "sharing-on" : ""

              }`}

            style={{

              padding:

                participants.length >= 3 &&

                  participants.length <= participants.length
                  ? "0px 0px"
                  : "0px 0 0 0",
            }}

          >

            {participants.slice(0, 4).map((user, i) => {

              return (

                <div

                  className={`joinerVideoBox ${user.userId === selfUserIdRef.current ? "active" : ""

                    } ${activeSpeakerId && user.userId === activeSpeakerId

                      ? "active-speaker"

                      : ""

                    }`}

                  key={user.userId}

                >

                  {/* Video container for Zoom SDK to attach video - like MeetingPage.jsx */}

                  <video-player-container

                    id={`video-${user.userId}`}

                    ref={(el) => {

                      videoContainerRefs.current[user.userId] = el;



                      // Check for duplicate user when container is created

                      if (el) {

                        // Check if there are multiple containers with the same user ID

                        const existingContainers = document.querySelectorAll(

                          `[id="video-${user.userId}"]`

                        );

                        if (existingContainers.length > 1) {

                          console.log(

                            `🚫 DUPLICATE CONTAINER DETECTED for user: ${user.userId}`

                          );

                          console.log(

                            `🚫 Found ${existingContainers.length} containers for the same user`

                          );



                          // Keep only the latest container, remove the old ones

                          for (

                            let i = 0;

                            i < existingContainers.length - 1;

                            i++

                          ) {

                            const oldContainer = existingContainers[i];

                            console.log(

                              `⚡ INSTANTLY REMOVING OLD CONTAINER for user: ${user.userId}`

                            );

                            oldContainer.remove();

                          }



                          // Also remove from participants list

                          setParticipants((prev) => {

                            const filtered = prev.filter(

                              (p) => p.userId !== user.userId

                            );

                            console.log(

                              `⚡ INSTANTLY removed duplicate user ${user.userId} from participants: ${prev.length} → ${filtered.length}`

                            );

                            return transformParticipantsWithNames(filtered);

                          });



                          // Complete cleanup

                          completeUserRemoval(user.userId);

                          detachVideo(user.userId);



                          console.log(

                            `⚡ INSTANT REMOVAL COMPLETE for duplicate user: ${user.userId}`

                          );

                        }

                      }



                      // Set aspect ratio if available (like MeetingPage.jsx)

                      if (el && aspectRatioRefs.current[user.userId]) {

                        el.style.aspectRatio =

                          aspectRatioRefs.current[user.userId];

                      }

                      // Ensure container is properly styled

                      if (el) {

                        el.style.width = "100%";

                        el.style.height = "100%";

                        el.style.background = "black";

                        el.style.display = "flex";

                        el.style.alignItems = "center";

                        el.style.justifyContent = "center";



                        // Hide container if this is the local user and video is currently off

                        if (user.userId === selfUserIdRef.current && !isVideoOn) {

                          el.style.display = "none";

                          console.log("📹 Hiding local video container (camera currently off)");

                        }

                      }

                    }}

                  >

                    {/* Add video-player element for virtual backgrounds */}

                    <video-player

                      id={`video-player-${user.userId}`}

                      style={{ width: "100%", height: "100%" }}

                    />

                  </video-player-container>

                  {/* Show error if local video fails */}

                  {user.userId === localUserIdRef.current &&

                    error &&

                    !isVideoOn && (

                      <div

                        style={{

                          position: "absolute",

                          top: 0,

                          left: 0,

                          right: 0,

                          bottom: 0,

                          color: "#fff",

                          background: "rgba(0,0,0,0.7)",

                          display: "flex",

                          alignItems: "center",

                          justifyContent: "center",

                          fontSize: 18,

                          zIndex: 2,

                          textAlign: "center",

                          padding: 16,

                          objectFit: "cover",

                        }}

                      >

                        {error}

                      </div>

                    )}

                  <div className="joinerName">

                    <div

                      style={{

                        display: "flex",

                        alignItems: "center",

                        gap: "8px",

                      }}

                    >

                      <span style={{ textTransform: "capitalize" }}>

                        {getProperDisplayName(user.userId, user.displayName)}

                      </span>

                      {/* Network quality indicator */}

                      {networkQuality[user.userId] !== undefined && (

                        <FaSignal

                          style={{

                            marginLeft: 6,

                            color:

                              networkQuality[user.userId] >= 3

                                ? "#22c55e"

                                : networkQuality[user.userId] === 2

                                  ? "#f59e0b"

                                  : "#ef4444",

                          }}

                          title={`Network: ${networkQuality[user.userId] >= 3

                              ? "Good"

                              : networkQuality[user.userId] === 2

                                ? "Fair"

                                : "Poor"

                            }`}

                        />

                      )}

                      {/* Audio status icon */}

                      {(

                        user.userId === selfUserIdRef.current

                          ? isAudioOn

                          : !user.muted

                      ) ? (

                        <FaMicrophone

                          style={{ marginLeft: 6, color: "#22c55e" }}

                          title="Mic On"

                        />

                      ) : (

                        <FaMicrophoneSlash

                          style={{ marginLeft: 6, color: "#ef4444" }}

                          title="Mic Off"

                        />

                      )}

                      {/* Video status icon */}

                      {(

                        user.userId === selfUserIdRef.current

                          ? isVideoOn

                          : user.bVideoOn

                      ) ? (

                        <FaVideo

                          style={{ marginLeft: 6, color: "#22c55e" }}

                          title="Camera On"

                        />

                      ) : (

                        <FaVideoSlash

                          style={{ marginLeft: 6, color: "#ef4444" }}

                          title="Camera Off"

                        />

                      )}

                    </div>

                  </div>

                </div>

              );

            })}

          </div>



          {/* Shared screen elements (for both sharer and viewer) - Like MeetingPage.jsx */}

          <div className="shareScreenContainer">

            {/* Video element for screen sharing (when browser supports it) */}

            <video

              ref={shareRenderVideoRef}

              autoPlay

              playsInline

              id="my-screen-share-content-video"

              className="videoTagBlock"

            />

            {/* Canvas element for screen sharing (fallback) */}

            <canvas

              ref={shareCanvasRef}

              id="my-screen-share-content-canvas"

              height={720}

              width={1280}

              style={{

                display: "none",

                maxWidth: "90vw",

                maxHeight: "50vh",

                borderRadius: 12,

                boxShadow: "0 2px 16px rgba(0,0,0,0.2)",

              }}

            />



            {/* Canvas for remote share */}

            <canvas

              ref={remoteShareContainerRef}

              id="users-screen-share-content-canvas"

              width="70%"

              height="100%"

              style={{

                display: isRemoteSharing ? "block" : "none",

                maxWidth: "90vw",

                maxHeight: "50vh",

                borderRadius: 12,

                boxShadow: "0 2px 16px rgba(0,0,0,0.2)",

              }}

            />

          </div>



          <div className="joinerSettingBottom">

            {/* Mic button with dropdown for mic and speaker selection */}

            <div

              className="control-button video-control-group controlViewBlock">

              <button

                className={`commonJoinderBtn muteBoxSetting ${!isAudioOn ? "active" : ""

                  }`}

                onClick={toggleAudio}

                disabled={localUserRemoved}

              >

                {!isAudioOn ? <UnMicroPhone /> : <MicroPhone />}

                <span>{!isAudioOn ? "Unmute" : "Mute"}</span>

              </button>

              <button

                className="video-options-toggle optionToggleBlock mobHide"

                onClick={() =>

                  setShowVideoOptions(showVideoOptions === "mic" ? null : "mic")

                }

              >

                {showVideoOptions === "mic" && isAudioOn ? <FaChevronUp /> : <FaChevronDown />}

              </button>

              {showVideoOptions === "mic" && (

                <div

                  className="video-options-menu bottomButtonOption">

                  <label

                    className="dropdownPopupArea"

                    style={{

                      display: "block",

                      marginBottom: 8,

                      fontSize: "14px",

                      fontWeight: "500",

                    }}

                  >

                    Microphone:

                    <select

                      value={selectedMic}

                      onChange={async (e) => {

                        await switchMicrophone(e.target.value);

                      }}

                      style={{

                        width: "60%",

                        marginTop: 4,

                        padding: "8px 12px",

                        borderRadius: 6,

                        border: "1px solid #444",

                        background: "#333",

                        color: "#fff",

                        fontSize: "14px",

                        outline: "none",

                      }}

                    >

                      {audioDevices.map((d) => (

                        <option key={d.deviceId} value={d.deviceId}>

                          {d.label}

                        </option>

                      ))}

                    </select>

                  </label>

                  <label

                    className="dropdownPopupArea"

                    style={{

                      display: "block",

                      marginBottom: 8,

                      fontSize: "14px",

                      fontWeight: "500",

                    }}

                  >

                    Speaker:

                    <select

                      value={selectedSpeaker}

                      onChange={async (e) => {

                        await switchSpeaker(e.target.value);

                      }}

                      style={{

                        width: "60%",

                        marginTop: 4,

                        padding: "8px 12px",

                        borderRadius: 6,

                        border: "1px solid #444",

                        background: "#333",

                        color: "#fff",

                        fontSize: "14px",

                        outline: "none",

                      }}

                    >

                      {speakerDevices.map((d) => (

                        <option key={d.deviceId} value={d.deviceId}>

                          {d.label}

                        </option>

                      ))}

                    </select>

                  </label>

                </div>

              )}

            </div>



            {/* Camera button with dropdown for camera and background selection */}

            <div

              className="control-button video-control-group controlViewBlock" ref={cameraBtnRef}>

              <button

                className={`commonJoinderBtn videoBoxSetting ${!isVideoOn ? "active" : ""

                  }`}

                onClick={toggleVideo}

                disabled={isTogglingVideo || localUserRemoved}

                style={{ position: "relative" }}

              >

                {!isVideoOn ? <OffVideoCamera /> : <VideoCamera />}

                <span>{!isVideoOn ? "Start Video" : "Stop Video"}</span>

              </button>

              <button

                className="video-options-toggle mobHide"

                onClick={() => {

                  console.log(

                    "🎨 Background dropdown clicked, current state:",

                    showVideoOptions

                  );

                  setShowVideoOptions(

                    showVideoOptions === "video" ? null : "video"

                  );

                }}

                title="Change Background"

              >

                {showVideoOptions === "video" && isAudioOn ? <FaChevronUp /> : <FaChevronDown />}

              </button>

              {showVideoOptions === "video" && (

                <div

                  className="video-options-menu bottomButtonOption">

                  <label

                    className="dropdownPopupArea"

                    style={{

                      display: "block",

                      marginBottom: 8,

                      fontSize: "14px",

                      fontWeight: "500",

                    }}

                  >

                    Camera:

                    <select

                      value={selectedCamera}

                      onChange={async (e) => {

                        await switchCamera(e.target.value);

                      }}

                      style={{

                        width: "70%",

                        marginTop: 4,

                        padding: "8px 12px",

                        borderRadius: 6,

                        border: "1px solid #444",

                        background: "#333",

                        color: "#fff",

                        fontSize: "14px",

                        outline: "none",

                      }}

                    >

                      {videoDevices.map((d) => (

                        <option key={d.deviceId} value={d.deviceId}>

                          {d.label}

                        </option>

                      ))}

                    </select>

                  </label>

                  <label

                    className="dropdownPopupArea"

                    style={{

                      display: "block",

                      marginBottom: 8,

                      fontSize: "14px",

                      fontWeight: "500",

                    }}

                  >

                    Virtual Background:

                    <select

                      value={bgMode}

                      onChange={async (e) => {

                        console.log("🎨 Background changed to", e.target.value);

                        setBgMode(e.target.value);

                        setShowVideoOptions(null);

                        if (isVideoOn) {

                          await handleBgChange(e);

                        }

                      }}

                      style={{

                        width: "60%",

                        marginTop: 4,

                        padding: "8px 12px",

                        borderRadius: 6,

                        border: "1px solid #444",

                        background: "#333",

                        color: "#fff",

                        fontSize: "14px",

                        outline: "none",

                      }}

                    >

                      {userType === "mentor" ? (
                        // Only Tetr Background for mentors
                        <option value="image">Tetr Background</option>
                      ) : (
                        // Only None and Blur for mentees
                        <>
                          <option value="none">No Virtual Background</option>
                          <option value="blur">Blur</option>
                        </>
                      )}

                    </select>

                  </label>

                </div>

              )}

            </div>



            <button

              className={`commonJoinderBtn chatSetting ${showModals.chat ? "active" : ""

                }`}

              onClick={() => handleModal("chat", !showModals.chat)}

              disabled={localUserRemoved}

              style={{ position: "relative" }}

            >

              <ChatIcon size="24" />

              {showModals.chat && <span></span>}

              {/* Unread message indicator */}

              {unreadChatCount > 0 && !showModals.chat && (

                <div

                  style={{

                    position: "absolute",

                    top: "-2px",

                    right: "-2px",

                    background: "#ff4444",

                    color: "#fff",

                    borderRadius: "50%",

                    minWidth: "18px",

                    height: "18px",

                    display: "flex",

                    alignItems: "center",

                    justifyContent: "center",

                    fontSize: "10px",

                    fontWeight: "bold",

                    border: "2px solid #fff",

                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",

                    zIndex: 1,

                    animation: "pulse 2s infinite",

                  }}

                >

                  {unreadChatCount > 9 ? "9+" : unreadChatCount}

                </div>

              )}

              <span>{showModals.chat ? "Chat" : "Chat"}</span>

            </button>



            <button

              className={`commonJoinderBtn participantsSetting mobHide ${showModals.participants ? "active" : ""

                }`}

              onClick={() =>

                handleModal("participants", !showModals.participants)

              }

              title="Participants"

              disabled={localUserRemoved}

            >

              <span className="messageRound">

                <svg

                  width="20"

                  height="20"

                  viewBox="0 0 24 24"

                  fill="currentColor"

                >

                  <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8H17c-.8 0-1.54.37-2.01 1l-1.7 2.26A6.003 6.003 0 0 0 10 16c0 3.31 2.69 6 6 6h4v-2h-4c-2.21 0-4-1.79-4-4s1.79-4 4-4c.73 0 1.41.21 2 .56V14h2v-2.44c.59-.35 1.27-.56 2-.56 2.21 0 4 1.79 4 4v6h-2z" />

                </svg>

                {showModals.participants && <span></span>}

              </span>

              <span>

                {showModals.participants ? "Participants" : "Participants"}

              </span>

            </button>



            {/* Info button commented out - not needed for mentor/mentee */}
            {/* 
            <button

              className={`commonJoinderBtn infoSetting  ${

                showModals.info ? "active" : ""

              }`}

              onClick={() => handleModal("info", !showModals.info)}

              title="Meeting Info"

              disabled={localUserRemoved}

            >

                <svg

                  width="20"

                  height="20"

                  viewBox="0 0 24 24"

                  fill="currentColor"

                >

                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />

                </svg>

                {showModals.info && <span></span>}

              <span>{showModals.info ? "Close Info" : "Info"}</span>

            </button>
            */}



            <button

              className={`commonJoinderBtn screenShareSetting mobHide ${isSharingScreen ? "active" : ""

                } ${isRemoteSharing && !isSharingScreen ? "disabled" : ""}`}

              onClick={startScreenShare}

              disabled={localUserRemoved || (isRemoteSharing && !isSharingScreen)}

              title={

                isRemoteSharing && !isSharingScreen

                  ? "Screen sharing is already in progress"

                  : isSharingScreen

                    ? "Stop sharing your screen"

                    : "Share your screen"

              }

            >

              <ShareScreenIcon />

              <span>

                {isSharingScreen

                  ? "Stop Share"

                  : isRemoteSharing && !isSharingScreen

                    ? "Screen sharing in progress"

                    : "Share Screen"}

              </span>

            </button>



            {/* Annotation Button (only show if sharing or viewing share) */}

            {/* {(isSharingScreen || isRemoteSharing) &&

              (isAnnotating ? (

                <button

                  className="commonJoinderBtn annotationSetting active"

                  onClick={stopAnnotation}

                  disabled={localUserRemoved}

                >

                  <svg

                    width="20"

                    height="20"

                    viewBox="0 0 24 24"

                    fill="currentColor"

                  >

                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />

                  </svg>

                  <span>Stop Annotation</span>

                </button>

              ) : (

                <button

                  className="commonJoinderBtn annotationSetting"

                  onClick={handleStartAnnotation}

                  disabled={localUserRemoved}

                >

                  <svg width="20" height="20" viewBox="0 0 24 24" fill="black">

                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />

                  </svg>

                  <span>Annotate</span>

                </button>

              ))} */}



            {/* 🆕 Automatic Recording Status - No Manual Controls */}

            <button

              className={`commonJoinderBtn recordingSetting mobHide ${showRecordingNotice ? "active" : ""

                }`}

              disabled={true}

              title="Recording starts automatically when both mentor and mentee join"

            >

              <BlinkDot />

              <RecordingIcon />

              <span>Recording</span>

            </button>



            {/* Recording Banner - Removed duplicate notification */}



            {isHost ? (

              <button

                className="leaveMeetingButton"

                onClick={handleEndMeeting}

                // style={{ background: "#e53935",minHeight: "50px" }}

                disabled={localUserRemoved}

              >

                {!isMobile ? 'End Meeting' :

                  <svg width="15" height="14" viewBox="0 0 14 13" fill="none" xmlns="http://www.w3.org/2000/svg">

                    <path d="M8.33333 3.83335V2.50002C8.33333 2.1464 8.19286 1.80726 7.94281 1.55721C7.69276 1.30716 7.35362 1.16669 7 1.16669H2.33333C1.97971 1.16669 1.64057 1.30716 1.39052 1.55721C1.14048 1.80726 1 2.1464 1 2.50002V10.5C1 10.8536 1.14048 11.1928 1.39052 11.4428C1.64057 11.6929 1.97971 11.8334 2.33333 11.8334H7C7.35362 11.8334 7.69276 11.6929 7.94281 11.4428C8.19286 11.1928 8.33333 10.8536 8.33333 10.5V9.16669M5 6.50002H13M13 6.50002L11 4.50002M13 6.50002L11 8.50002" stroke="#A3A3A3" stroke-linecap="round" stroke-linejoin="round" />

                  </svg>}



              </button>

            ) : (

              <button

                className="leaveMeetingButton"

                onClick={handleLeave}

                disabled={localUserRemoved}

              // style={{ background: "#e53935",minHeight: "50px" }}

              >

                {!isMobile ? 'Leave Meeting' :

                  <svg width="15" height="14" viewBox="0 0 14 13" fill="none" xmlns="http://www.w3.org/2000/svg">

                    <path d="M8.33333 3.83335V2.50002C8.33333 2.1464 8.19286 1.80726 7.94281 1.55721C7.69276 1.30716 7.35362 1.16669 7 1.16669H2.33333C1.97971 1.16669 1.64057 1.30716 1.39052 1.55721C1.14048 1.80726 1 2.1464 1 2.50002V10.5C1 10.8536 1.14048 11.1928 1.39052 11.4428C1.64057 11.6929 1.97971 11.8334 2.33333 11.8334H7C7.35362 11.8334 7.69276 11.6929 7.94281 11.4428C8.19286 11.1928 8.33333 10.8536 8.33333 10.5V9.16669M5 6.50002H13M13 6.50002L11 4.50002M13 6.50002L11 8.50002" stroke="#A3A3A3" stroke-linecap="round" stroke-linejoin="round" />

                  </svg>}



              </button>

            )}

          </div>

        </div>

        <ChatSidebar

          isChatOpen={showModals.chat}

          setIsChatOpen={(state) => handleModal("chat", state)}

          participants={participants}

          chatMessages={chatMessages}

          meetingData={meetingData}

          getModalHeading={getModalHeading}

          userName={userName}

          onSendMessage={(message) => {

            // Direct message sending without creating fake event

            if (message && message.trim()) {

              const sendMessage = async () => {

                try {

                  const client = clientRef.current;

                  if (!client) {

                    setError("Chat client not available");

                    return;

                  }



                  const chatClient = client.getChatClient();

                  if (!chatClient) {

                    setError("Chat client not initialized");

                    return;

                  }



                  await chatClient.sendToAll(message);

                  // Don't add message here - it will be added by the chat-on-message event

                } catch (err) {

                  console.error("Chat send error:", err);

                  setError(

                    "Failed to send message: " +

                    (err.message || "Unknown error")

                  );

                }

              };

              sendMessage();

            }

          }}

        />

      </div>



      {/* Recording Notice - Removed duplicate notification */}



      {/* End Meeting Confirmation Modal */}

      {showEndMeetingConfirm && (

        <div

          className="modal modalMeetingEndPopup"

          onClick={(e) => {

            if (e.target.classList.contains("modal"))

              setShowEndMeetingConfirm(false);

          }}>

          <div className="modalMeetingEndContentPopup">

            <h3 style={{ marginTop: 0, marginBottom: 16 }}>End Meeting</h3>

            <p className="textMeeting" style={{ textAlign: "center", marginBottom: 24 }}>

              Are you sure you want to end this meeting?

            </p>

            <div style={{ display: "flex", gap: 12 }}>

              <button

                onClick={() => setShowEndMeetingConfirm(false)}

                style={{

                  background: "#f5f5f5",

                  color: "#222",

                  border: "none",

                  borderRadius: 8,

                  padding: "12px 24px",

                  fontWeight: 600,

                  fontSize: 16,

                  cursor: "pointer",

                }}

              >

                Cancel

              </button>

              <button

                onClick={confirmEndMeeting}

                style={{

                  background: "#e53935",

                  color: "#fff",

                  border: "none",

                  borderRadius: 8,

                  padding: "12px 24px",

                  fontWeight: 600,

                  fontSize: 16,

                  cursor: "pointer",

                }}

              >

                End Meeting

              </button>

            </div>

          </div>

        </div>

      )}



      {/* Leave Meeting Confirmation Modal */}

      {showLeaveMeetingConfirm && (

        <div

          className="modal"

          onClick={(e) => {

            if (e.target.classList.contains("modal"))

              setShowLeaveMeetingConfirm(false);

          }}

          style={{

            position: "fixed",

            top: 0,

            left: 0,

            right: 0,

            bottom: 0,

            background: "rgba(0, 0, 0, 0.5)",

            display: "flex",

            alignItems: "center",

            justifyContent: "center",

            zIndex: 9999,

            padding: "20px",

          }}

        >

          <div

            style={{

              background: "#fff",

              color: "#222",

              width: "100%",

              maxWidth: 400,

              borderRadius: 16,

              boxShadow: "0 2px 16px rgba(0,0,0,0.2)",

              padding: 32,

              display: "flex",

              flexDirection: "column",

              alignItems: "center",

              maxHeight: "90vh",

              overflow: "auto",

            }}

          >

            <p

              style={{

                textAlign: "center",

                marginBottom: 24,

                fontSize: "18px",

                fontWeight: "500",

              }}

            >

              Yes, I want to leave this meeting

            </p>

            <div

              style={{

                display: "flex",

                flexDirection: "column",

                gap: 12,

                width: "100%",

              }}

            >

              <button

                onClick={confirmLeaveSession}

                style={{

                  background: "#e53935",

                  color: "#fff",

                  border: "none",

                  borderRadius: 8,

                  padding: "12px 24px",

                  fontWeight: 600,

                  fontSize: 16,

                  cursor: "pointer",

                  width: "100%",

                }}

              >

                Yes, I want to leave this meeting

              </button>

              <button

                onClick={() => setShowLeaveMeetingConfirm(false)}

                style={{

                  background: "#fff",

                  color: "#00baff",

                  border: "2px solid #00baff",

                  borderRadius: 8,

                  padding: "12px 24px",

                  fontWeight: 600,

                  fontSize: 16,

                  cursor: "pointer",

                  width: "100%",

                }}

              >

                Cancel

              </button>

            </div>

          </div>

        </div>

      )}



      {/* Participants Modal */}

      {showModals.participants && (

        <div

          className="modal participants-modal"

          style={{

            position: "fixed",

            top: 0,

            right: 0,

            height: "100%",

            width: 350,

            background: "#fff",

            boxShadow: "-2px 0 12px #0002",

            zIndex: 2000,

            display: "flex",

            flexDirection: "column",

            borderLeft: "1px solid #e0e0e0",

            padding: 0,

            animation: "slideInRight 0.3s",

          }}

          onClick={() => handleModal("participants", false)}

        >

          <div

            className="modal-content"

            style={{

              flex: 1,

              display: "flex",

              flexDirection: "column",

              padding: 0,

              background: "#f8f9fa",

              borderRadius: 0,

              boxShadow: "none",

              minWidth: 0,

              minHeight: 0,

            }}

            onClick={(e) => e.stopPropagation()}

          >

            <div

              style={{

                display: "flex",

                alignItems: "center",

                justifyContent: "space-between",

                padding: "18px 24px 12px 24px",

                borderBottom: "1px solid #e0e0e0",

                background: "#fff",

              }}

            >

              <h3 className="blackColor" style={{ margin: 0, fontWeight: 600, fontSize: 20 }}>

                {getModalHeading('participants')}

              </h3>

              <button

                onClick={() => handleModal("participants", false)}

                style={{

                  background: "none",

                  fontSize: 22,

                  color: "#888",

                  cursor: "pointer",

                  marginLeft: 8,

                  border: "1px solid #101010",

                  paddingLeft: 8,

                  paddingRight: 8,

                }}

                aria-label="Close participants panel"

              >

                ×

              </button>

            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>

              {participants.map((p, idx) => (

                <div

                  key={p.userId}

                  style={{

                    display: "flex",

                    alignItems: "center",

                    background: idx % 2 === 0 ? "#fff" : "#f3f4f6",

                    padding: "12px 24px",

                    borderBottom: "1px solid #f0f0f0",

                    fontSize: 16,

                    minHeight: 56,

                  }}

                >

                  <div

                    style={{

                      width: 36,

                      height: 36,

                      borderRadius: "50%",

                      background: "#e3e7ed",

                      display: "flex",

                      alignItems: "center",

                      justifyContent: "center",

                      fontWeight: 600,

                      fontSize: 18,

                      color: "#3a3a3a",

                      marginRight: 16,

                      textTransform: "uppercase",

                    }}

                  >

                    {getProperDisplayName(p.userId, p.displayName)?.[0] || "?"}

                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>

                    <span

                      style={{

                        fontWeight: 500,

                        color: "#222",

                        display: "block",

                        overflow: "hidden",

                        textOverflow: "ellipsis",

                        whiteSpace: "nowrap",

                      }}

                      title={p.displayName || p.userId?.toString() || "Guest"}

                    >

                      {getProperDisplayName(p.userId, p.displayName)}

                    </span>

                    <span

                      style={{

                        fontSize: 14,

                        color: "#666",

                        display: "block",

                      }}

                    >

                      {p.userId === selfUserIdRef.current

                        ? "You"

                        : p.role === 1

                          ? "Host"

                          : "Participant"}

                    </span>

                  </div>

                  <div

                    style={{

                      display: "flex",

                      alignItems: "center",

                      gap: 8,

                    }}

                  >

                    {/* Audio status icon */}

                    {(

                      p.userId === selfUserIdRef.current ? isAudioOn : !p.muted

                    ) ? (

                      <FaMicrophone

                        style={{ color: "#22c55e", fontSize: 18 }}

                        title="Mic On"

                      />

                    ) : (

                      <FaMicrophoneSlash

                        style={{ color: "#ef4444", fontSize: 18 }}

                        title="Mic Off"

                      />

                    )}

                    {/* Video status icon */}

                    {(

                      p.userId === selfUserIdRef.current

                        ? isVideoOn

                        : p.bVideoOn

                    ) ? (

                      <FaVideo

                        style={{ color: "#22c55e", fontSize: 18 }}

                        title="Camera On"

                      />

                    ) : (

                      <FaVideoSlash

                        style={{ color: "#ef4444", fontSize: 18 }}

                        title="Camera Off"

                      />

                    )}

                    {/* Network quality icon */}

                    {networkQuality[p.userId] !== undefined && (

                      <FaSignal

                        style={{

                          color:

                            networkQuality[p.userId] >= 3

                              ? "#22c55e"

                              : networkQuality[p.userId] === 2

                                ? "#f59e0b"

                                : "#ef4444",

                          fontSize: 18,

                        }}

                        title={`Network: ${networkQuality[p.userId] >= 3

                            ? "Good"

                            : networkQuality[p.userId] === 2

                              ? "Fair"

                              : "Poor"

                          }`}

                      />

                    )}

                    {p.userId === selfUserIdRef.current && (

                      <span

                        style={{

                          background: "#00baff",

                          color: "#fff",

                          padding: "2px 8px",

                          borderRadius: 12,

                          fontSize: 12,

                          fontWeight: 500,

                        }}

                      >

                        You

                      </span>

                    )}

                    {p.role === 1 && (

                      <span

                        style={{

                          background: "#ff6b35",

                          color: "#fff",

                          padding: "2px 8px",

                          borderRadius: 12,

                          fontSize: 12,

                          fontWeight: 500,

                        }}

                      >

                        Host

                      </span>

                    )}

                  </div>

                </div>

              ))}

            </div>

          </div>

        </div>

      )}



      {/* Notifications Display */}

      {notifications.length > 0 && (

        <div

          style={{

            position: "fixed",

            top: "20px",

            left: "20px",

            zIndex: 1001,

            display: "flex",

            flexDirection: "column",

            gap: "6px", // Reduced gap

            maxHeight: "60vh", // Reduced max height

            overflow: "auto",

          }}

        >

          {notifications.map((notification) => (

            <div

              key={notification.id}

              style={{

                background: notification.msg.includes("recording") ? "#dc3545" : "rgba(0, 186, 255, 0.9)", // More transparent

                color: "#fff",

                padding: "6px 10px", // Reduced padding

                borderRadius: "4px", // Smaller radius

                fontSize: "12px", // Smaller font

                maxWidth: "250px", // Reduced width

                boxShadow: "0 1px 4px rgba(0,0,0,0.15)", // Lighter shadow

                animation: "slideIn 0.2s ease-out", // Faster animation

                fontWeight: notification.msg.includes("recording") ? "600" : "400",

                border: notification.msg.includes("recording") ? "1px solid #c82333" : "none",

                position: "relative",

                overflow: "hidden",

                opacity: 0.95, // Slightly transparent

              }}

            >

              {notification.msg}

              {notification.msg.includes("recording") && (

                <div

                  style={{

                    position: "absolute",

                    top: 0,

                    left: 0,

                    right: 0,

                    height: "2px",

                    background: "#fff",

                    animation: "pulse 2s infinite",

                  }}

                />

              )}

            </div>

          ))}

        </div>

      )}



      {/* Info Modal commented out - not needed for mentor/mentee */}
      {/* 
      {showModals.info && (

        <div

          className="modal info-modal"

          style={{

            position: "fixed",

            top: 0,

            right: 0,

            height: "100%",

            width: 350,

            background: "#fff",

            boxShadow: "-2px 0 12px #0002",

            zIndex: 2000,

            display: "flex",

            flexDirection: "column",

            borderLeft: "1px solid #e0e0e0",

            padding: 0,

            animation: "slideInRight 0.3s",

          }}

          onClick={() => handleModal("info", false)}

        >

          <div

            className="modal-content"

            style={{

              flex: 1,

              display: "flex",

              flexDirection: "column",

              padding: 0,

              background: "#f8f9fa",

              borderRadius: 0,

              boxShadow: "none",

              minWidth: 0,

              minHeight: 0,

            }}

            onClick={(e) => e.stopPropagation()}

          >

            <div

              style={{

                display: "flex",

                alignItems: "center",

                justifyContent: "space-between",

                padding: "18px 24px 12px 24px",

                borderBottom: "1px solid #e0e0e0",

                background: "#fff",

              }}

            >

              <h3 className="blackColor" style={{ margin: 0, fontWeight: 600, fontSize: 20 }}>

                {getModalHeading('info')}

              </h3>

              <button

                onClick={() => handleModal("info", false)}

                style={{

                  background: "none",

                  border: "1px solid #101010",

                  fontSize: 22,

                  color: "#888",

                  cursor: "pointer",

                  marginLeft: 8,

                  paddingLeft: 8,

                  paddingRight: 8,

                }}

                aria-label="Close info panel"

              >

                ×

              </button>

            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

              <div style={{ marginBottom: 24 }}>

                <h4

                  style={{ margin: "0 0 12px 0", color: "#222", fontSize: 16 }}

                >

                  Meeting Details

                </h4>

                <div

                  style={{

                    background: "#fff",

                    padding: 16,

                    borderRadius: 8,

                    border: "1px solid #e0e0e0",

                  }}

                >

                  <div style={{ marginBottom: 12 }}>

                    <span style={{ fontWeight: 600, color: "#666" }}>

                      Session:

                    </span>

                    <span style={{ marginLeft: 8, fontSize: 14, color: "#222" }}>

                      {meetingData?.agenda || sessionName}

                    </span>

                  </div>

                  <div style={{ marginBottom: 12 }}>

                    <span style={{ fontWeight: 600, color: "#666" }}>

                      Your Name:

                    </span>

                    <span style={{ marginLeft: 8, color: "#222" }}>

                      {getProperDisplayName(userId, displayName)}

                    </span>

                  </div>

                  <div style={{ marginBottom: 12 }}>

                    <span style={{ fontWeight: 600, color: "#666" }}>

                      Role:

                    </span>

                    <span style={{ marginLeft: 8, fontSize: 14, color: "#222" }}>

                      {isHost ? "Host" : "Participant"}

                    </span>

                  </div>

                  <div>

                    <span style={{ fontWeight: 600, color: "#666" }}>

                      Participants:

                    </span>

                    <span style={{ marginLeft: 8, fontSize: 14, color: "#222" }}>

                      {participants.length}

                    </span>

                  </div>

                </div>

              </div>



              <div style={{ marginBottom: 24 }}>

                <h4

                  style={{ margin: "0 0 12px 0", color: "#222", fontSize: 16 }}

                >

                  Connection Status

                </h4>

                <div

                  style={{

                    background: "#fff",

                    padding: 16,

                    borderRadius: 8,

                    border: "1px solid #e0e0e0",

                  }}

                >

                  <div style={{ marginBottom: 12 }}>

                    <span style={{ fontWeight: 600, color: "#666" }}>

                      Audio:

                    </span>

                    <span

                      style={{

                        marginLeft: 8,

                        fontSize: 14,

                        color: isAudioOn ? "#22c55e" : "#ef4444",

                      }}

                    >

                      {isAudioOn ? "Connected" : "Muted"}

                    </span>

                  </div>

                  <div style={{ marginBottom: 12 }}>

                    <span style={{ fontWeight: 600, color: "#666" }}>

                      Video:

                    </span>

                    <span

                      style={{

                        marginLeft: 8, fontSize: 14,

                        color: isVideoOn ? "#22c55e" : "#ef4444",

                      }}

                    >

                      {isVideoOn ? "Connected" : "Off"}

                    </span>

                  </div>

                  <div>

                    <span style={{ fontWeight: 600, color: "#666" }}>

                      Screen Share:

                    </span>

                    <span

                      style={{

                        marginLeft: 8, fontSize: 14,

                        color: isSharingScreen ? "#22c55e" : "#666",

                      }}

                    >

                      {isSharingScreen ? "Active" : "Inactive"}

                    </span>

                  </div>

                </div>

              </div>



              {isHost && (

                <div>

                  <h4

                    style={{

                      margin: "0 0 12px 0",

                      color: "#222",

                      fontSize: 16,

                    }}

                  >

                    Recording Status

                  </h4>

                  <div

                    style={{

                      background: "#fff",

                      padding: 16,

                      borderRadius: 8,

                      border: "1px solid #e0e0e0",

                    }}

                  >

                    <div>

                      <span style={{ fontWeight: 600, color: "#666" }}>

                        Status:

                      </span>

                      <span

                        style={{

                          marginLeft: 8,fontSize: 14,

                          color:

                            recordingState === "recording"

                              ? "#22c55e"

                              : recordingState === "paused"

                                ? "#f59e0b"

                                : "#666",

                        }}

                      >

                        {recordingState === "recording"

                          ? "Recording"

                          : recordingState === "paused"

                            ? "Paused"

                            : recordingState === "stopped"

                              ? "Stopped"

                              : "Idle"}

                      </span>

                    </div>

                  </div>

                </div>

              )}

            </div>

          </div>

        </div>

      )}
      */}



      {/* Media Warning Modal */}

      {showMediaWarning && (

        <div

          onClick={() => {

            setShowMediaWarning(false);

            // Try to resume audio when clicking anywhere

            if (mediaStreamRef.current && !isAudioOn) {

              try {

                mediaStreamRef.current.unmuteAudio();

                setIsAudioOn(true);

              } catch (error) {

                console.error("Failed to resume audio:", error);

              }

            }

          }}

          style={{

            position: "fixed",

            top: 0,

            left: 0,

            width: "100vw",

            height: "100vh",

            background: "rgba(0,0,0,0.35)",

            zIndex: 3000,

            display: "flex",

            alignItems: "center",

            justifyContent: "center",

            cursor: "pointer",

          }}

        >

          <div

            onClick={(e) => e.stopPropagation()}

            style={{

              background: "#333",

              borderRadius: 12,

              padding: "24px 32px 24px 32px",

              boxShadow: "0 4px 24px #0002",


              maxWidth: 400,

              color: "#fff",

              margin: "10px",
            }}

          >

            <div

              style={{

                display: "flex",

                alignItems: "center",

                marginBottom: 16,

              }}

            >

              <div

                style={{

                  width: 24,

                  height: 24,

                  borderRadius: "50%",

                  background: "#ff9800",

                  display: "flex",

                  alignItems: "center",

                  justifyContent: "center",

                  marginRight: 12,

                  fontSize: 16,

                  fontWeight: "bold",

                }}

              >

                !

              </div>

              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>

                Active Media Failed

              </h3>

            </div>

            <div

              style={{

                color: "#ccc",

                fontSize: 14,

                lineHeight: 1.5,

                marginBottom: 24,

                whiteSpace: "pre-line",

              }}

            >

              {mediaWarningMessage}

            </div>

            <div

              style={{ display: "flex", gap: 12, justifyContent: "center" }}

            >

              {/* <button

                onClick={() => {

                  setShowMediaWarning(false);

                  // Try to resume audio when dismissing the warning

                  if (mediaStreamRef.current && !isAudioOn) {

                    try {

                      mediaStreamRef.current.unmuteAudio();

                      setIsAudioOn(true);

                    } catch (error) {

                      console.error("Failed to resume audio:", error);

                    }

                  }

                }}

                style={{

                  background: "transparent",

                  color: "#fff",

                  border: "1px solid #666",

                  borderRadius: 8,

                  padding: "8px 16px",

                  fontSize: 14,

                  cursor: "pointer",

                  transition: "all 0.2s",

                }}

                onMouseEnter={(e) => {

                  e.target.style.background = "#444";

                  e.target.style.borderColor = "#888";

                }}

                onMouseLeave={(e) => {

                  e.target.style.background = "transparent";

                  e.target.style.borderColor = "#666";

                }}

              >

                Dismiss

              </button> */}

              <button

                onClick={() => {

                  setShowMediaWarning(false);

                  // Try to resume audio and refresh the page

                  if (mediaStreamRef.current && !isAudioOn) {

                    try {

                      mediaStreamRef.current.unmuteAudio();

                      setIsAudioOn(true);

                    } catch (error) {

                      console.error("Failed to resume audio:", error);

                    }

                  }

                  window.location.reload();

                }}

                style={{

                  background: "#ff9800",

                  color: "#fff",

                  border: "none",

                  borderRadius: 8,

                  padding: "8px 16px",

                  fontSize: 14,

                  cursor: "pointer",

                  fontWeight: 600,

                  transition: "all 0.2s",

                }}

                onMouseEnter={(e) => {

                  e.target.style.background = "#f57c00";

                }}

                onMouseLeave={(e) => {

                  e.target.style.background = "#ff9800";

                }}

              >

                Refresh Page

              </button>

            </div>

          </div>

        </div>

      )}

      {/* Permission Error Modal */}
      {showPermissionErrorModal && (
        <div
          onClick={() => {
            setShowPermissionErrorModal(false);
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.35)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#333",
              borderRadius: 12,
              padding: "24px 32px 24px 32px",
              boxShadow: "0 4px 24px #0002",
              minWidth: 400,
              maxWidth: "90vw",
              color: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "#ff9800",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                  fontSize: 16,
                  fontWeight: "bold",
                }}
              >
                !
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                Permission Required
              </h3>
            </div>
            <div
              style={{
                color: "#ccc",
                fontSize: 14,
                lineHeight: 1.5,
                marginBottom: 24,
                whiteSpace: "pre-line",
              }}
            >
              {permissionError}
            </div>
            <div
              style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}
            >
              <button
                onClick={() => {
                  setShowPermissionErrorModal(false);
                }}
                style={{
                  background: "transparent",
                  border: "1px solid #666",
                  color: "#ccc",
                  padding: "8px 16px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowPermissionErrorModal(false);
                  // Request permissions again
                  const mediaConstraints = initialVideoOff
                    ? { audio: true }
                    : { video: true, audio: true };

                  navigator.mediaDevices
                    .getUserMedia(mediaConstraints)
                    .then(() => {
                      setPermissionError("");
                      // Retry fetching devices
                      const initializeDevices = async () => {
                        try {
                          const devices = await ZoomVideo.getDevices();
                          const cams = devices.filter((d) => d.kind === "videoinput");
                          const mics = devices.filter((d) => d.kind === "audioinput");
                          const speakers = devices.filter((d) => d.kind === "audiooutput");

                          setVideoDevices(cams);
                          setAudioDevices(mics);
                          setSpeakerDevices(speakers);

                          if (cams.length > 0) setSelectedCamera(cams[0].deviceId);
                          if (mics.length > 0) setSelectedMic(mics[0].deviceId);
                          if (speakers.length > 0) setSelectedSpeaker(speakers[0].deviceId);
                        } catch (err) {
                          console.error("Failed to fetch devices after permission grant:", err);
                        }
                      };
                      initializeDevices();
                    })
                    .catch((err) => {
                      console.log("Permission request failed:", err);
                      setPermissionError("We can't detect your microphone/camera because it's blocked in your browser or system settings.\n\nTo fix this:\n\nClick \"Allow\" in the permission popup at the top of your browser.\n\nIf you don't see it, click the 🔒 lock icon next to the address bar.\n\nGo to Site settings → Permissions.\n\nSet Microphone/Camera to Allow.\n\nAfter updating, refresh the page and try again.");
                      setShowPermissionErrorModal(true);
                    });
                }}
                style={{
                  background: "#007bff",
                  border: "none",
                  color: "#fff",
                  padding: "8px 16px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}

      <style>{`

        @keyframes slideInRight {

          from {

            transform: translateX(100%);

            opacity: 0;

          }

          to {

            transform: translateX(0);

            opacity: 1;

          }

        }

        

        @keyframes slideIn {

          from {

            transform: translateY(-10px);

            opacity: 0;

          }

          to {

            transform: translateY(0);

            opacity: 1;

          }

        }

        

        @keyframes pulse {

          0% {

            opacity: 1;

          }

          50% {

            opacity: 0.5;

          }

          100% {

            opacity: 1;

          }

        }

        

        .commonJoinderBtn:disabled {

          opacity: 0.5;

          cursor: no-drop;

        }

        

        .leaveMeetingButton:disabled {

          opacity: 0.5;

          cursor: not-allowed;

          pointer-events: none;

        }

      `}</style>



      {error && (

        <div

          style={{

            position: "fixed",

            top: "20px",

            right: "20px",

            background: "#ff4b5c",

            color: "#fff",

            padding: "12px 16px",

            borderRadius: "8px",

            zIndex: 1000,

            maxWidth: "300px",

            maxHeight: "80vh",

            overflow: "auto",

            display: "flex",

            flexDirection: "column",

            gap: "8px",

            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",

          }}

        >

          <button

            onClick={() => {

              setError("");

            }}

            style={{

              position: "absolute",

              top: "4px",

              right: "4px",

              background: "none",

              border: "none",

              color: "#fff",

              fontSize: "16px",

              cursor: "pointer",

              padding: "0",

              width: "20px",

              height: "20px",

              display: "flex",

              alignItems: "center",

              justifyContent: "center",

            }}

          >

            ×

          </button>

          <div>{error}</div>

          {error.includes("permissions") && (

            <button

              onClick={() => {

                // Only request camera permissions if video is not off from preview

                const mediaConstraints = initialVideoOff

                  ? { audio: true }

                  : { video: true, audio: true };



                navigator.mediaDevices

                  .getUserMedia(mediaConstraints)

                  .then(() => {

                    setError("");

                    // Retry fetching devices

                    const initializeDevices = async () => {

                      try {

                        const devices = await ZoomVideo.getDevices();

                        const cams = devices.filter(

                          (d) => d.kind === "videoinput"

                        );

                        const mics = devices.filter(

                          (d) => d.kind === "audioinput"

                        );

                        const speakers = devices.filter(

                          (d) => d.kind === "audiooutput"

                        );

                        setVideoDevices(cams);

                        setAudioDevices(mics);

                        setSpeakerDevices(speakers);

                        if (!selectedCamera && cams[0])

                          setSelectedCamera(cams[0].deviceId);

                        if (!selectedMic && mics[0])

                          setSelectedMic(mics[0].deviceId);

                        if (!selectedSpeaker && speakers[0])

                          setSelectedSpeaker(speakers[0].deviceId);

                      } catch (err) {

                        console.log("Retry failed:", err);

                      }

                    };

                    initializeDevices();

                  })

                  .catch((err) => {

                    console.log("Permission request failed:", err);

                  });

              }}

              style={{

                background: "#fff",

                color: "#ff4b5c",

                border: "none",

                borderRadius: "4px",

                padding: "4px 8px",

                fontSize: "12px",

                cursor: "pointer",

                fontWeight: "bold",

              }}

            >

              Grant Permissions

            </button>

          )}

        </div>

      )}

    </div>

  );

}



export default JoinerScreen;

