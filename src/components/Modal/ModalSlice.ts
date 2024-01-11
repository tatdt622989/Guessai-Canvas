import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

const initialState = {
  signUpModal: true,
  correctModal: false,
};

const ModalSlice = createSlice({
  name: "Modal",
  initialState,
  reducers: {
    setSignUpModal: (state, action: PayloadAction<boolean>) => {
      state.signUpModal = action.payload;
    },
    setCorrectModal: (state, action: PayloadAction<boolean>) => {
      state.correctModal = action.payload;
    },
  },
});

export const { setSignUpModal, setCorrectModal } = ModalSlice.actions;

export default ModalSlice.reducer;
