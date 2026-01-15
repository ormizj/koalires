import { usePrisma } from '~~/server/composables/prisma';
import '~~/server/types';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: 'Not authenticated' });
  }

  const query = getQuery(event);
  const folderId = query.folder_id ? Number(query.folder_id) : null;

  const prisma = usePrisma();

  const files = await prisma.file.findMany({
    where: {
      userId: user.userId,
      folderId: folderId,
    },
    orderBy: {
      name: 'asc',
    },
    select: {
      id: true,
      userId: true,
      folderId: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return files.map((file) => ({
    id: file.id,
    user_id: file.userId,
    folder_id: file.folderId,
    name: file.name,
    created_at: file.createdAt,
    updated_at: file.updatedAt,
  }));
});
