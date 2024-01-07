import { useState } from "react";
import type { RootState } from '@/store/store'
import { useSelector, useDispatch } from 'react-redux'
import UserIcon from "@/assets/user.svg?react";
import UploadIcon from "@/assets/upload.svg?react";
import "./SignUpModal.scss";

function SignUpModal() {
	const modalStatus = useSelector((state: RootState) => state.modal.SignUpModal);

  return (
		<div className={`modal ${modalStatus ? 'fade show' : ''}`} tabIndex={-1} style={{display: `${modalStatus ? 'block' : 'none'}`}} id="signUpModal">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0">
          <div className="modal-header">
            <h5 className="modal-title text-center mx-auto">GuessAI Canvas</h5>
          </div>
          <div className="modal-body">
            <form action="" onSubmit={(e) => e.preventDefault()}>
							<div className="photo-wrap d-flex justify-content-center align-items-center mx-auto">
								{/* <img src="" alt="" /> */}
								<UserIcon className="icon" />
								<div className="upload-btn d-flex justify-content-center align-items-center">
									<label htmlFor="userPhoto" className="position-absolute w-100 h-100 top-0 left-0">
										<input type="file" name="userPhoto" id="userPhoto" />
									</label>
									<UploadIcon className="icon position-relative" />
								</div>
							</div>
								<div className="mb-4">
									<input className="form-control form-control-lg user-name" type="text" placeholder="Name" aria-label="Name" />
								</div>
								<button className="btn btn-primary start-btn w-100">
									START
								</button>
						</form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUpModal;
