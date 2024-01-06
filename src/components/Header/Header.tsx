import { useState } from "react";
import UserIcon from "@/assets/user.svg?react";
import "./Header.scss";

function Header() {
  return (
    <div className="header d-flex justify-content-center justify-content-sm-between align-items-center mb-2 mb-sm-0">
      <h1 className="title mb-2 mb-sm-0">GuessAI Canvas</h1>
      <div className="info d-flex align-items-center">
        <span className="user-name">6yuwei</span>
        <div className="user-photo d-flex justify-content-center align-items-center">
          {/* <img src="" alt="" /> */}
          <UserIcon className="icon" />
        </div>
      </div>
    </div>
  );
}

export default Header;
