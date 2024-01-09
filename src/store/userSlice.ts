import { createSlice, createAsyncThunk, ActionReducerMapBuilder } from "@reduxjs/toolkit";
import API_URL from "@/config";

const fetchUser = createAsyncThunk(`${API_URL}/guessai_canvas/simple_user/`, async () => {
	const response = await fetch(`${API_URL}/guessai_canvas/simple_user/`);
	return response.json();
});

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
	extraReducers: (builder: ActionReducerMapBuilder<{ name: string; photoURL: string; score: number; isLoggedIn: boolean; isLoading: boolean; error: string; }>) => {
		builder
			.addCase(fetchUser.pending, (state) => {
				console.log("fetchUser1");
				state.isLoading = true;
			})
			.addCase(fetchUser.fulfilled, (state, action) => {
				console.log("fetchUser2");
				state.isLoading = false;
				state.isLoggedIn = true;
				state.name = action.payload.name;
				state.photoURL = action.payload.photoURL;
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
