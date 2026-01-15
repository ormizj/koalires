import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import '~~/server/types';

export default defineNitroPlugin((nitroApp) => {
  try {
    const databaseUrl = process.env.DATABASE_URL || 'file:./data/koalires.db';
    console.log('Database URL:', databaseUrl);

    const adapter = new PrismaLibSql({ url: databaseUrl });
    console.log('Adapter created');

    const prisma = new PrismaClient({ adapter });
    console.log('PrismaClient created');

    nitroApp.$prisma = prisma;
    console.log('Prisma client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Prisma:', error);
    throw error;
  }
});
