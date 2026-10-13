import type { NextConfig } from 'next';
import site from './content/site.json';

/** Legacy weldclass.com.au URLs (and old WordPress paths) redirected to their new pages. */
const legacy = Object.entries(site.redirects as unknown as Record<string, [string, number]>).map(([source, [destination, code]]) => ({
  source: source.replace(/[()?+*:]/g, (c) => '\\' + c),
  destination,
  permanent: code === 301 || code === 308,
}));

const config: NextConfig = {
  // Keep the trailing-slash URLs the site has always used (/products/fury-165.../).
  trailingSlash: true,
  poweredByHeader: false,
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
