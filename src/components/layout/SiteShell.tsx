import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getAllArticles } from "@/lib/content";
import { getCapabilityGroups } from "@/lib/services-content";

export default async function SiteShell({ children }: { children: React.ReactNode }) {
  const articles = await getAllArticles();
  const serviceGroups = await getCapabilityGroups();
  return (
    <>
      <Navbar articles={articles} serviceGroups={serviceGroups} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
