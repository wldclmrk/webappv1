import { allProductIds, p, subs, termUrl, topLabel, tops } from '@/lib/catalogue';
import { abs, money, pageUrl } from '@/lib/util';

/** llms.txt: key pages, categories and products with RRP, for AI assistants. */
export const dynamic = 'force-static';

export function GET() {
  let o = '# Weldclass\n\n> Australian-owned welding supplier based at 6 East West Place, Tamworth NSW 2340 (phone 02 6764 9590), trading since 1979. Products are sold only through more than 1,000 trade and industrial distributors across Australia and the South Pacific; prices shown are RRP including GST.\n\n## Key pages\n';
  for (const [k, l] of [['where-to-buy', 'Where to buy'], ['stockists', 'Stockists by state'], ['warranty', 'Warranty'], ['handy-tools', 'Handy tools and selection guides'], ['contact', 'Contact']]) {
    o += '- [' + l + '](' + abs(pageUrl(k)) + ')\n';
  }
  o += '\n## Product categories\n';
  for (const t of tops()) o += '- [' + topLabel(t) + '](' + abs(termUrl(t)) + '): ' + subs(t).map((s) => s.name).join(', ') + '\n';
  o += '\n## Products\n';
  for (const id of allProductIds()) {
    const x = p(id);
    if (x) o += '- [' + x.name + '](' + abs(x.url) + ')' + (x.from ? ': RRP ' + (x.prices.length > 1 ? 'from ' : '') + money(x.from) : '') + '\n';
  }
  return new Response(o, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
