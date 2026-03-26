import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import redis from "../utils/redis.js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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

const sendVerificationCode = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await prisma.user.findFirst({
        where: { email: email },
    });

    if (user) {
        throw new ApiError(401, "User with this email already exists");
    }

    await prisma.user.create({
        data: { email },
    });

    const code = Math.floor(Math.random() * 99999 + 10000);
    await redis.set(email, code, "EX", 3 * 60);

    await resend.emails.send({
        from: "DocChat <onboarding@avishekadhikary.tech>",
        to: email,
        subject: "DocChat - Email Verification Code",
        html: `<p>Your verification code is: <strong>${code}</strong></p>`,
    });

    res.status(200).json(
        new ApiResponse(
            200,
            { emailSent: true },
            "Verification code sent to email successfully !!",
        ),
    );
});

const verifyEmail = asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    const storedCode = await redis.get(email);

    if (Number(code) != storedCode) {
        throw new ApiError(400, "Invalid verification code");
    }

    const user = await prisma.user.update({
        where: { email },
        data: {
            isVerified: true,
        },
    });

    await redis.del(email);
    res.status(200).json(
        new ApiResponse(200, { ...user }, "Email verified successfully !!"),
    );
});

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
        where: { email },
    });

    if (!existingUser.isVerified) {
        throw new ApiError(400, "User not verified");
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.update({
        where: { email },
        data: {
            fullname: fullname,
            username: username,
            email: email,
            password: hashedPassword,
        },
        select: {
            id: true,
            fullname: true,
            username: true,
            email: true,
            createdAt: true,
        },
    });

    return res
        .status(201)
        .json(new ApiResponse(201, user, "User Registered Successfully !!"));
});

const userLogIn = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;
    if (!username && !email) {
        throw new ApiError(404, "Username or email is required");
    }

    const user = await prisma.user.findFirst({
        where: {
            OR: [{ email: email }, { username: username }],
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
                    ...loggedInUser,
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

const refreshTokens = asyncHandler(async (req, res) => {
    const incomingToken = req.user?.refreshToken || "";
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
                        ...safeUser,
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

const currentUserProfile = asyncHandler(async (req, res) => {
    const user = req.user;
    res.status(200).json(
        new ApiResponse(
            200,
            user,
            "Current user profile fetched successfully !",
        ),
    );
});

export {
    userRegister,
    userLogIn,
    userLogOut,
    refreshTokens,
    sendVerificationCode,
    verifyEmail,
    currentUserProfile,
};
