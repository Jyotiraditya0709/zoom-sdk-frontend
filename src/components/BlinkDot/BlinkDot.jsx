import React from "react";
import "./BlinkDotStyle.css";

export default function BlinkDot({ label = "REC" }) {
  return (
    <div className="blink-wrapper">
      <span className="blink-dot" />
    </div>
  );
}
