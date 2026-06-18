import type { MetadataRoute } from "next";
import { getAllArticles } from "@/lib/content";
import { getAllProjects } from "@/lib/work";

const BASE = "https://deneb4.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = ["", "/services", "/process", "/industries", "/work", "/articles", "/faq", "/about", "/contact", "/start"];
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = routes.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));

  const articles = await getAllArticles();
  const articlePages: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${BASE}/articles/${a.slug}`,
    lastModified: a.date ? new Date(a.date + "T00:00:00") : now,
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  const projects = await getAllProjects();
  const workPages: MetadataRoute.Sitemap = projects.map((p) => ({
    url: `${BASE}/work/${p.slug}`,
    lastModified: p.date ? new Date(p.date + "T00:00:00") : now,
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  return [...staticPages, ...articlePages, ...workPages];
}
