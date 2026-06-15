import { Router } from "express";
import { verifyAdmin, verifyStrictJWT } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
    paginationSchema,
    rangeSchema,
    userIdParamSchema,
} from "../utils/validationSchemas.js";
import {
    overview,
    users,
    userDetails,
    usage,
    ingestion,
    getSettings,
    updateSettings,
    testWebhook,
} from "../controllers/admin.controller.js";

const adminRouter = Router();

adminRouter.use(verifyStrictJWT, verifyAdmin);

adminRouter.route("/overview").get(overview);
adminRouter.route("/users").get(validate(paginationSchema), users);
adminRouter.route("/users/:userId").get(validate(userIdParamSchema), userDetails);
adminRouter.route("/usage").get(validate(rangeSchema), validate(paginationSchema), usage);
adminRouter.route("/ingestion").get(validate(rangeSchema), validate(paginationSchema), ingestion);
adminRouter.route("/settings").get(getSettings).put(updateSettings);
adminRouter.route("/settings/test-webhook").post(testWebhook);

export default adminRouter;
