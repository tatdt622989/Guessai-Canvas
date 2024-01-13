import {
  createSlice,
  createAsyncThunk,
  ActionReducerMapBuilder,
} from "@reduxjs/toolkit";
import API_URL from "@/config";
import { setSignUpModal } from "@/components/Modal/ModalSlice.ts";
import type { RootState } from "@/store/store.ts";
import type { SimpleUser } from "@/types";

const fetchUser = createAsyncThunk(
  `${API_URL}/guessai_canvas/simple_user/`,
  async (_, thunkAPI) => {
    const response = await fetch(`${API_URL}/guessai_canvas/simple_user/`, {
      method: "GET",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("failed to fetch user");
    }
    thunkAPI.dispatch(setSignUpModal(false));
    return (await response.json()) as SimpleUser;
  }
);

export { fetchUser };

const userSlice = createSlice({
  name: "user",
  initialState: {
    name: "",
    photoURL: "",
    score: 0,
    isLoggedIn: false,
    isLoading: false,
    error: "",
  },
  reducers: {
    setName(state, action) {
      state.name = action.payload;
    },
    setPhotoURL(state, action) {
      state.photoURL = action.payload;
    },
    setScore(state, action) {
      state.score = action.payload;
    },
  },
  extraReducers: (
    builder: ActionReducerMapBuilder<{
      name: string;
      photoURL: string;
      score: number;
      isLoggedIn: boolean;
      isLoading: boolean;
      error: string;
    }>
  ) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isLoggedIn = true;
        state.name = action.payload.name;
        state.photoURL = `${API_URL}/guessai_canvas/user_photo/${action.payload.photo}/`;
        state.score = action.payload.score;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "error";
      });
  },
});

export const { setName, setPhotoURL, setScore } = userSlice.actions;

export default userSlice.reducer;
