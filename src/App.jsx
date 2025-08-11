import React from "react";
import { Routes, Route } from "react-router-dom";
import Preview from "./feature/preview/preview";

import MeetingPage from "./feature/preview/MeetingPage";
import MeetingLeft from "./feature/preview/MeetingLeft";
import Feedback from "./feature/preview/Feedback";
import MeetingValidator from "./feature/preview/MeetingValidator";
import { ZoomProvider } from "./feature/preview/ZoomContext";

import "./App.css";

const App = () => {
  return (
    <ZoomProvider>
      <Routes>
        <Route
          path="/preview/:meetingId/:userId"
          element={<MeetingValidator />}
        />
        <Route path="/preview" element={<Preview />} />
        <Route path="/meeting/:meetingId/:userId" element={<MeetingPage />} />
        <Route path="/meeting-left" element={<MeetingLeft />} />
        <Route path="/feedback" element={<Feedback />} />
      </Routes>
    </ZoomProvider>
  );
};

export default App;
