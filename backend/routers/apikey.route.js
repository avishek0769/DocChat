import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { addApiKeySchema, apiKeyIdParamSchema } from "../utils/validationSchemas.js";
import {
    addApiKey,
    listApiKeys,
    removeApiKey,
    getApiKey,
    totalNumberOfApiKeys,
    updateApiKey,
} from "../controllers/apikey.controller.js";

const apikeyRouter = Router();

apikeyRouter.route("/add").post(verifyStrictJWT, validate(addApiKeySchema), addApiKey);
apikeyRouter.route("/list").get(verifyStrictJWT, listApiKeys);
apikeyRouter.route("/count").get(verifyStrictJWT, totalNumberOfApiKeys);
apikeyRouter.route("/:id").delete(verifyStrictJWT, validate(apiKeyIdParamSchema), removeApiKey);
apikeyRouter.route("/:id").get(verifyStrictJWT, validate(apiKeyIdParamSchema), getApiKey);
apikeyRouter.route("/:id").patch(verifyStrictJWT, updateApiKey);
export default apikeyRouter;
