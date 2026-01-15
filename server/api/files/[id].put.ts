import { Prisma } from '@prisma/client';
import { usePrisma } from '~~/server/composables/prisma';
import type { UpdateFileRequestBody } from '~~/server/types';
import '~~/server/types';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: 'Not authenticated' });
  }

  const id = Number(getRouterParam(event, 'id'));
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid file ID' });
  }

  const body = await readBody<UpdateFileRequestBody>(event);
  const { name, content } = body;

  const prisma = usePrisma();

  const file = await prisma.file.findFirst({
    where: {
      id: id,
      userId: user.userId,
    },
  });

  if (!file) {
    throw createError({ statusCode: 404, message: 'File not found' });
  }

  const updateData: { name?: string; content?: string } = {};

  if (name !== undefined) {
    let trimmedName = String(name).trim();
    if (trimmedName.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'File name cannot be empty',
      });
    }
    if (!trimmedName.endsWith('.md')) {
      trimmedName += '.md';
    }
    updateData.name = trimmedName;
  }

  if (content !== undefined) {
    updateData.content = String(content);
  }

  if (Object.keys(updateData).length === 0) {
    throw createError({ statusCode: 400, message: 'No fields to update' });
  }

  try {
    const updated = await prisma.file.update({
      where: {
        id: id,
      },
      data: updateData,
    });

    return {
      id: updated.id,
      user_id: updated.userId,
      folder_id: updated.folderId,
      name: updated.name,
      content: updated.content,
      created_at: updated.createdAt,
      updated_at: updated.updatedAt,
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
