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
  // TEMPORARY dev-only bypass for local testing. Remove CMS_AUTH_DISABLED
  // from .env.local (or set it to anything but "true") to restore the
  // password + 2FA gate. This does NOT affect the client portal.
  //
  // Hard-gated to non-production: even if the flag leaks into a production
  // environment (a copied .env, a stray host var), it is INERT there, so it
  // can never silently open the live Workspace. In production the real JWT
  // check below always runs.
  if (process.env.CMS_AUTH_DISABLED === 'true' && process.env.NODE_ENV !== 'production') {
    return true;
  }
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}
