import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = "https://zhihu.shoppilot.help";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).end();
  }

  const resourcesFile = join(process.cwd(), "data", "resources.json");
  let resourcePages = [];

  if (existsSync(resourcesFile)) {
    const data = JSON.parse(readFileSync(resourcesFile, "utf8"));
    resourcePages = data.pages || [];
  }

  const today = new Date().toISOString().split("T")[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

  resourcePages.forEach((page) => {
    const lastmod = page.createdAt ? page.createdAt.split("T")[0] : today;
    const title = (page.title || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    xml += `
  <url>
    <loc>${BASE_URL}/resource/${page.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  });

  xml += "\n</urlset>";

  response.writeHead(200, {
    "content-type": "application/xml; charset=utf-8",
    "cache-control": "public, max-age=3600"
  });
  response.end(xml);
}
