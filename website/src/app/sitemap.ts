import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://getduet.app', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://getduet.app/privacy', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: 'https://getduet.app/delete', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.1 },
  ];
}
