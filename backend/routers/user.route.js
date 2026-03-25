import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import {
    userLogIn,
    userLogOut,
    userRegister,
    refreshAccessToken,
} from "../controllers/user.controller.js";

const userRouter = Router();

userRouter.route("/register").post(userRegister);
userRouter.route("/login").post(userLogIn);
userRouter.route("/logout").get(verifyStrictJWT, userLogOut);
userRouter.route("/refresh-accessToken").patch(refreshAccessToken);

export default userRouter;
