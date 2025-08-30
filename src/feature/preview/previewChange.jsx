import React, { useEffect, useRef, useState } from "react";
import ZoomVideo from "@zoom/videosdk";
import { useNavigate, useLocation } from "react-router-dom";
import "./PreJoin.css";
import {
  MicroPhone,
  NoSpeakerIcon,
  OffVideoCamera,
  RightArrow,
  SpeakerIcon,
  UnMicroPhone,
  VideoCamera,
} from "../../icon/icon";
import Header from "../../Layout/Header/Header";
import { useZoom } from "./ZoomContext";
import config from "../../config/config";

// Persistent module-level tracks
let localVideoTrack = null;
let localAudioTrack = null;

const PreJoin = () => {
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const meetingId = params.get("meetingId");
    const userId = params.get("userId");
    const agenda = params.get("agenda");
    const status = params.get("status");
    const userTypeParam = params.get("userType");
    const roleParam = params.get("role");

    if (meetingId && userId) {
      setSessionName(meetingId);
      setUserName(userId);

      if (userTypeParam) {
        setUserType(userTypeParam);
      }

      if (roleParam) {
        setRole(roleParam);
      }

      console.log("�� Pre-filled meeting data:", {
        meetingId,
        userId,
        agenda,
        status,
        userType: userTypeParam,
        role: roleParam,
      });
    }
  }, [location.search]);

  const navigate = useNavigate();

  const videoRef = useRef(null);

  const {
    selectedCamera,
    setSelectedCamera,
    selectedMic,
    setSelectedMic,
    selectedSpeaker,
    setSelectedSpeaker,
    sessionName,
    setSessionName,
    userName,
    setUserName,
    bgMode,
    setBgMode,
    cleanup: contextCleanup,
  } = useZoom();

  // Add local state for role
  const [role, setRole] = useState("1"); // 1 = host, 0 = attendee
  const [userType, setUserType] = useState(""); // mentor or mentee

  // ========== State for selected options ==========
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]); // mic array
  const [speakerDevices, setSpeakerDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micTestPhase, setMicTestPhase] = useState("idle"); // idle | recording | playing
  const [micTestPlaybackTimeout, setMicTestPlaybackTimeout] = useState(null);
  const [micTestPlaybackWarning, setMicTestPlaybackWarning] = useState("");
  const microPhoneTesterRef = useRef(null);

  // Add missing state variables
  const [isMute, setIsMute] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [volume, setVolume] = useState(50);

  // Add agenda state
  const [agendaData, setAgendaData] = useState(null);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaError, setAgendaError] = useState("");

  const client = useRef(null);

  // Volume slider change
  const handleVolumeChange = (e) => {
    setVolume(Number(e.target.value));
  };

  // Fetch agenda data from database
  const fetchAgendaData = async (meetingId, userId) => {
    if (!meetingId || !userId) return;

    setAgendaLoading(true);
    setAgendaError("");

    try {
      // Add timeout and better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        config.getApiUrl(
          `${config.API_ENDPOINTS.GET_MEETING_INFO}/${meetingId}/${userId}`
        ),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          console.warn("⚠️ Meeting not found, using default agenda");
          setAgendaData({
            agenda: "Meeting Session - General discussion and collaboration",
            meetingId: meetingId,
            startTime: null,
            endTime: null,
            meetingStatus: "pending",
          });
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.IsSuccess && data.Data) {
        setAgendaData({
          agenda: data.Data.agenda || "No agenda available",
          meetingId: data.Data.meetingId,
          startTime: data.Data.startTime,
          endTime: data.Data.endTime,
          meetingStatus: data.Data.meetingStatus,
        });
        console.log("✅ Agenda data fetched:", data.Data);
      } else {
        throw new Error(data.Message || "Failed to fetch agenda data");
      }
    } catch (err) {
      console.error("❌ Failed to fetch agenda data:", err);

      // Handle specific error types
      if (err.name === "AbortError") {
        setAgendaError("Request timeout - please check your connection");
      } else if (err.message.includes("Failed to fetch")) {
        setAgendaError("Network error - please check your connection");
      } else {
        setAgendaError("Failed to load agenda data");
      }

      // Set default agenda if API fails
      setAgendaData({
        agenda: "Meeting Session - General discussion and collaboration",
        meetingId: meetingId,
        startTime: null,
        endTime: null,
        meetingStatus: "pending",
      });
    } finally {
      setAgendaLoading(false);
    }
  };

  // ===== Fetch devices =====
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const devices = await ZoomVideo.getDevices();
        const cams = devices.filter((d) => d.kind === "videoinput");
        const mics = devices.filter((d) => d.kind === "audioinput");
        const speakers = devices.filter((d) => d.kind === "audiooutput");

        setVideoDevices(cams);
        setAudioDevices(mics);
        setSpeakerDevices(speakers);
        setSelectedCamera(cams[0]?.deviceId || "");
        setSelectedMic(mics[0]?.deviceId || "");
        setSelectedSpeaker(speakers[0]?.deviceId || "");
      } catch (err) {
        console.error("Error fetching devices:", err);
        setError(
          "Failed to fetch devices. Please allow camera/mic permissions."
        );
      }
    };
    fetchDevices();
  }, []);

  // Fetch agenda data when component mounts
  useEffect(() => {
    if (sessionName && userName) {
      fetchAgendaData(sessionName, userName);
    }
  }, [sessionName, userName]);

  // ========== Cleanup function ==========
  // Removed duplicate cleanup, use contextCleanup instead

  // ========== Start Preview Camera and Mic ==========
  const startPreview = async () => {
    setIsLoading(true);
    setError("");
    try {
      await contextCleanup();
      client.current = ZoomVideo.createClient();
      await client.current.init("en-US", "Global", {
        patchJsMedia: true,
        enforceVirtualBackground: true,
        virtualBackground: {
          isSupport: true,
          // resources: {
          //   dir: "/lib",
          // },
        },
      });
      // Create and start video track
      if (!localVideoTrack) {
        localVideoTrack = ZoomVideo.createLocalVideoTrack(selectedCamera);
      }
      if (bgMode === "none") {
        await localVideoTrack.start(videoRef.current);
        await localVideoTrack.updateVirtualBackground(undefined);
      } else if (bgMode === "blur") {
        await localVideoTrack.start(
          document.querySelector("#local-preview-video"),
          { imageUrl: "blur" }
        );
      } else if (bgMode === "image") {
        await localVideoTrack.start(
          document.querySelector("#local-preview-video"),
          {
            imageUrl: "/lib/vb-resource/background.jpg",
          }
        );
      }
      // Create and start audio track
      if (!localAudioTrack) {
        localAudioTrack = ZoomVideo.createLocalAudioTrack(selectedMic);
      }
      await localAudioTrack.start();
      await localAudioTrack.unmute();
    } catch (err) {
      // Suppress the "play() request was interrupted" warning for the user
      if (
        err?.message?.includes(
          "The play() request was interrupted by a new load request"
        ) ||
        err?.message?.includes("https://goo.gl/LdLk22")
      ) {
        // Only log to console, do not set user-facing error
        console.warn("Preview warning:", err.message);
        return;
      }
      if (err.name === "NotReadableError") {
        setError(
          "Camera or microphone is already in use by another application. Please close other apps and try again."
        );
      } else {
        setError("Failed to start preview: " + (err.reason || err.message));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ========== Update Virtual Background on Change ==========
  useEffect(() => {
    const updateVB = async () => {
      if (!localVideoTrack) return;
      try {
        // Only stop if the track is started (SDK may not expose isStarted, so try-catch is safest)
        try {
          await localVideoTrack.stop();
        } catch (err) {
          if (err.message && err.message.includes("VideoNotStartedError")) {
            // Ignore, just proceed
          } else {
            throw err;
          }
        }
        if (bgMode === "none") {
          await localVideoTrack.start(videoRef.current);
          await localVideoTrack.updateVirtualBackground(undefined);
        } else if (bgMode === "blur") {
          await localVideoTrack.start(
            document.querySelector("#local-preview-video"),
            { imageUrl: "blur" }
          );
        } else if (bgMode === "image") {
          await localVideoTrack.start(
            document.querySelector("#local-preview-video"),
            {
              imageUrl: "/lib/vb-resource/background.jpg",
            }
          );
        }
      } catch (err) {
        if (err.message && err.message.includes("VideoNotStartedError")) {
          // Try to start the video anyway
          try {
            if (bgMode === "none") {
              await localVideoTrack.start(videoRef.current);
              await localVideoTrack.updateVirtualBackground(undefined);
            } else if (bgMode === "blur") {
              await localVideoTrack.start(
                document.querySelector("#local-preview-video"),
                {
                  imageUrl: "blur",
                }
              );
            } else if (bgMode === "image") {
              await localVideoTrack.start(
                document.querySelector("#local-preview-video"),
                {
                  imageUrl: "/lib/vb-resource/background.jpg",
                }
              );
            }
          } catch (e) {
            setError(
              "Failed to update virtual background: " + (e.reason || e.message)
            );
          }
          return;
        }
        setError(
          "Failed to update virtual background: " + (err.reason || err.message)
        );
      }
    };
    // Only run if the video element is mounted and bgMode changes
    if (videoRef.current) {
      updateVB();
    }
  }, [bgMode]);

  useEffect(() => {
    if (selectedCamera && selectedMic) startPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCamera, selectedMic]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      contextCleanup();
    };
  }, []);

  // ========== Join Meeting Handler ==========
  const handleJoin = async () => {
    // Stop the preview tracks to release the camera and microphone
    if (localVideoTrack) {
      await localVideoTrack.stop();
    }
    if (localAudioTrack) {
      await localAudioTrack.stop();
    }
    // Clean up module-level variables
    localVideoTrack = null;
    localAudioTrack = null;

    // The context will be updated with the latest user/session name from the input fields
    await contextCleanup(); // Clean up any other context-related resources

    // Get meeting data from URL parameters
    const params = new URLSearchParams(location.search);
    const meetingId = params.get("meetingId");
    const userId = params.get("userId");

    if (meetingId && userId) {
      // Navigate to meeting with URL parameters
      navigate(`/meeting/${meetingId}/${userId}?role=${role}`);
    } else {
      // Fallback to old format
      navigate(
        `/meeting?session=${encodeURIComponent(
          sessionName
        )}&user=${encodeURIComponent(userName)}&role=${role}`
      );
    }
  };

  // ========== Mic Testing Feature ==========
  const handleMicTest = () => {
    if (!localAudioTrack) {
      setError("Please start preview first");
      return;
    }
    if (microPhoneTesterRef.current) {
      microPhoneTesterRef.current.stop();
      microPhoneTesterRef.current = null;
      setIsMicTesting(false);
      setMicLevel(0);
      setMicTestPhase("idle");
      setMicTestPlaybackWarning("");
      if (micTestPlaybackTimeout) {
        clearTimeout(micTestPlaybackTimeout);
        setMicTestPlaybackTimeout(null);
      }
      return;
    }
    try {
      setIsMicTesting(true);
      setMicTestPhase("recording");
      setMicTestPlaybackWarning("");
      microPhoneTesterRef.current = localAudioTrack.testMicrophone({
        microphoneId: selectedMic,
        speakerId: selectedSpeaker,
        recordAndPlay: true,
        onAnalyseFrequency: (v) => {
          setMicLevel(Math.round(v * 100));
        },
        onStartRecording: () => {
          setMicTestPhase("recording");
        },
        onStartPlayRecording: () => {
          setMicTestPhase("playing");
          if (micTestPlaybackTimeout) {
            clearTimeout(micTestPlaybackTimeout);
            setMicTestPlaybackTimeout(null);
          }
        },
        onStopPlayRecording: () => {
          microPhoneTesterRef.current = null;
          setIsMicTesting(false);
          setMicLevel(0);
          setMicTestPhase("idle");
          setMicTestPlaybackWarning("");
          if (micTestPlaybackTimeout) {
            clearTimeout(micTestPlaybackTimeout);
            setMicTestPlaybackTimeout(null);
          }
        },
      });
      // Fallback: if playback doesn't start after 5 seconds, show warning
      const timeout = setTimeout(() => {
        if (micTestPhase === "recording") {
          setMicTestPlaybackWarning(
            "Playback not supported in this environment or browser. You may not hear your recording."
          );
        }
      }, 5000);
      setMicTestPlaybackTimeout(timeout);
    } catch (err) {
      console.error("Error testing microphone:", err);
      setError("Failed to test microphone");
      setIsMicTesting(false);
      setMicLevel(0);
      setMicTestPhase("idle");
      setMicTestPlaybackWarning("");
      if (micTestPlaybackTimeout) {
        clearTimeout(micTestPlaybackTimeout);
        setMicTestPlaybackTimeout(null);
      }
    }
  };

  // ========== Speaker Test ==========
  let speakerTester;
  const handleSpeakerTest = () => {
    if (!localAudioTrack) {
      setError("Please start preview first");
      return;
    }
    const levelElm = document.querySelector("#speaker-output-level");
    if (speakerTester) {
      speakerTester.destroy();
      speakerTester = null;
      return;
    }
    try {
      speakerTester = localAudioTrack.testSpeaker({
        speakerId: selectedSpeaker,
        onAnalyseFrequency: (v) => {
          if (levelElm) levelElm.value = v;
        },
      });
    } catch (err) {
      console.error("Error testing speaker:", err);
      setError("Failed to test speaker");
    }
  };

  return (
    <div className="mainMeetingContainer">
      <Header
        userEmail={`${userName}@example.com`}
        userName={userName}
        meetingTitle={
          agendaData?.agenda ||
          "Meeting Session - General discussion and collaboration"
        }
        showTimer={false}
      />
      <div className="videoCallContainer">
        <div className="videoCallDetailBlock">
          <div className="meetingDetailWrapper">
            {/* LEFT PREVIEW */}
            <div className="leftMeetingDetail">
              <video-player-container
                className="local-preview-container"
                style={{ width: "100%", height: "100%", background: "black" }}
              >
                {bgMode === "none" ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{ width: "100%", height: "100%" }}
                  ></video>
                ) : (
                  <video-player
                    ref={videoRef}
                    id="local-preview-video"
                    style={{ width: "100%", height: "100%" }}
                  ></video-player>
                )}
                <div className="buttonZoomSetting">
                  <button
                    onClick={async () => {
                      if (localAudioTrack) {
                        try {
                          if (isMute) {
                            await localAudioTrack.unmute();
                          } else {
                            await localAudioTrack.mute();
                          }
                          setIsMute(!isMute);
                        } catch (err) {
                          console.error("Error toggling audio:", err);
                        }
                      }
                    }}
                  >
                    {isMute ? <MicroPhone /> : <UnMicroPhone />}
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        if (isVideoOff) {
                          // Turn camera back on - recreate the track
                          if (!localVideoTrack) {
                            localVideoTrack =
                              ZoomVideo.createLocalVideoTrack(selectedCamera);
                          }
                          if (bgMode === "none") {
                            await localVideoTrack.start(videoRef.current);
                          } else if (bgMode === "blur") {
                            await localVideoTrack.start(
                              document.querySelector("#local-preview-video"),
                              { imageUrl: "blur" }
                            );
                          } else if (bgMode === "image") {
                            await localVideoTrack.start(
                              document.querySelector("#local-preview-video"),
                              {
                                imageUrl: "/lib/vb-resource/background.jpg",
                              }
                            );
                          }
                        } else {
                          // Turn camera off - completely release the track
                          if (localVideoTrack) {
                            await localVideoTrack.stop();

                            // Clear the video element
                            if (videoRef.current) {
                              videoRef.current.srcObject = null;
                            }

                            // Stop all tracks in the media stream to release camera
                            if (localVideoTrack.mediaStream) {
                              localVideoTrack.mediaStream
                                .getTracks()
                                .forEach((track) => {
                                  track.stop();
                                });
                            }

                            // Release the track completely
                            localVideoTrack = null;
                          }
                        }
                        setIsVideoOff(!isVideoOff);
                      } catch (err) {
                        console.error("Error toggling video:", err);
                      }
                    }}
                  >
                    {isVideoOff ? <OffVideoCamera /> : <VideoCamera />}
                  </button>
                </div>
              </video-player-container>
              {isLoading && <div className="loading">Starting preview...</div>}
              {error && <div className="error">{error}</div>}

              <div className="bottomControls">
                <button
                  className="commonTextBtn testMicrophone"
                  onClick={handleMicTest}
                >
                  {micTestPhase === "recording"
                    ? "Recording..."
                    : micTestPhase === "playing"
                      ? "Playing..."
                      : isMicTesting
                        ? "Stop"
                        : "Test Microphone"}
                </button>
                <progress
                  id="mic-input-level"
                  value={micLevel}
                  max={100}
                  style={{}}
                ></progress>
                {micTestPlaybackWarning && (
                  <div style={{ color: "orange", marginTop: 4 }}>
                    {micTestPlaybackWarning}
                  </div>
                )}

                <button
                  className="commonTextBtn testSpeaker"
                  onClick={handleSpeakerTest}
                >
                  Test Speaker
                </button>

                <div className="sliderMeetingWrapper">
                  {volume === 0 ? <NoSpeakerIcon /> : <SpeakerIcon />}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="slider"
                  />
                </div>
              </div>
            </div>

            {/* RIGHT SETTINGS */}
            <div className="rightMeetingDetail">
              <h2>Ready to Join?</h2>

              <div>
                <div className="commonDetail">
                  <span>Joinee: </span>
                  <p>{userName}</p>
                </div>
                <div className="commonDetail">
                  <span>Agenda: </span>
                  {agendaLoading ? (
                    <p
                      className="lineClamp"
                      style={{ color: "#666", fontStyle: "italic" }}
                    >
                      Loading agenda...
                    </p>
                  ) : agendaError ? (
                    <p className="lineClamp" style={{ color: "#dc2626" }}>
                      ⚠️ {agendaError}
                    </p>
                  ) : agendaData ? (
                    <p className="lineClamp">
                      {agendaData.agenda || "No agenda available"}
                    </p>
                  ) : (
                    <p
                      className="lineClamp"
                      style={{ color: "#666", fontStyle: "italic" }}
                    >
                      Meeting Session - General discussion and collaboration
                    </p>
                  )}
                </div>
              </div>

              <div className="colGap12 settingOptionGroup">
                {/* Camera */}
                <div className="dropdownWrapper">
                  <select
                    className="dropdownMeeting"
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                  >
                    {videoDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mic */}
                <div className="dropdownWrapper">
                  <select
                    className="dropdownMeeting"
                    value={selectedMic}
                    onChange={(e) => setSelectedMic(e.target.value)}
                  >
                    {audioDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Speaker */}
                <div className="dropdownWrapper">
                  <select
                    className="dropdownMeeting"
                    value={selectedSpeaker}
                    onChange={(e) => setSelectedSpeaker(e.target.value)}
                  >
                    {speakerDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Background */}
                <div className="dropdownWrapper">
                  <select
                    className="dropdownMeeting"
                    value={bgMode}
                    onChange={(e) => setBgMode(e.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="blur">Blur</option>
                    <option value="image">Image</option>
                  </select>
                </div>
              </div>

              <button
                className="joinMeeting"
                onClick={handleJoin}
                disabled={isLoading || !selectedCamera || !selectedMic}
              >
                {isLoading ? (
                  "Starting..."
                ) : (
                  <>
                    Join Meeting <RightArrow />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bottom Controls */}
        </div>
      </div>
    </div>
  );
};

export default PreJoin;
