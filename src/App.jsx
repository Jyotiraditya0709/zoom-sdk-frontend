import React from "react";
import { Routes, Route } from "react-router-dom";
import PreJoin from "./feature/preview/previewChange";

import MeetingLeft from "./feature/preview/MeetingLeft";
import Feedback from "./feature/preview/Feedback";
import MeetingValidator from "./feature/preview/MeetingValidator";
import MeetingExit from "./feature/preview/MeetingExit";
import MeetingRedirect from "./feature/preview/MeetingRedirect";
import { ZoomProvider } from "./feature/preview/ZoomContext";
import { MeetingProvider } from "./contexts/MeetingContext";
import JoinerScreen from "./feature/preview/JoinerScreen";
import MeetingCreator from "./components/MeetingCreator/MeetingCreator";

import "./App.css";
import DefaultPage from "./components/DefaultPage";

const App = () => {
  return (
    <MeetingProvider>
      <ZoomProvider>
        <Routes>
          <Route path="/" element={<DefaultPage />} />
          <Route path="/create-meeting-12j" element={<MeetingCreator />} />
          <Route path="/joiner-screen" element={<JoinerScreen />} />
          <Route path="/pre-join" element={<PreJoin />} />
          <Route
            path="/pre-join/:meetingId/:userId"
            element={<MeetingValidator />}
          />

          <Route path="/meeting/:meetingId/:userId" element={<JoinerScreen />} />
          <Route path="/meeting-left" element={<MeetingLeft />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/meeting-exit" element={<MeetingExit />} />
          <Route path="/meeting-redirect" element={<MeetingRedirect />} />
        </Routes>
      </ZoomProvider>
    </MeetingProvider>
  );
};

export default App;
