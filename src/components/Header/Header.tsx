import { useState } from "react";
import type { RootState } from "@/store/store";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { setName, setPhotoURL, setScore } from "@/store/UserSlice";
import UserIcon from "@/assets/user.svg?react";
import "./Header.scss";

function Header() {
  const nameStatus = useAppSelector(
    (state: RootState) => state.user.name
  );
  const photoURLStatus = useAppSelector(
    (state: RootState) => state.user.photoURL
  );

  return (
    <div className="header d-flex justify-content-center justify-content-sm-between align-items-center mb-2 mb-sm-0">
      <h1 className="title mb-2 mb-sm-0">GuessAI Canvas</h1>
      <div className="info d-flex align-items-center">
        <span className="user-name">{nameStatus}</span>
        <div className="user-photo d-flex justify-content-center align-items-center">
          {photoURLStatus ? <img className="w-100 rounded-circle h-100" src={photoURLStatus}/> : <UserIcon className="icon" />}
        </div>
      </div>
    </div>
  );
}

export default Header;
