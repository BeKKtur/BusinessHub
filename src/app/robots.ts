import type { MetadataRoute } from "next";
import { getClientSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getClientSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing", "/terms", "/privacy", "/refund", "/contact"],
      disallow: ["/admin", "/analytics", "/appointments", "/billing", "/clients", "/dashboard", "/finance", "/profile", "/services", "/telegram"]
    },
    sitemap: `${baseUrl}/sitemap.xml`
  };
}
