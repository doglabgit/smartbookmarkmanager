'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Simple check - if there's an access token cookie, redirect to bookmarks
    // In production, you'd want to verify with the backend
    const hasToken = document.cookie.includes('accessToken');
    if (hasToken) {
      router.push('/bookmarks');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse">Loading...</div>
    </div>
  );
}
