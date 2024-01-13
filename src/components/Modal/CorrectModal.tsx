import type { RootState } from "@/store/store";
import { useAppSelector, useAppDispatch } from "@/store/store";
import "./CorrectModal.scss";

function CorrectModal() {
  const modalStatus = useAppSelector(
    (state: RootState) => state.modal.correctModal
  );

  return (
    <div 
      className={`modal ${modalStatus ? "fade show" : ""}`}
      tabIndex={-1}
      style={{ display: `${modalStatus ? "block" : "none"}` }}
    >
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body">
            <p>Correct!</p>
            <p className="point">Scored 100 points!</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CorrectModal;
