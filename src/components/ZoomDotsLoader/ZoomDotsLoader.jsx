import React from "react";
import "./ZoomDotsLoader.css";

function ZoomDotsLoader() {
  return (
    <div className="zoom-loader-page">
      <div className="loadingZoom">
        <div className="d1"></div>
        <div className="d2"></div>
      </div>
      <p className="zoom-loader-text">Loading...</p>
    </div>
  );
}

export default ZoomDotsLoader;
