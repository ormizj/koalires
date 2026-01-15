import bcrypt from 'bcrypt';
import { getDb } from '../../utils/db';
import { signToken } from '../../utils/jwt';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { email, password } = body;

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password are required',
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw createError({ statusCode: 400, message: 'Invalid email format' });
  }

  if (password.length < 6) {
    throw createError({
      statusCode: 400,
      message: 'Password must be at least 6 characters',
    });
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email);
  if (existing) {
    throw createError({ statusCode: 409, message: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(email, passwordHash);

  const token = await signToken({
    userId: result.lastInsertRowid as number,
    email,
  });

  return {
    token,
    user: {
      id: result.lastInsertRowid,
      email,
    },
  };
});
