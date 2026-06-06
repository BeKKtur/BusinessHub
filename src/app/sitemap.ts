import type { MetadataRoute } from "next";
import { getClientSiteUrl } from "@/lib/site-url";

const publicRoutes = ["/", "/pricing", "/terms", "/privacy", "/refund", "/contact"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getClientSiteUrl();
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: route === "/" || route === "/pricing" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : route === "/pricing" ? 0.9 : 0.7
  }));
}
