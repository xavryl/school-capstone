import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Registrar & Treasury Services',
  description: 'Online requests, appointments and queueing for the registrar and treasury offices.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="topbar">
          <Link href="/" className="brand">One-Stop Services</Link>
          <Link href="/request">Request</Link>
          <Link href="/inquiry">Guest inquiry</Link>
          <Link href="/track">Track</Link>
          <span className="spacer" />
          <Link href="/staff">Staff</Link>
          <Link href="/login">Sign in</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
