import { getAuthHeader } from '../../utils/auth';
import { verifyToken } from '../../utils/jwt';
import { deleteJwtToken } from '~~/server/database/repositories/jwt';

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
      message: 'Invalid or expired token',
    });
  }

  const deleted = await deleteJwtToken(token);
  if (!deleted) {
    throw createError({
      statusCode: 404,
      message: 'Token not found',
    });
  }

  return { success: true };
});
