import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

const initialState = {
    SignUpModal: true,
}

const ModalSlice = createSlice({
    name: 'Modal',
    initialState,
    reducers: {
        setSignUpModal: (state, action: PayloadAction<boolean>) => {
            state.SignUpModal = action.payload
        },
    },
})

export const { setSignUpModal } = ModalSlice.actions

export default ModalSlice.reducer
