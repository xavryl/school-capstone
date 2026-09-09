import type { Metadata } from 'next';
import './globals.css';
import NavBar from '@/components/NavBar';
import FaqBubble from '@/components/FaqBubble';
import BackgroundWaves from '@/components/BackgroundWaves';
import BackBar from '@/components/BackBar';

export const metadata: Metadata = {
  title: 'Registrar & Treasury Services',
  description:
    'Online requests, appointments and queueing for the registrar and treasury offices.',
};

// Runs before the first paint, so a viewer who chose light does not get a
// flash of dark (or the reverse) while React hydrates.
const THEME_SCRIPT = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <BackgroundWaves />
        <NavBar />
        <BackBar />
        {children}
        <FaqBubble />
      </body>
    </html>
  );
}
