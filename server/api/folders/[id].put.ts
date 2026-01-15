import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid folder ID' })
  }

  const body = await readBody(event)
  const { name } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError({ statusCode: 400, message: 'Folder name is required' })
  }

  const trimmedName = name.trim()
  const db = getDb()

  const folder = db.prepare('SELECT id, parent_id FROM folders WHERE id = ? AND user_id = ?').get(id, user.userId) as { id: number; parent_id: number | null } | undefined
  if (!folder) {
    throw createError({ statusCode: 404, message: 'Folder not found' })
  }

  try {
    db.prepare(`
      UPDATE folders
      SET name = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(trimmedName, id, user.userId)

    return {
      id,
      name: trimmedName
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw createError({ statusCode: 409, message: 'A folder with this name already exists in this location' })
    }
    throw error
  }
})
