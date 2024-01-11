import { configureStore } from '@reduxjs/toolkit'
import modalReducer from '@/components/Modal/ModalSlice'
import userReducer from '@/store/UserSlice.ts'

export const store = configureStore({
  reducer: {
    modal: modalReducer,
    user: userReducer,
  },
})

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch