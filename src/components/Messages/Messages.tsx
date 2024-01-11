import { useState } from "react";
import "./Messages.scss";

function Messages() {
  return (
    <div className="messages">
      <div className="messages-container w-100">
        <div className="messages-wrap overflow-hidden">
          <div className="messages-content">
            <div className="messages-item d-flex align-items-start mb-3">
              <div className="photo me-3">
                <img src="https://via.placeholder.com/150" alt="User" />
              </div>
              <div className="text">
                <p className="name mb-0">我是中文User666</p>
                <p className="message mb-0">
                  我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文Hello,
                  I am User666
                </p>
              </div>
            </div>
            <div className="messages-item d-flex align-items-start  mb-3">
              <div className="photo me-3">
                <img src="https://via.placeholder.com/150" alt="User" />
              </div>
              <div className="text">
                <p className="name mb-0">我是中文User666</p>
                <p className="message mb-0 correct">
                  中文我是我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文I
                  am User666
                </p>
              </div>
            </div>
            <div className="messages-item d-flex align-items-start  mb-3">
              <div className="photo me-3">
                <img src="https://via.placeholder.com/150" alt="User" />
              </div>
              <div className="text">
                <p className="name mb-0">我是中文User666</p>
                <p className="message mb-0">
                  中文我是我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文I
                  am User666
                </p>
              </div>
            </div>
            <div className="messages-item d-flex align-items-start  mb-3">
              <div className="photo me-3">
                <img src="https://via.placeholder.com/150" alt="User" />
              </div>
              <div className="text">
                <p className="name mb-0">我是中文User666</p>
                <p className="message mb-0">
                  中文我是我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文I
                  am User666
                </p>
              </div>
            </div>
            <div className="messages-item d-flex align-items-start  mb-3">
              <div className="photo me-3">
                <img src="https://via.placeholder.com/150" alt="User" />
              </div>
              <div className="text">
                <p className="name mb-0">我是中文User666</p>
                <p className="message mb-0">
                  中文我是我是中文我是中文我是中文我是中文我是中文我是中文我是中文我是中文I
                  am User666
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="messages-input w-100">
          <input
            type="text"
            className="form-control"
            placeholder="Please guess what the AI drew..."
          />
          <button className="send-btn btn btn-primary">Send</button>
        </div>
      </div>
    </div>
  );
}

export default Messages;
