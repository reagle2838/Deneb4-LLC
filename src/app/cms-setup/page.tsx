import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { generateURI } from 'otplib';

export default async function CmsSetupPage() {
  if (process.env.KEYSTATIC_SETUP !== 'true') {
    notFound();
  }

  const secret = process.env.KEYSTATIC_TOTP_SECRET;
  if (!secret) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'var(--bg-base)' }}>
        <div className="card p-8 max-w-sm w-full">
          <h1 className="text-lg font-bold mb-3" style={{ color: 'var(--text-heading)' }}>Missing secret</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Add <code className="font-spec text-xs">KEYSTATIC_TOTP_SECRET</code> to your{' '}
            <code className="font-spec text-xs">.env.local</code> first.
          </p>
          <p className="text-xs mt-4 font-spec" style={{ color: 'var(--text-faint)' }}>
            Generate one: <code>node -e &quot;const &#123;generateSecret&#125;=require(&apos;otplib&apos;); console.log(generateSecret())&quot;</code>
          </p>
        </div>
      </div>
    );
  }

  const otpauthUrl = generateURI({ issuer: 'Deneb4', label: 'Deneb4 CMS', secret });
  const qrDataUri = await QRCode.toDataURL(otpauthUrl, { width: 240, margin: 2 });

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'var(--bg-base)' }}>
      <div className="card p-8 max-w-sm w-full text-center">
        <p className="font-spec text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--accent-light)' }}>One-time setup</p>
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-heading)' }}>Set up Google Authenticator</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Scan this QR code with Google Authenticator or Authy, then remove{' '}
          <code className="font-spec text-xs">KEYSTATIC_SETUP=true</code> from your env.
        </p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUri} alt="TOTP QR code" className="mx-auto rounded-sm mb-6" style={{ border: '1px solid var(--border-accent)' }} />

        <div className="text-left">
          <p className="text-xs font-spec font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--text-faint)' }}>Manual entry key</p>
          <p className="font-spec text-sm break-all p-3 rounded-sm" style={{ background: 'var(--bg-alt)', color: 'var(--text-heading)', border: '1px solid var(--border-accent)' }}>
            {secret}
          </p>
        </div>

        <p className="text-xs mt-6" style={{ color: 'var(--text-faint)' }}>
          After scanning, test your code at{' '}
          <a href="/cms-login" style={{ color: 'var(--accent-light)' }}>/cms-login</a>.
        </p>
      </div>
    </div>
  );
}
