import SiteShell from "@/components/layout/SiteShell";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteShell>{children}</SiteShell>
    </div>
  );
}
