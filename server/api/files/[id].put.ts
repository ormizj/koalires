import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid file ID' })
  }

  const body = await readBody(event)
  const { name, content } = body

  const db = getDb()

  const file = db.prepare('SELECT id, folder_id, name FROM files WHERE id = ? AND user_id = ?').get(id, user.userId) as { id: number; folder_id: number | null; name: string } | undefined
  if (!file) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }

  const updates: string[] = []
  const values: (string | number)[] = []

  if (name !== undefined) {
    let trimmedName = String(name).trim()
    if (trimmedName.length === 0) {
      throw createError({ statusCode: 400, message: 'File name cannot be empty' })
    }
    if (!trimmedName.endsWith('.md')) {
      trimmedName += '.md'
    }
    updates.push('name = ?')
    values.push(trimmedName)
  }

  if (content !== undefined) {
    updates.push('content = ?')
    values.push(String(content))
  }

  if (updates.length === 0) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  updates.push("updated_at = datetime('now')")
  values.push(id, user.userId)

  try {
    db.prepare(`
      UPDATE files
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `).run(...values)

    const updated = db.prepare('SELECT id, user_id, folder_id, name, content, created_at, updated_at FROM files WHERE id = ?').get(id)
    return updated
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw createError({ statusCode: 409, message: 'A file with this name already exists in this location' })
    }
    throw error
  }
})
