import type { PrismaClient } from '@prisma/client';
import '~~/server/types';

export const usePrisma = (): PrismaClient => {
  return useNitroApp().$prisma;
};
