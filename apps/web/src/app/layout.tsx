import type { Metadata } from 'next';
import './globals.css';
import ThemeToggle from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'Smart Bookmark Manager',
  description: 'Intelligent bookmark management with AI summaries',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background">
        <nav className="border-b">
          <div className="max-w-[1200px] mx-auto px-4 py-4 flex items-center justify-between">
            <a href="/bookmarks" className="font-bold text-lg">
              Smart Bookmarks
            </a>
            <div className="flex items-center gap-4">
              <a href="/bookmarks" className="text-sm hover:underline font-medium">
                Bookmarks
              </a>
              <ThemeToggle />
            </div>
          </div>
        </nav>
        <main className="max-w-[1200px] mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
