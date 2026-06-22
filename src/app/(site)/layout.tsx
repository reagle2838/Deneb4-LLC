import SiteShell from "@/components/layout/SiteShell";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <GoogleAnalytics />
      <SiteShell>{children}</SiteShell>
    </div>
  );
}
