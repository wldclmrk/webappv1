import type { MetadataRoute } from 'next';
import { abs } from '@/lib/util';

const BOTS = ['Googlebot', 'Bingbot', 'Google-Extended', 'OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'PerplexityBot', 'ClaudeBot', 'Claude-SearchBot', 'Applebot-Extended'];

export default function robots(): MetadataRoute.Robots {
  if (process.env.NOINDEX === 'true') return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/search', '/login', '/dealer/', '/api/'] }, ...BOTS.map((b) => ({ userAgent: b, allow: '/' }))],
    sitemap: abs('/sitemap.xml'),
  };
}
