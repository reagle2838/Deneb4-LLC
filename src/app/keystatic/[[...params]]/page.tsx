import { makePage } from '@keystatic/next/ui/app';
import config from '../../../../keystatic.config';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/cms-auth';

const KeystaticPage = makePage(config);

export default async function KeystaticAdminPage() {
  const token = (await cookies()).get('cms_auth')?.value;
  if (!(await verifySession(token))) {
    redirect('/cms-login');
  }
  return <KeystaticPage />;
}
