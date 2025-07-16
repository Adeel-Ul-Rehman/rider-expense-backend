import express from 'express';
import {
  isAuthenticated,
  login,
  logout,
  register,
  resetPassword,
  sendResetOtp,
  sendVerifyOtp,
  verifyResetOtp,
  verifyEmail,
  updateProfile,
  deleteAccount,
  uploadProfilePicture,
  removeProfilePicture
} from '../controllers/authController.js';
import userAuth from '../middleware/userAuth.js';

const authRouter = express.Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
authRouter.post('/send-verify-otp', userAuth, sendVerifyOtp);
authRouter.post('/verify-account', userAuth, verifyEmail);
authRouter.post('/is-auth', userAuth, isAuthenticated);
authRouter.post('/send-reset-otp', sendResetOtp);
authRouter.post('/verify-reset-otp', verifyResetOtp);
authRouter.post('/reset-password', resetPassword);
authRouter.put('/update-profile', userAuth, updateProfile);
authRouter.delete('/delete-account', userAuth, deleteAccount);
authRouter.post('/upload-profile-picture', userAuth, uploadProfilePicture);
authRouter.delete('/remove-profile-picture', userAuth, removeProfilePicture);

export default authRouter;