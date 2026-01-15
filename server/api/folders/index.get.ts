import { usePrisma } from '~~/server/composables/prisma';
import '~~/server/types';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: 'Not authenticated' });
  }

  const query = getQuery(event);
  const parentId = query.parent_id ? Number(query.parent_id) : null;

  const prisma = usePrisma();

  const folders = await prisma.folder.findMany({
    where: {
      userId: user.userId,
      parentId: parentId,
    },
    orderBy: {
      name: 'asc',
    },
    select: {
      id: true,
      userId: true,
      parentId: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return folders.map((folder) => ({
    id: folder.id,
    user_id: folder.userId,
    parent_id: folder.parentId,
    name: folder.name,
    created_at: folder.createdAt,
    updated_at: folder.updatedAt,
  }));
});
