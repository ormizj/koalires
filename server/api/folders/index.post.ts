import { Prisma } from '@prisma/client';
import { usePrisma } from '~~/server/composables/prisma';
import type { CreateFolderRequestBody } from '~~/server/types';
import '~~/server/types';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: 'Not authenticated' });
  }

  const body = await readBody<CreateFolderRequestBody>(event);
  const { name, parent_id } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError({ statusCode: 400, message: 'Folder name is required' });
  }

  const trimmedName = name.trim();
  const parentId = parent_id ? Number(parent_id) : null;

  const prisma = usePrisma();

  if (parentId !== null) {
    const parentFolder = await prisma.folder.findFirst({
      where: {
        id: parentId,
        userId: user.userId,
      },
      select: { id: true },
    });
    if (!parentFolder) {
      throw createError({
        statusCode: 404,
        message: 'Parent folder not found',
      });
    }
  }

  try {
    const folder = await prisma.folder.create({
      data: {
        userId: user.userId,
        parentId: parentId,
        name: trimmedName,
      },
    });

    return {
      id: folder.id,
      user_id: folder.userId,
      parent_id: folder.parentId,
      name: folder.name,
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
