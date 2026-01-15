import { getDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const db = getDb()
  const folders = db.prepare(`
    SELECT id, user_id, parent_id, name, created_at, updated_at
    FROM folders
    WHERE user_id = ?
    ORDER BY name
  `).all(user.userId)

  return folders
})
