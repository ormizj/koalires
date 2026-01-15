import { getDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const query = getQuery(event)
  const parentId = query.parent_id ? Number(query.parent_id) : null

  const db = getDb()
  let folders

  if (parentId === null) {
    folders = db.prepare(`
      SELECT id, user_id, parent_id, name, created_at, updated_at
      FROM folders
      WHERE user_id = ? AND parent_id IS NULL
      ORDER BY name
    `).all(user.userId)
  } else {
    folders = db.prepare(`
      SELECT id, user_id, parent_id, name, created_at, updated_at
      FROM folders
      WHERE user_id = ? AND parent_id = ?
      ORDER BY name
    `).all(user.userId, parentId)
  }

  return folders
})
