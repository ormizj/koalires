import { getDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid file ID' })
  }

  const db = getDb()

  const file = db.prepare(`
    SELECT id, user_id, folder_id, name, content, created_at, updated_at
    FROM files
    WHERE id = ? AND user_id = ?
  `).get(id, user.userId)

  if (!file) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }

  return file
})
