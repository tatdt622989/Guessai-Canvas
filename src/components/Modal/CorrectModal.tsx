import "./CorrectModal.scss";

function CorrectModal() {
  return (
    <div className="modal" tabIndex={-1}>
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
