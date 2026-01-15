import { verifyToken } from '../utils/jwt';
import { isJwtTokenExistByToken } from '~~/server/database/repositories/jwt';
import { getUserByEmail } from '~~/server/database/repositories/users';
import '~~/server/types';

const PUBLIC_ROUTES = [
  { method: 'POST', path: '/api/auth/register' },
  { method: 'POST', path: '/api/auth/login' },
  { method: 'DELETE', path: '/api/auth/logout' },
];

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  const method = getMethod(event);

  if (!path.startsWith('/api/')) {
    return;
  }

  const isPublic = PUBLIC_ROUTES.some(
    (route) => route.method === method && path === route.path
  );
  if (isPublic) {
    return;
  }

  const authHeader = getHeader(event, 'authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      message: 'Missing or invalid authorization header',
    });
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);
  if (!payload) {
    throw createError({ statusCode: 401, message: 'Invalid token' });
  }

  const tokenExists = await isJwtTokenExistByToken(token, payload.email);
  if (!tokenExists) {
    throw createError({ statusCode: 401, message: 'Token has been revoked' });
  }

  const user = await getUserByEmail(payload.email);
  if (!user) {
    throw createError({ statusCode: 401, message: 'User not found' });
  }

  event.context.user = {
    userId: user.id,
    email: user.email,
  };
});
