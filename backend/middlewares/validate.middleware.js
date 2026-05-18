import { ApiError } from "../utils/ApiError.js";

const validate = (schemas) => {
    return (req, res, next) => {
        for (const [field, schema] of Object.entries(schemas)) {
            if (!schema) continue;

            const result = schema.safeParse(req[field]);

            if (!result.success) {
                const fieldErrors = result.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                }));

                const messages = fieldErrors.map((e) => `${e.field}: ${e.message}`);
                throw new ApiError(400, `Validation failed: ${messages.join("; ")}`, fieldErrors);
            }

            req[field] = result.data;
        }

        next();
    };
};

export default validate;
