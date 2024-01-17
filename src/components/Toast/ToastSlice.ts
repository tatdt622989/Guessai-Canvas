import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface Toast {
    id: number;
    description: string;
    type: "success" | "error" | "warning" | "info";
}

const initialState = {
  toastList: [] as Toast[],
};

const ToastsSlice = createSlice({
  name: "Toast",
  initialState,
  reducers: {
    addToast: (state, action: PayloadAction<Toast>) => {
        state.toastList.push(action.payload);
    },
    removeToast: (state, action: PayloadAction<number>) => {
        state.toastList = state.toastList.filter((toast) => toast.id !== action.payload);
    },
  },
});

export const { addToast, removeToast } = ToastsSlice.actions;

export default ToastsSlice.reducer;
