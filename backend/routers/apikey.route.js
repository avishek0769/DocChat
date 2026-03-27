import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import { addApiKey, listApiKeys, removeApiKey, getApiKey } from "../controllers/apikey.controller.js";

const apikeyRouter = Router();

apikeyRouter.route("/add").post(verifyStrictJWT, addApiKey);
apikeyRouter.route("/list").get(verifyStrictJWT, listApiKeys);
apikeyRouter.route("/remove").delete(verifyStrictJWT, removeApiKey);
apikeyRouter.route("/:id").get(verifyStrictJWT, getApiKey);

export default apikeyRouter;
