import { getDb } from '../../utils/db';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: 'Not authenticated' });
  }

  const body = await readBody(event);
  const { name, parent_id } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError({ statusCode: 400, message: 'Folder name is required' });
  }

  const trimmedName = name.trim();
  const parentId = parent_id ? Number(parent_id) : null;

  const db = getDb();

  if (parentId !== null) {
    const parentFolder = db
      .prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?')
      .get(parentId, user.userId);
    if (!parentFolder) {
      throw createError({
        statusCode: 404,
        message: 'Parent folder not found',
      });
    }
  }

  try {
    const result = db
      .prepare(
        `
      INSERT INTO folders (user_id, parent_id, name)
      VALUES (?, ?, ?)
    `
      )
      .run(user.userId, parentId, trimmedName);

    return {
      id: result.lastInsertRowid,
      user_id: user.userId,
      parent_id: parentId,
      name: trimmedName,
    };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes('UNIQUE constraint failed')
    ) {
      throw createError({
        statusCode: 409,
        message: 'A folder with this name already exists in this location',
      });
    }
    throw error;
  }
});
