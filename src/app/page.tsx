import { Shell } from '@/components/Shell';
import { homeHtml } from '@/lib/pages/home';
import { pageSeo } from '@/lib/pages/content';
import { toMetadata } from '@/lib/seo';

const SEO = pageSeo('home', { url: '/' });
export const metadata = toMetadata({ ...SEO, t: 'Weldclass | Welding Machines, Consumables & Safety Gear' });

export default function Home() {
  return <Shell html={homeHtml()} seo={SEO} />;
}
