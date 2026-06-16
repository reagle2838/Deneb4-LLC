import type { MetadataRoute } from "next";
import { ARTICLES } from "@/data/articles";

const BASE = "https://deneb4.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/services", "/process", "/industries", "/work", "/articles", "/faq", "/about", "/contact", "/start"];
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = routes.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));

  const articlePages: MetadataRoute.Sitemap = ARTICLES.map((a) => ({
    url: `${BASE}/articles/${a.slug}`,
    lastModified: new Date(a.date + "T00:00:00"),
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  return [...staticPages, ...articlePages];
}
