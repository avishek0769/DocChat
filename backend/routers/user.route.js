import { Router } from "express";
import { verifyJWT, verifyStrictJWT } from "../middlewares/auth.middleware.js";
import {
    userLogIn,
    userLogOut,
    userRegister,
    refreshTokens,
    sendVerificationCode,
    verifyEmail,
    currentUserProfile,
    resetPassword,
    sendResetCode
} from "../controllers/user.controller.js";

const userRouter = Router();

userRouter.route("/send-verification-code").post(sendVerificationCode);
userRouter.route("/verify-email").post(verifyEmail);
userRouter.route("/register").post(userRegister);
userRouter.route("/login").post(userLogIn);
userRouter.route("/logout").get(verifyStrictJWT, userLogOut);
userRouter.route("/refresh-tokens").patch(verifyJWT, refreshTokens);
userRouter.route("/profile").get(verifyStrictJWT, currentUserProfile);
userRouter.route("/send-reset-code").post(sendResetCode);
userRouter.route("/reset-password").patch(resetPassword);


export default userRouter;
