import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/cms-auth';
import KeystaticApp from './keystatic-app';

export default async function KeystaticAdminPage() {
  const token = (await cookies()).get('cms_auth')?.value;
  if (!(await verifySession(token))) {
    redirect('/cms-login');
  }
  return <KeystaticApp />;
}
