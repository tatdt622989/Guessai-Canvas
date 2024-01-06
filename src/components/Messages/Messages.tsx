import { useState } from "react";
import "./Messages.scss";

function Messages() {
  return (
    <div className="messages">
      <div className="messages-container w-100">
        <div className="messages-content"></div>
        <div className="messages-input w-100">
          <input type="text" className="form-control messages-input" placeholder="Please guess what the AI drew..." />
          <button className="send-btn btn btn-primary">Send</button>
        </div>
      </div>
    </div>
  );
}

export default Messages;