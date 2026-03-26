import { Router } from "express";
import { verifyJWT, verifyStrictJWT } from "../middlewares/auth.middleware.js";
import {
    userLogIn,
    userLogOut,
    userRegister,
    refreshTokens,
    sendVerificationCode,
    verifyEmail,
    currentUserProfile
} from "../controllers/user.controller.js";

const userRouter = Router();

userRouter.route("/send-code").post(sendVerificationCode);
userRouter.route("/verify-email").post(verifyEmail);
userRouter.route("/register").post(userRegister);
userRouter.route("/login").post(userLogIn);
userRouter.route("/logout").get(verifyStrictJWT, userLogOut);
userRouter.route("/refresh-tokens").patch(verifyJWT, refreshTokens);
userRouter.route("/profile").get(verifyStrictJWT, currentUserProfile);

export default userRouter;
