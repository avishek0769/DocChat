import jwt from "jsonwebtoken";
import prisma from "../utils/prismaClient.js";
import { ApiError } from "../utils/ApiError.js";

const verifyStrictJWT = async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            throw new ApiError(401, "Unauthorised request");
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decodedToken.id },
            select: {
                id: true,
                fullname: true,
                username: true,
                email: true,
                isAdmin: true,
                apikeys: true,
                refreshToken: true,
            },
        });

        if (!user) throw new ApiError(401, "Invalid Access Token");

        req.user = user;
        next();
    } catch (error) {
        if (error instanceof ApiError) next(error);
        else next(new ApiError(401, "Your Access Token expired !"));
    }
};

const verifyJWT = async (req, res, next) => {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

    if (token) {
        try {
            const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            const user = await prisma.user.findUnique({
                where: { id: decodedToken.id },
                select: {
                    id: true,
                    fullname: true,
                    username: true,
                    email: true,
                },
            });
            if (user) req.user = user;
        } catch (error) {
            // Ignore token errors for non-strict verify
        }
    }
    next();
};

const verifyAdmin = async (req, res, next) => {
    try {
        if (req.user?.isAdmin !== true) {
            throw new ApiError(403, "Admin privileges required");
        }

        next();
    } catch (error) {
        next(error instanceof ApiError ? error : new ApiError(403, "Admin privileges required"));
    }
};

export { verifyStrictJWT, verifyJWT, verifyAdmin };
