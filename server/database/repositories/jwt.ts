import { usePrisma } from '~~/server/composables/prisma';

export const addJwtToken = async (
  email: string,
  token: string
): Promise<void> => {
  const db = usePrisma();
  try {
    await db.$transaction([
      db.jwt.deleteMany({
        where: { email },
      }),
      db.jwt.create({
        data: {
          token,
          email,
        },
      }),
    ]);
  } catch (error) {
    console.error(error);
  }
};

export const isJwtTokenExistByToken = async (
  token: string,
  email: string
): Promise<boolean> => {
  const db = usePrisma();
  try {
    const tokenExists = await db.jwt.findFirst({
      where: {
        email,
        token,
      },
    });

    return tokenExists !== null;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export const deleteJwtToken = async (token: string): Promise<boolean> => {
  const db = usePrisma();
  try {
    const result = await db.jwt.deleteMany({
      where: { token },
    });
    return result.count > 0;
  } catch (error) {
    console.error(error);
    return false;
  }
};
