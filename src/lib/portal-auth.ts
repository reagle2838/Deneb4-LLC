import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';

const getSecret = () => {
  const s = process.env.CMS_JWT_SECRET;
  if (!s) throw new Error('CMS_JWT_SECRET is not set');
  return new TextEncoder().encode(s);
};

export async function signPortalSession(clientSlug: string): Promise<string> {
  return new SignJWT({ clientSlug, type: 'portal' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifyPortalSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.type !== 'portal') return null;
    return (payload.clientSlug as string) ?? null;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
  } catch {
    return false;
  }
}

export function generateClientPassword(): string {
  // 12 chars, unambiguous alphanumeric (no 0/O/1/l/I)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join('');
}
