import type { RootState } from "@/store/store";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { removeToast } from "@/components/Toast/ToastSlice.ts";
import "./Toast.scss";

function ToastList() {
  const dispatch = useAppDispatch();
  const toastListStatus = useAppSelector(
    (state: RootState) => state.toast.toastList
  );

  const typeMap = {
    success: "success",
    error: "danger",
    info: "info",
    warning: "warning",
  };

  return (
    <>
      {toastListStatus.map((toast) => (
        <div
          key={toast.id}
          className={`toast align-items-center text-white bg-${typeMap[toast.type]} border-0 show`}
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div className="d-flex">
            <div className="toast-body">{toast.description}</div>
            <button
              type="button"
              className="btn-close me-2 m-auto"
              data-bs-dismiss="toast"
              aria-label="Close"
              onClick={() => dispatch(removeToast(toast.id))}
            ></button>
          </div>
        </div>
      ))}
    </>
  );
}

function Toast() {
  return <div className="toast-container top-0 end-0 p-3">
    <ToastList />
  </div>;
}

export default Toast;
