import { makeRouteHandler } from '@keystatic/next/route-handler';
import config from '../../../../../keystatic.config';
import { NextRequest } from 'next/server';
import { verifySession } from '@/lib/cms-auth';

const { GET: _GET, POST: _POST } = makeRouteHandler({ config });

export async function GET(req: NextRequest) {
  if (!(await verifySession(req.cookies.get('cms_auth')?.value))) {
    return new Response('Unauthorized', { status: 401 });
  }
  return _GET(req);
}

export async function POST(req: NextRequest) {
  if (!(await verifySession(req.cookies.get('cms_auth')?.value))) {
    return new Response('Unauthorized', { status: 401 });
  }
  return _POST(req);
}
