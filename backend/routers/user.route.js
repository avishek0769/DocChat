import { Router } from "express";
import { verifyJWT, verifyStrictJWT } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
    sendVerificationCodeSchema,
    verifyEmailSchema,
    userRegisterSchema,
    userLogInSchema,
    sendResetCodeSchema,
    resetPasswordSchema,
} from "../utils/validationSchemas.js";
import {
    userLogIn,
    userLogOut,
    userRegister,
    refreshTokens,
    sendVerificationCode,
    verifyEmail,
    currentUserProfile,
    resetPassword,
    sendResetCode,
    deleteMyData,
} from "../controllers/user.controller.js";

const userRouter = Router();

userRouter.route("/send-verification-code").post(validate(sendVerificationCodeSchema), sendVerificationCode);
userRouter.route("/verify-email").post(validate(verifyEmailSchema), verifyEmail);
userRouter.route("/register").post(validate(userRegisterSchema), userRegister);
userRouter.route("/login").post(validate(userLogInSchema), userLogIn);
userRouter.route("/logout").get(verifyStrictJWT, userLogOut);
userRouter.route("/refresh-tokens").patch(verifyJWT, refreshTokens);
userRouter.route("/profile").get(verifyStrictJWT, currentUserProfile);
userRouter.route("/send-reset-code").post(validate(sendResetCodeSchema), sendResetCode);
userRouter.route("/reset-password").patch(validate(resetPasswordSchema), resetPassword);
userRouter.route("/delete-my-data").delete(verifyStrictJWT, deleteMyData);

export default userRouter;
