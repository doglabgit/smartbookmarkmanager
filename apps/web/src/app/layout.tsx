import type { Metadata } from 'next';
import './globals.css';

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
      <body className="min-h-screen bg-background">
        <nav className="border-b">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <a href="/bookmarks" className="font-semibold text-lg">
              Smart Bookmarks
            </a>
            <div className="flex gap-4">
              <a href="/bookmarks" className="text-sm hover:underline">
                Bookmarks
              </a>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
