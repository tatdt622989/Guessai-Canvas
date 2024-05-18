import type { RootState } from "@/store/store";
import { useAppSelector } from "@/store/store";
// import { setPhotoURL } from "@/store/UserSlice.ts";
import { API_URL } from "@/config";
import UserIcon from "@/assets/user.svg?react";
import UploadIcon from "@/assets/upload.svg?react";
import HistoryIcon from "@/assets/history.svg?react";
import HomeIcon from "@/assets/home.svg?react";
import "./Header.scss";
import { useCallback } from "react";
import { Link, useLocation } from 'react-router-dom';

interface Props {
  handleResize: () => void;
}

function Header(props: Props) {
  const nameStatus = useAppSelector((state: RootState) => state.user.name);
  const photoURLStatus = useAppSelector(
    (state: RootState) => state.user.photoURL
  );
  const location = useLocation();
  // const dispatch = useAppDispatch();

  const handlePhotoChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        console.log(file);
        const formData = new FormData();
        formData.append("photo", file);
        const res = await fetch(`${API_URL}/guessai_canvas/simple_user/`, {
          method: "PUT",
          credentials: "include",
          body: formData,
        });
        const data = await res.json();
        if (data.simpleUser && data.simpleUser.photo) {
          window.location.reload();
        }
      }
    }
  , []);

  return (
    <div className="header d-flex justify-content-center justify-content-sm-between align-items-center mb-2 mb-sm-0">
      <h1 className="title mb-2 mb-sm-0">GuessAI Canvas</h1>
      <div className="info d-flex align-items-center">
        <span className="user-name">{nameStatus}</span>
        <div className="user-photo d-flex justify-content-center align-items-center">
          {photoURLStatus ? (
            <img className="w-100 rounded-circle h-100" src={photoURLStatus} />
          ) : (
            <UserIcon className="icon" />
          )}
          <label className="upload-img">
            <UploadIcon className="icon position-relative" />
            <input type="file" 
            onChange={handlePhotoChange} />
          </label>
        </div>
        {(location.pathname === '/') ?
          <Link to={
            `/gallery/1`
          } className="btn btn-primary gallery-btn d-flex justify-content-center align-items-center">
            <HistoryIcon className="icon" />
          </Link> : 
          <Link to="/" className="btn btn-primary gallery-btn d-flex justify-content-center align-items-center" onClick={() => {
            setTimeout(() => props.handleResize(), 100);
          }}>
            <HomeIcon className="icon" />
          </Link>
        }
      </div>
    </div>
  );
}

export default Header;
