import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: { default: 'Dotcod Admin', template: '%s · Dotcod Admin' },
  description: 'Dotcod back office for staff.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
