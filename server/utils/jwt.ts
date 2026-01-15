import { SignJWT, jwtVerify } from 'jose';

function getSecret(): Uint8Array {
  const config = useRuntimeConfig();
  return new TextEncoder().encode(config.jwtSecret);
}

export interface JwtPayload {
  email: string;
  iat: number;
}

export async function signToken(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      email: payload.email as string,
      iat: payload.iat as number,
    };
  } catch {
    return null;
  }
}
