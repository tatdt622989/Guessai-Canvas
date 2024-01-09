import { useState, useRef, useCallback, useEffect } from "react";
import type { RootState } from "@/store/store";
import { useSelector, useDispatch } from "react-redux";
import { setName, setPhotoURL, setScore } from "@/store/userSlice";
import { setSignUpModal } from "@/components/Modal/modalSlice";
import API_URL from "@/config";
import UserIcon from "@/assets/user.svg?react";
import UploadIcon from "@/assets/upload.svg?react";
import "./SignUpModal.scss";

interface ReCaptchaV2 {
	ready: (callback: () => void) => void;
	execute: (siteKey: string, options: { action: string }) => Promise<string>;
}

declare global {
	interface Window {
		grecaptcha: ReCaptchaV2;
	}
}

interface UserRes {
	name: string;
	photo: string;
	score: number;
}

function SignUpModal() {
	const dispatch = useDispatch();
  const modalStatus = useSelector(
    (state: RootState) => state.modal.SignUpModal
  );
	const [username, setUsername] = useState('');
	const [photo, setPhoto] = useState<Blob | null>(null);
	const [photoName, setPhotoName] = useState('');
	const [photoBase64, setPhotoBase64] = useState('');

	const handleVerifyCaptcha = useCallback(async () => {
		return new Promise((resolve, reject) => {
			(window).grecaptcha.ready(() => {
				(window).grecaptcha.execute('6LeeIuglAAAAAGa_otd0JHxSOUQbFttupNnSHEuT', { action: 'submit' }).then(token => {
					resolve(token);
				}).catch(err => {
					reject(err);
				});
			});
		});
  }, []);

	const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			setPhoto(file);
			setPhotoName(file.name);
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => {
				setPhotoBase64(reader.result as string);
			};
		}
	}, []);

	const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setUsername(e.target.value);
	}, []);

  const createUser = useCallback(async () => {
		const token = await handleVerifyCaptcha();
		const api = `${API_URL}/guessai_canvas/simple_user/`;
		const formData = new FormData();
		formData.append('name', username);
		if (photo) {
			formData.append('photo', photo, photoName);
		}
		formData.append('token', String(token));
		try {
			const response = await fetch(api, {
				method: 'POST',
				body: formData
			});
			const data: UserRes = await response.json();
			dispatch(setName(data.name));
			dispatch(setPhotoURL(data.photo));
			dispatch(setScore(data.score));
			dispatch(setSignUpModal(false));
		} catch (err) {
			alert(err);
		}
  }, [dispatch, handleVerifyCaptcha, photo, photoName, username]);

  return (
    <div
      className={`modal ${modalStatus ? "fade show" : ""}`}
      tabIndex={-1}
      style={{ display: `${modalStatus ? "block" : "none"}` }}
      id="signUpModal"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0">
          <div className="modal-header">
            <h5 className="modal-title text-center mx-auto">GuessAI Canvas</h5>
          </div>
          <div className="modal-body">
            <form action="" onSubmit={(e) => e.preventDefault()}>
              <div className="photo-wrap d-flex justify-content-center align-items-center mx-auto">
                { photoBase64 ? <img className="w-100 rounded-circle h-100" src={photoBase64} /> : <UserIcon className="icon" /> }
                <div className="upload-btn d-flex justify-content-center align-items-center">
                  <label
                    htmlFor="userPhoto"
                    className="position-absolute w-100 h-100 top-0 left-0"
                  >
                    <input type="file" name="userPhoto" id="userPhoto" onChange={handlePhotoChange} />
                  </label>
                  <UploadIcon className="icon position-relative" />
                </div>
              </div>
              <div className="mb-4">
                <input
                  className="form-control form-control-lg user-name"
                  type="text"
                  placeholder="Name"
                  aria-label="Name"
									value={username}
									onChange={handleUsernameChange}
                />
              </div>
              <button
                className="btn btn-primary start-btn w-100"
                onClick={createUser}
              >
                START
              </button>
              <p className="recaptchaInfo">
                This site is protected by reCAPTCHA and the Google{" "}
                <a href="https://policies.google.com/privacy">Privacy Policy</a>{" "}
                and{" "}
                <a href="https://policies.google.com/terms">Terms of Service</a>{" "}
                apply.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUpModal;
