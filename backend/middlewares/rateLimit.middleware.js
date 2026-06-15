import rateLimit from "express-rate-limit";

const createLimiter = (windowMs, max) =>
    rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            message: "Too many requests, please try again later.",
        },
    });

export const loginLimiter = createLimiter(
    15 * 60 * 1000,
    10,
);

export const registerLimiter = createLimiter(
    15 * 60 * 1000,
    5,
);

export const verificationCodeLimiter = createLimiter(
    10 * 60 * 1000,
    3,
);

export const resetPasswordLimiter = createLimiter(
    15 * 60 * 1000,
    5,
);
