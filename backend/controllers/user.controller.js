import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const AccessOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
};
const RefreshOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
};

const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

const isPasswordCorrect = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            username: user.username,
            fullname: user.fullname,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
        },
    );
};

const generateRefreshToken = (userId) => {
    return jwt.sign(
        {
            id: userId,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
        },
    );
};

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new ApiError(404, "User not found");

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user.id);

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generating Access & Refresh tokens",
        );
    }
};

const userRegister = asyncHandler(async (req, res) => {
    const { fullname, username, email, password } = req.body;

    if (
        [fullname, username, email, password].some(
            (field) => !field || field.trim() === "",
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    const existingUser = await prisma.user.findFirst({
        where: {
            OR: [
                { username: username.toLowerCase() },
                { email: email.toLowerCase() },
            ],
        },
    });

    if (existingUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
        data: {
            fullname: fullname,
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password: hashedPassword,
        },
        select: {
            id: true,
            fullname: true,
            username: true,
            email: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return res
        .status(201)
        .json(new ApiResponse(201, user, "User Registered Successfully !!"));
});

const userLogIn = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;
    if (!(username || email)) {
        throw new ApiError(404, "Username or email is required");
    }

    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { username: username?.toLowerCase() },
                { email: email?.toLowerCase() },
            ],
        },
    });

    if (!user) {
        throw new ApiError(404, "Username or email does not exist");
    }

    if (!password) throw new ApiError(400, "Password is required");

    const isPasswordValid = await isPasswordCorrect(password, user.password);
    if (!isPasswordValid) throw new ApiError(401, "Password is incorrect !");

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        user.id,
    );

    const loggedInUser = await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
        select: { id: true, fullname: true, username: true, email: true },
    });

    res.status(200)
        .cookie("accessToken", accessToken, AccessOptions)
        .cookie("refreshToken", refreshToken, RefreshOptions)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken: accessToken,
                    refreshToken: refreshToken,
                },
                "User Logged in successfully !!",
            ),
        );
});

const userLogOut = asyncHandler(async (req, res) => {
    await prisma.user.update({
        where: { id: req.user.id },
        data: { refreshToken: null },
    });

    res.status(200)
        .clearCookie("accessToken", AccessOptions)
        .clearCookie("refreshToken", RefreshOptions)
        .json(new ApiResponse(200, {}, "User Logged out Successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingToken =
        req.cookies?.refreshToken ||
        req.header("Authorization")?.replace("Bearer ", "");

    if (!incomingToken) throw new ApiError(401, "No Refresh Token found");

    try {
        const decodedToken = jwt.verify(
            incomingToken,
            process.env.REFRESH_TOKEN_SECRET,
        );

        const user = await prisma.user.findUnique({
            where: { id: decodedToken.id },
        });

        if (!user) throw new ApiError(401, "Unauthorised access");

        if (user.refreshToken !== incomingToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        const { accessToken, refreshToken: newRefreshToken } =
            await generateAccessAndRefreshTokens(user.id);

        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: newRefreshToken },
        });

        const safeUser = {
            id: user.id,
            fullname: user.fullname,
            username: user.username,
            email: user.email,
        };

        res.status(200)
            .cookie("accessToken", accessToken, AccessOptions)
            .cookie("refreshToken", newRefreshToken, RefreshOptions)
            .json(
                new ApiResponse(
                    200,
                    {
                        user: safeUser,
                        accessToken,
                        refreshToken: newRefreshToken,
                    },
                    "Access Token refreshed !",
                ),
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

export { userRegister, userLogIn, userLogOut, refreshAccessToken };
