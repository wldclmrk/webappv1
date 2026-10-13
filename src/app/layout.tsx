import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './weldclass.css';
import './site.css';
import { SITE_URL } from '@/lib/util';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Weldclass | Welding Machines, Consumables & Safety Gear',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/** Settings read by public/js/site.js (search suggestions and the stockist finder). */
const CFG = { rest: '/api/', search: '/search/', ver: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || '1' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap" />
      </head>
      <body className="wc-site">
        {children}
        <script dangerouslySetInnerHTML={{ __html: 'window.WELDCLASS=' + JSON.stringify(CFG) + ';' }} />
        <Script src="/js/site.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
