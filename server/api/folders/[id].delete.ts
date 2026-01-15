import { usePrisma } from '~~/server/composables/prisma';
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

  const prisma = usePrisma();

  const folder = await prisma.folder.findFirst({
    where: {
      id: id,
      userId: user.userId,
    },
    select: { id: true },
  });
  if (!folder) {
    throw createError({ statusCode: 404, message: 'Folder not found' });
  }

  await prisma.folder.delete({
    where: {
      id: id,
    },
  });

  return { success: true };
});
