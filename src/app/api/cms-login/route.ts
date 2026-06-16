import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'otplib';
import { signSession } from '@/lib/cms-auth';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { password?: string; token?: string };
    const { password, token } = body;

    if (!password || !token) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const expectedPassword = process.env.KEYSTATIC_PASSWORD;
    const totpSecret = process.env.KEYSTATIC_TOTP_SECRET;

    if (!expectedPassword || !totpSecret) {
      console.error('CMS auth env vars not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Timing-safe password comparison
    const pwBuf = Buffer.from(password);
    const expectedBuf = Buffer.from(expectedPassword);
    const passwordMatch =
      pwBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(pwBuf, expectedBuf);

    // TOTP verification (otplib v13 async API)
    const totpResult = await verify({ secret: totpSecret, token });
    const totpValid = totpResult.valid;

    console.log('[cms-login] passwordMatch:', passwordMatch, '| totpValid:', totpValid, '| pwLen:', pwBuf.length, 'expectedLen:', expectedBuf.length);
    if (!passwordMatch || !totpValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const jwt = await signSession();

    const response = NextResponse.json({ ok: true });
    response.cookies.set('cms_auth', jwt, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
      secure: process.env.NODE_ENV === 'production',
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
