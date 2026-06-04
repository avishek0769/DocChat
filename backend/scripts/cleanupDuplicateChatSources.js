import prisma from "../utils/prismaClient.js";

async function cleanupDuplicateChatSources() {
    console.log("Finding duplicate ChatSource records...");
    
    const duplicates = await prisma.$queryRaw`
        SELECT "documentation_url", "is_vector_less", COUNT(*) as count
        FROM "ChatSource"
        GROUP BY "documentation_url", "is_vector_less"
        HAVING COUNT(*) > 1;
    `;

    console.log(`Found ${duplicates.length} duplicate groups.`);

    for (const group of duplicates) {
        console.log(`Processing duplicates for: ${group.documentation_url} (isVectorLess: ${group.is_vector_less})`);

        const chatSources = await prisma.chatSource.findMany({
            where: {
                documentationUrl: group.documentation_url,
                isVectorLess: group.is_vector_less,
            },
            orderBy: {
                createdAt: 'asc', // oldest first
            },
        });

        // The first one is our canonical record
        const canonical = chatSources[0];
        const duplicatesToRemove = chatSources.slice(1);

        for (const duplicate of duplicatesToRemove) {
            console.log(`  Re-linking records from duplicate ID ${duplicate.id} to canonical ID ${canonical.id}`);

            // Re-link Chats
            await prisma.chat.updateMany({
                where: {
                    chatSources: {
                        some: { id: duplicate.id }
                    }
                },
                data: {
                    // Note: updateMany cannot do relation connects in Prisma easily.
                    // We need to fetch chats connected to this duplicate, connect to canonical, and disconnect from duplicate.
                }
            });

            const affectedChats = await prisma.chat.findMany({
                where: { chatSources: { some: { id: duplicate.id } } }
            });
            
            for (const chat of affectedChats) {
                await prisma.chat.update({
                    where: { id: chat.id },
                    data: {
                        chatSources: {
                            connect: { id: canonical.id },
                            disconnect: { id: duplicate.id }
                        }
                    }
                });
            }

            // Re-link DocumentPages
            await prisma.documentPage.updateMany({
                where: { chatSourceId: duplicate.id },
                data: { chatSourceId: canonical.id },
            });

            // Re-link DocumentTree (if exists)
            // DocumentTree has @unique on chatSourceId. If canonical already has one, we delete the duplicate's.
            const duplicateTree = await prisma.documentTree.findUnique({ where: { chatSourceId: duplicate.id }});
            if (duplicateTree) {
                const canonicalTree = await prisma.documentTree.findUnique({ where: { chatSourceId: canonical.id }});
                if (canonicalTree) {
                    await prisma.documentTree.delete({ where: { id: duplicateTree.id }});
                } else {
                    await prisma.documentTree.update({
                        where: { id: duplicateTree.id },
                        data: { chatSourceId: canonical.id },
                    });
                }
            }

            // Re-link IngestionRun
            await prisma.ingestionRun.updateMany({
                where: { chatSourceId: duplicate.id },
                data: { chatSourceId: canonical.id },
            });

            console.log(`  Deleting duplicate ChatSource ${duplicate.id}`);
            await prisma.chatSource.delete({
                where: { id: duplicate.id },
            });
        }
    }

    console.log("Cleanup complete!");
}

cleanupDuplicateChatSources()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
