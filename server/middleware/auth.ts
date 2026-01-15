import { verifyToken } from '../utils/jwt';

const PUBLIC_ROUTES = [
  { method: 'POST', path: '/api/auth/register' },
  { method: 'POST', path: '/api/auth/login' },
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
    throw createError({ statusCode: 401, message: 'Invalid or expired token' });
  }

  event.context.user = payload;
});
