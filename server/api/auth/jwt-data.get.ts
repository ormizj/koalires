import { getAuthHeader } from '../../utils/auth';
import { verifyToken } from '../../utils/jwt';

export default defineEventHandler(async (event) => {
  const token = getAuthHeader(event);

  if (!token) {
    throw createError({
      statusCode: 401,
      message: 'Missing authorization token',
    });
  }

  const payload = await verifyToken(token);
  if (!payload) {
    throw createError({
      statusCode: 401,
      message: 'Invalid token',
    });
  }

  return {
    email: payload.email,
    iat: payload.iat,
  };
});
