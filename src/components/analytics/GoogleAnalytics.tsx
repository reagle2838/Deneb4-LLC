import Script from 'next/script';
import GaPageView from './GaPageView';

/**
 * Google Analytics 4. Renders nothing unless NEXT_PUBLIC_GA_ID is set, so
 * dev and un-configured builds stay clean. NEXT_PUBLIC_ vars are inlined at
 * build time, so set the ID before running `npm run build` for production.
 */
export default function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}', { send_page_view: false });`}
      </Script>
      <GaPageView gaId={id} />
    </>
  );
}
