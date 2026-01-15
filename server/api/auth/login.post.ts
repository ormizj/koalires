import bcrypt from 'bcrypt'
import { getDb } from '../../utils/db'
import { signToken } from '../../utils/jwt'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password are required' })
  }

  const db = getDb()
  const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email) as { id: number; email: string; password_hash: string } | undefined

  if (!user) {
    throw createError({ statusCode: 401, message: 'Invalid email or password' })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    throw createError({ statusCode: 401, message: 'Invalid email or password' })
  }

  const token = await signToken({ userId: user.id, email: user.email })

  return {
    token,
    user: {
      id: user.id,
      email: user.email
    }
  }
})
