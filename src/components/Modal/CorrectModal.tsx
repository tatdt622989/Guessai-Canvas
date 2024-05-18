import { useEffect, useMemo, useState } from "react";
import type { RootState } from "@/store/store";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { setCorrectModal } from "@/components/Modal/ModalSlice.ts";
import { socket } from "@/socket";
import { API_URL } from "@/config";
import UserIcon from "@/assets/user.svg?react";
import "./CorrectModal.scss";

interface CanvasRes {
  status: string;
  prevAnswer: {
    answerTW: string;
    answerEN: string;
    answerJP: string;
  };
  correctRespondent: {
    name: string;
    photo: string;
  }
}

function CorrectModal() {
  const modalStatus = useAppSelector(
    (state: RootState) => state.modal.correctModal
  );
  const dispatch = useAppDispatch();
  const [canvasData, setCanvasData] = useState<CanvasRes | null>(null);

  useEffect(() => {
    function onCanvasReceive(data: CanvasRes) {
      if (!data) return;
      if (data.status !== "loading") return;
      setCanvasData(data);
      dispatch(setCorrectModal(true));
    }
    socket.on("server canvas", onCanvasReceive);
    return () => {
      socket.off("server canvas", onCanvasReceive);
    };
  }, []);

  const joinAnswer = useMemo(() => {
    if (!canvasData) return "";
    if (!canvasData.prevAnswer) return "";
    return [canvasData.prevAnswer.answerTW, canvasData.prevAnswer.answerEN, canvasData.prevAnswer.answerJP].join(", ");
  }, [canvasData]);

  return (
    <div 
      className={`modal ${modalStatus ? "fade show" : ""}`}
      tabIndex={-1}
      style={{ display: `${modalStatus ? "block" : "none"}` }}
      id="correctModal"
      onClick={() => dispatch(setCorrectModal(false))}
    >
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <p className="modal-title">Solved!</p>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
              onClick={() => dispatch(setCorrectModal(false))}
            ></button>
          </div>
          <div className="modal-body">
            <div className="photo-wrap rounded-circle mx-auto d-flex align-items-center justify-content-center mb-2">
              {
                canvasData && canvasData.correctRespondent && canvasData.correctRespondent.photo ?
                  <img className="w-100 rounded-circle h-100" src={`${API_URL}/guessai_canvas/user_photo/${canvasData.correctRespondent.photo}/`}/> : 
                  <UserIcon className="icon" />
              }
            </div>
            <div className="winner-name text-center"><span>{canvasData && canvasData.correctRespondent ? canvasData.correctRespondent.name : ''}</span> got it right!</div>
            <p className="point text-center">Scored 100 points</p>
            <p className="answer text-center">
              The answer is <span>{joinAnswer}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CorrectModal;
