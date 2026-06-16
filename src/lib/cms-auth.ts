import { SignJWT, jwtVerify } from 'jose';

const getSecret = () => {
  const s = process.env.CMS_JWT_SECRET;
  if (!s) throw new Error('CMS_JWT_SECRET is not set');
  return new TextEncoder().encode(s);
};

export async function signSession(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecret());
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}
