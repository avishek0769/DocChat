import { beforeEach, afterAll } from 'vitest';
import prisma from '../utils/prismaClient.js';

beforeEach(async () => {
    try {
        // Truncate all tables before each test to guarantee a clean state
        const tables = await prisma.$queryRaw`
            SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations';
        `;
        
        for (const { tablename } of tables) {
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
        }
    } catch (err) {
        // Silent or warn so that purely unit/algorithmic tests still run offline
        console.warn("Test setup: Postgres DB is offline, skipping truncation:", err.message);
    }
});

afterAll(async () => {
    await prisma.$disconnect();
});
