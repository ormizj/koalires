import type { User } from '@prisma/client';
import { usePrisma } from '~~/server/composables/prisma';

export const getUserByEmail = async (
  email: string
): Promise<User | null | undefined> => {
  const db = usePrisma();
  try {
    return await db.user.findFirst({
      where: { email },
    });
  } catch (error) {
    console.error(error);
  }
};

export const isUserExistsByEmail = async (
  email: string
): Promise<boolean | undefined> => {
  const db = usePrisma();
  try {
    const user = await db.user.findFirst({
      where: { email },
    });

    return user !== null;
  } catch (error) {
    console.error(error);
  }
};

export const addUser = async (
  email: string,
  passwordHash: string
): Promise<User | undefined> => {
  const db = usePrisma();
  try {
    return await db.user.create({
      data: {
        email,
        passwordHash,
      },
    });
  } catch (error) {
    console.error(error);
  }
};
