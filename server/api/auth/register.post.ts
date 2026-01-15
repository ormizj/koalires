import { signToken } from '../../utils/jwt';
import { hashPassword } from '../../utils/bcrypt';
import { usePrisma } from '~~/server/composables/prisma';
import { isUserExistsByEmail } from '~~/server/database/repositories/users';
import { addJwtToken } from '~~/server/database/repositories/jwt';
import type { RegisterRequestBody } from '~~/server/types';

export default defineEventHandler(async (event) => {
  const body = await readBody<RegisterRequestBody>(event);
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

  const normalizedEmail = email.toLowerCase();
  const existing = await isUserExistsByEmail(normalizedEmail);
  if (existing) {
    throw createError({ statusCode: 409, message: 'Email already registered' });
  }

  const passwordHash = hashPassword(password);
  const db = usePrisma();
  const user = await db.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
    },
  });

  const token = await signToken(user.email);
  await addJwtToken(normalizedEmail, token);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
    },
  };
});
