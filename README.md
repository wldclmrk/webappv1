# Weldclass website

The Weldclass brand website (Version A design), built with [Next.js](https://nextjs.org) and hosted on [Vercel](https://vercel.com).
It replaces the earlier WordPress build: every page, product, category, article and stockist was exported from WordPress
into this repository, and the pages render with the same markup and stylesheet, so the site looks exactly as before.

## How it fits together

| Path | What it is |
| --- | --- |
| `content/` | All site content as JSON: `products.json`, `categories.json`, `posts.json` (articles), `pages.json`, `compares.json`, `stockists.json`, `site.json` (homepage, header and footer copy, legacy redirects) and `media.json` (image sizes). |
| `public/media/` | Product, category and article images. |
| `public/img/` | Brand imagery (bands, heroes, tiles, logos, badges). |
| `public/js/site.js` | Site interactions: mega menu, search suggestions, gallery, tabs, part-number filter, blog and category filters, stockist finder. |
| `src/lib/catalogue.ts` | **Product data layer.** Every page reads products and categories through this file only. |
| `src/lib/pages/*.ts` | Page templates (home, product, category, articles, content pages, stockists, search, comparisons). |
| `src/lib/blocks.ts`, `chrome.ts`, `details.ts` | Shared parts: product cards, breadcrumbs, title bands, header, footer, the product "Details & features" panel. |
| `src/lib/seo.ts` | Titles, descriptions, canonical links, Open Graph and JSON-LD structured data. |
| `src/app/` | Next.js routes. Product, category, article, comparison and stockist pages are generated at build time. Search and Where to buy run on demand. |
| `src/app/api/forms` | Handles the contact, batch certificate and dealer application forms (emails them with Resend). |

URLs are unchanged from the WordPress site (`/products/<slug>/`, `/category/<top>/<sub>/`, `/blog/<slug>/`, `/stockists/nsw/` and so on),
and the 750 legacy weldclass.com.au redirects are in `content/site.json` and applied in `next.config.ts`.

The page templates build the original HTML as strings, which keeps the markup identical to the Version A design.
They can be converted to React components one at a time later without changing how the site looks.

## Run it locally

Requires Node.js 20.9 or later.

```bash
npm install
cp .env.example .env.local   # then fill in the values you need
npm run dev                  # http://localhost:3000
```

`npm run build` checks the whole site compiles and pre-renders every page.

## Deploy on Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New > Project**, import the repository and keep the detected **Next.js** settings.
3. Add the environment variables from `.env.example` under **Settings > Environment Variables**.
4. Deploy. Each push to the main branch redeploys the site; other branches get preview URLs.
5. When you are ready to go live, add `www.weldclass.com.au` under **Settings > Domains** and update the DNS records Vercel shows you.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public address used for canonical links, the sitemap and structured data. |
| `RESEND_API_KEY`, `FORM_TO_EMAIL`, `FORM_FROM_EMAIL` | Form emails via [Resend](https://resend.com). Without a key, submissions are only written to the Vercel function log. The from address must be on a domain verified in Resend. |
| `NEXT_PUBLIC_DEALER_LOGIN_URL` | Dealer portal address (for example the NetSuite customer centre). Blank shows a "contact us" message on the login pages. |
| `NOINDEX` | Set to `true` on preview deployments so search engines don't index them. |

## Editing content

- **Articles, pages, comparisons, stockists, homepage copy:** edit the JSON in `content/` (in GitHub you can edit a file in the browser and commit it). Vercel redeploys automatically.
- **Products and categories:** currently in `content/products.json` and `content/categories.json`. These are intended to come from NetSuite (below).

## Connecting NetSuite

All product and category data goes through `src/lib/catalogue.ts`. To move products to NetSuite:

1. Add a NetSuite client (SuiteTalk REST or a RESTlet) with credentials in environment variables.
2. Change `catalogue.ts` (and the product and category loaders in `src/lib/content.ts`) to read from NetSuite instead of the JSON files, keeping the same function signatures (`p()`, `parts()`, `prodsIn()`, `tops()` and so on).
3. Product pages are built at deploy time. To pick up NetSuite changes without a full redeploy, add `export const revalidate = 3600` to the product and category routes, or trigger a Vercel deploy hook from NetSuite when items change.

Fields NetSuite will need to supply per product: name, slug, description, short description, images, series/brand, part numbers
(SKU, description, RRP, image), category, and the Weldclass extras now in `products.json` under `meta` (summary, who it suits,
specifications, FAQs, downloads, videos, reviews and rating). Those extras can stay in this repository if NetSuite doesn't hold them.

## Changes from the WordPress site

- **Forms** post to `/api/forms` and are emailed (previously saved in wp-admin and emailed by WordPress).
- **Dealer login** links to the dealer portal set in `NEXT_PUBLIC_DEALER_LOGIN_URL`. WordPress user accounts no longer exist.
- **WooCommerce cart, checkout and account pages** are gone. `/shop`, `/cart`, `/checkout` and `/my-account` redirect to search, Where to buy and the dealer login.
