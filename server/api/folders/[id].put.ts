import { Prisma } from '@prisma/client';
import { usePrisma } from '~~/server/composables/prisma';
import type { UpdateFolderRequestBody } from '~~/server/types';
import '~~/server/types';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: 'Not authenticated' });
  }

  const id = Number(getRouterParam(event, 'id'));
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid folder ID' });
  }

  const body = await readBody<UpdateFolderRequestBody>(event);
  const { name } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError({ statusCode: 400, message: 'Folder name is required' });
  }

  const trimmedName = name.trim();
  const prisma = usePrisma();

  const folder = await prisma.folder.findFirst({
    where: {
      id: id,
      userId: user.userId,
    },
    select: { id: true, parentId: true },
  });
  if (!folder) {
    throw createError({ statusCode: 404, message: 'Folder not found' });
  }

  try {
    await prisma.folder.update({
      where: {
        id: id,
      },
      data: {
        name: trimmedName,
      },
    });

    return {
      id,
      name: trimmedName,
    };
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw createError({
        statusCode: 409,
        message: 'A folder with this name already exists in this location',
      });
    }
    throw error;
  }
});
