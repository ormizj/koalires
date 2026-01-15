import { Prisma } from '@prisma/client';
import { usePrisma } from '~~/server/composables/prisma';
import type { CreateFileRequestBody } from '~~/server/types';
import '~~/server/types';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: 'Not authenticated' });
  }

  const body = await readBody<CreateFileRequestBody>(event);
  const { name, folder_id } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError({ statusCode: 400, message: 'File name is required' });
  }

  let trimmedName = name.trim();
  if (!trimmedName.endsWith('.md')) {
    trimmedName += '.md';
  }

  const folderId = folder_id ? Number(folder_id) : null;

  const prisma = usePrisma();

  if (folderId !== null) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId: user.userId,
      },
    });
    if (!folder) {
      throw createError({ statusCode: 404, message: 'Folder not found' });
    }
  }

  try {
    const file = await prisma.file.create({
      data: {
        userId: user.userId,
        folderId: folderId,
        name: trimmedName,
        content: '',
      },
    });

    return {
      id: file.id,
      user_id: file.userId,
      folder_id: file.folderId,
      name: file.name,
      content: file.content,
    };
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw createError({
        statusCode: 409,
        message: 'A file with this name already exists in this location',
      });
    }
    throw error;
  }
});
