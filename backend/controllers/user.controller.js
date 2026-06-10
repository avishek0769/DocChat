import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import redis from "../utils/redis.js";
import { Resend } from "resend";
import { createAuditEvent } from "../utils/audit.js";


const resend = new Resend(process.env.RESEND_API_KEY);

const AccessOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
    path: "/",
};
const RefreshOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 24 * 60 * 60 * 1000, // 10 days
    path: "/",
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

const generateVerificationCode = () => Math.floor(Math.random() * 90000) + 10000;

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new ApiError(404, "User not found");

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user.id);

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating Access & Refresh tokens");
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

    const code = generateVerificationCode();
    await redis.set(email, code, "EX", 3 * 60);

    await resend.emails.send({
        from: "DocChat <onboarding@avishekadhikary.tech>",
        to: email,
        subject: "DocChat - Email Verification Code",
        html: `<p>Your verification code is: <strong>${code}</strong></p>`,
    });

    res.status(200).json(
        new ApiResponse(200, { emailSent: true }, "Verification code sent to email successfully !!"),
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
    res.status(200).json(new ApiResponse(200, { ...user }, "Email verified successfully !!"));
});

const userRegister = asyncHandler(async (req, res) => {
    const { fullname, username, email, password } = req.body;

    const existingUser = await prisma.user.findFirst({
        where: { email },
    });

    if (!existingUser) {
        throw new ApiError(400, "Email not verified. Request a verification code first.");
    }
    
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

    return res.status(201).json(new ApiResponse(201, user, "User Registered Successfully !!"));
});

const userLogIn = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    const user = await prisma.user.findFirst({
        where: {
            OR: [{ email: email }, { username: username }],
        },
    });

    if (!user) {
        throw new ApiError(404, "Username or email does not exist");
    }

    const isPasswordValid = await isPasswordCorrect(password, user.password);
    if (!isPasswordValid) throw new ApiError(401, "Password is incorrect !");

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.id);

    const loggedInUser = await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
        select: { id: true, fullname: true, username: true, email: true, isAdmin: true },
    });

    try {
        await createAuditEvent("user.login", user.id, null, {
            username: user.username,
            email: user.email,
        });
    } catch (error) {
        console.error("Failed to write user.login audit event:", error.message);
    }

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
        const decodedToken = jwt.verify(incomingToken, process.env.REFRESH_TOKEN_SECRET);

        const user = await prisma.user.findUnique({
            where: { id: decodedToken.id },
        });

        if (!user) throw new ApiError(401, "Unauthorised access");

        if (user.refreshToken !== incomingToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(
            user.id,
        );

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
    const user = {
        id:req.user.id,
        fullname:req.user.fullname,
        username:req.user.username,
        email:req.user.email,
    }
    res.status(200).json(new ApiResponse(200, user, "Current user profile fetched successfully !"));
});

const sendResetCode = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        throw new ApiError(404, "User with this email does not exist");
    }

    const code = generateVerificationCode();
    await redis.set(email, code, "EX", 3 * 60);

    await resend.emails.send({
        from: "DocChat <onboarding@avishekadhikary.tech>",
        to: email,
        subject: "DocChat - Password Reset Code",
        html: `<p>Your password reset code is: <strong>${code}</strong></p>`,
    });

    res.status(200).json(new ApiResponse(200, { emailSent: true }, "Reset code sent successfully !!"));
});

const resetPassword = asyncHandler(async (req, res) => {
    const { email, code, password } = req.body;

    const storedCode = await redis.get(email);
    if (Number(code) !== Number(storedCode)) {
        throw new ApiError(400, "Invalid verification code");
    }

    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        throw new ApiError(404, "User with this email does not exist");
    }

    const hashedPassword = await hashPassword(password);
    await prisma.user.update({
        where: { email },
        data: { password: hashedPassword },
    });

    await redis.del(email);

    res.status(200).json(new ApiResponse(200, { reset: true }, "Password reset successfully !!"));
});

const deleteMyData = asyncHandler(async (req, res) => {
  const userId = req.user.id; // set by your auth middleware
  const { confirm } = req.query;

  // Acceptance criteria: require explicit confirmation flag
  if (confirm !== "true") {
    return res.status(400).json({
      success: false,
      message: 'Pass confirm=true as a query param to confirm deletion.',
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Delete ChatMessageSources (deepest dependency first)
      await tx.chatMessageSource.deleteMany({
        where: { chatMessage: { chat: { userId } } },
      });

      // 2. Delete ChatMessages
      await tx.chatMessage.deleteMany({
        where: { chat: { userId } },
      });

      // 3. Delete UsageEvents (onDelete: SetNull means we must handle these)
      await tx.usageEvent.deleteMany({ where: { userId } });

      // 4. Delete ApiKeys
      await tx.apiKey.deleteMany({ where: { userId } });

      // 5. Delete ChatSources that belong ONLY to this user's chats
      //    Safe detach: only remove if no other user's chat references them
      const userChatIds = (
        await tx.chat.findMany({
          where: { userId },
          select: { id: true },
        })
      ).map((c) => c.id);

      // Find ChatSource IDs used by this user's chats
      const userChatSources = await tx.chatSource.findMany({
        where: { chatId: { in: userChatIds } },
        select: { id: true, docsUrl: true },
      });

      // Only delete ChatSources not referenced by any other chat
      for (const cs of userChatSources) {
        const otherChatCount = await tx.chat.count({
          where: {
            chatSources: { some: { docsUrl: cs.docsUrl } },
            userId: { not: userId },
          },
        });
        if (otherChatCount === 0) {
          await tx.chatSource.delete({ where: { id: cs.id } });
        }
      }

      // 6. Delete Chats
      await tx.chat.deleteMany({ where: { userId } });
    });

    return res.status(200).json({
      success: true,
      message: 'All your data has been deleted.',
    });
  } catch (error) {
    // Idempotent: if already deleted, return success
    if (error.code === 'P2025') {
      return res.status(200).json({
        success: true,
        message: 'Data already deleted or not found.',
      });
    }
    console.error('deleteMyData error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export {
    userRegister,
    userLogIn,
    userLogOut,
    refreshTokens,
    sendVerificationCode,
    verifyEmail,
    currentUserProfile,
    resetPassword,
    sendResetCode,
    deleteMyData,
};
