import { getDb } from '../../utils/db';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: 'Not authenticated' });
  }

  const body = await readBody(event);
  const { name, folder_id } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError({ statusCode: 400, message: 'File name is required' });
  }

  let trimmedName = name.trim();
  if (!trimmedName.endsWith('.md')) {
    trimmedName += '.md';
  }

  const folderId = folder_id ? Number(folder_id) : null;

  const db = getDb();

  if (folderId !== null) {
    const folder = db
      .prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?')
      .get(folderId, user.userId);
    if (!folder) {
      throw createError({ statusCode: 404, message: 'Folder not found' });
    }
  }

  try {
    const result = db
      .prepare(
        `
      INSERT INTO files (user_id, folder_id, name, content)
      VALUES (?, ?, ?, '')
    `
      )
      .run(user.userId, folderId, trimmedName);

    return {
      id: result.lastInsertRowid,
      user_id: user.userId,
      folder_id: folderId,
      name: trimmedName,
      content: '',
    };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes('UNIQUE constraint failed')
    ) {
      throw createError({
        statusCode: 409,
        message: 'A file with this name already exists in this location',
      });
    }
    throw error;
  }
});
