import { Shell } from '@/components/Shell';
import { notFoundHtml } from '@/lib/pages/content';

export const metadata = { title: { absolute: 'Page not found | Weldclass' }, robots: 'noindex, follow' };

export default function NotFound() {
  return <Shell html={notFoundHtml()} />;
}
