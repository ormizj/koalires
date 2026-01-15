import { getDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const query = getQuery(event)
  const folderId = query.folder_id ? Number(query.folder_id) : null

  const db = getDb()
  let files

  if (folderId === null) {
    files = db.prepare(`
      SELECT id, user_id, folder_id, name, created_at, updated_at
      FROM files
      WHERE user_id = ? AND folder_id IS NULL
      ORDER BY name
    `).all(user.userId)
  }
  else {
    files = db.prepare(`
      SELECT id, user_id, folder_id, name, created_at, updated_at
      FROM files
      WHERE user_id = ? AND folder_id = ?
      ORDER BY name
    `).all(user.userId, folderId)
  }

  return files
})
