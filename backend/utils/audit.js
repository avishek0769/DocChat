import prisma from "./prismaClient.js";

export const createAuditEvent = async (type, userId = null, chatId = null, metadata = null) => {
    return prisma.auditEvent.create({
        data: {
            type,
            userId,
            chatId,
            metadata,
        },
    });
};
