import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getAllArticles } from "@/lib/content";

export default async function SiteShell({ children }: { children: React.ReactNode }) {
  const articles = await getAllArticles();
  return (
    <>
      <Navbar articles={articles} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
