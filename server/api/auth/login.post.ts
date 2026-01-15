import { signToken } from '../../utils/jwt';
import { compareHashedPassword } from '../../utils/bcrypt';
import { getUserByEmail } from '~~/server/database/repositories/users';
import { addJwtToken } from '~~/server/database/repositories/jwt';
import type { LoginRequestBody } from '~~/server/types';

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginRequestBody>(event);
  const { email, password } = body;

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password are required',
    });
  }

  const normalizedEmail = email.toLowerCase();
  const user = await getUserByEmail(normalizedEmail);

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password',
    });
  }

  const valid = compareHashedPassword(password, user.passwordHash);
  if (!valid) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password',
    });
  }

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
