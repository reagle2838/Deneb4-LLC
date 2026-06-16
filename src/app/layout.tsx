import type { Metadata } from "next";
import "./globals.css";
import SiteShell from "@/components/layout/SiteShell";

const SITE_URL = "https://deneb4.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: "%s | Deneb4",
    default: "Deneb4 | Websites Built for Technical Businesses",
  },
  description:
    "Deneb4 designs and builds websites for industrial, engineering, and manufacturing businesses. Fixed-scope, fixed-price builds you own outright: no agency overhead, no monthly lock-in. Built on Next.js.",
  keywords: [
    "web design for manufacturers",
    "industrial website design",
    "engineering company website",
    "B2B website developer",
    "Next.js web developer",
    "website for automation company",
    "SCADA company website",
    "fabrication shop website",
    "technical distributor website",
    "AIO optimization",
    "own your website code",
  ],
  authors: [{ name: "Deneb4" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Deneb4",
    title: "Deneb4 | Websites Built for Technical Businesses",
    description:
      "Web design & development for industrial, engineering, and manufacturing businesses. Sharp work, no agency overhead. Fixed-scope, fixed-price, and you own the code.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Deneb4 | Websites Built for Technical Businesses",
    description:
      "Web design & development for industrial, engineering, and manufacturing businesses. You own the code. Built on Next.js.",
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* Structured data — ProfessionalService entity */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ProfessionalService",
              "@id": `${SITE_URL}/#organization`,
              name: "Deneb4",
              description:
                "Web design and development for industrial, engineering, and manufacturing businesses. Fixed-scope, fixed-price websites that clients own outright.",
              url: SITE_URL,
              email: "hello@deneb4.com",
              priceRange: "$$",
              areaServed: { "@type": "Country", name: "United States" },
              founder: { "@type": "Person", name: "Ridhi" },
              knowsAbout: [
                "Web design for industrial businesses",
                "Next.js development",
                "AI Optimization (AIO)",
                "B2B lead generation websites",
                "Technical product catalogs",
              ],
              makesOffer: [
                { "@type": "Offer", itemOffered: { "@type": "Service", name: "Foundation website package" } },
                { "@type": "Offer", itemOffered: { "@type": "Service", name: "Professional website package" } },
                { "@type": "Offer", itemOffered: { "@type": "Service", name: "Enterprise website package" } },
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              url: SITE_URL,
              name: "Deneb4",
              publisher: { "@id": `${SITE_URL}/#organization` },
            }),
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-theme-base text-theme min-h-screen flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-sm focus:text-sm focus:font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
