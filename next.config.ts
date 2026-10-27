import type { NextConfig } from 'next';
import site from './content/site.json';

/** Old weldclass.com.au URLs redirected to their new pages, so links and search rankings carry over. */
const legacy = Object.entries(site.redirects as unknown as Record<string, [string, number]>).map(([source, [destination, code]]) => ({
  source: source.replace(/[()?+*:]/g, (c) => '\\' + c),
  destination,
  permanent: code === 301 || code === 308,
}));

const config: NextConfig = {
  // Keep the trailing-slash URLs the site has always used (/products/fury-165.../).
  trailingSlash: true,
  poweredByHeader: false,
  // The NetSuite snapshot is read from disk, so ship it with the server functions too.
  outputFileTracingIncludes: { '/**': ['./content/netsuite.json'] },
  async redirects() {
    return [
      { source: '/shop', destination: '/search/', permanent: false },
      { source: '/cart', destination: '/where-to-buy/', permanent: false },
      { source: '/checkout', destination: '/where-to-buy/', permanent: false },
      { source: '/my-account', destination: '/login/', permanent: false },
      ...legacy,
    ];
  },
};

export default config;
