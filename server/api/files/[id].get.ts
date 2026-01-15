import { usePrisma } from '~~/server/composables/prisma';
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

  return {
    id: file.id,
    user_id: file.userId,
    folder_id: file.folderId,
    name: file.name,
    content: file.content,
    created_at: file.createdAt,
    updated_at: file.updatedAt,
  };
});
