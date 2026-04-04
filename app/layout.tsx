import type { Metadata } from 'next';
import './globals.css';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'Vida',
  description: 'Your voice-driven daily activity tracker',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <main className="max-w-lg mx-auto pb-24 min-h-screen">
          {children}
        </main>
        <Navigation />
      </body>
    </html>
  );
}
