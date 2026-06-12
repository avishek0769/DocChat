import { beforeEach, afterAll } from 'vitest';
import prisma from '../utils/prismaClient.js';

beforeEach(async () => {
    // Truncate all tables before each test to guarantee a clean state
    const tables = await prisma.$queryRaw`
        SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations';
    `;
    
    for (const { tablename } of tables) {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
    }
});

afterAll(async () => {
    await prisma.$disconnect();
});
