'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Tag {
  id: number;
  name: string;
}

interface Bookmark {
  id: number;
  url: string;
  title: string | null;
  description: string | null;
  faviconUrl: string | null;
  aiSummary: string | null;
  createdAt: string;
  enrichedAt: string | null;
  tags: Tag[];
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [formData, setFormData] = useState({
    url: '',
    title: '',
    description: '',
    tags: '' as string,
  });

  const router = useRouter();

  // Helper: Get CSRF token from cookies
  const getCsrfToken = () => {
    const match = document.cookie.match(/csrfToken=([^;]+)/);
    return match ? match[1] : null;
  };

  // Check if user is authenticated by calling the API
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        if (!response.ok) {
          router.push('/login');
        }
      } catch {
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  // Fetch bookmarks
  const fetchBookmarks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedTag) params.append('tag', selectedTag);

      const response = await fetch(`/api/bookmarks?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch bookmarks');
      }

      const data = await response.json();
      setBookmarks(data.data.bookmarks);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  }, [search, selectedTag, router]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const tags = formData.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const body = {
        url: formData.url,
        title: formData.title || null,
        description: formData.description || null,
        tags,
      };

      const url = editingBookmark ? `/api/bookmarks/${editingBookmark.id}` : '/api/bookmarks';
      const method = editingBookmark ? 'PATCH' : 'POST';

      const csrfToken = getCsrfToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save bookmark');
      }

      // Reset form
      setFormData({ url: '', title: '', description: '', tags: '' });
      setShowAddForm(false);
      setEditingBookmark(null);

      // Refresh bookmarks
      fetchBookmarks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bookmark');
      setLoading(false);
    }
  };

  const handleEdit = (bookmark: Bookmark) => {
    setEditingBookmark(bookmark);
    setFormData({
      url: bookmark.url,
      title: bookmark.title || '',
      description: bookmark.description || '',
      tags: bookmark.tags.map(t => t.name).join(', '),
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this bookmark?')) {
      return;
    }

    try {
      const csrfToken = getCsrfToken();
      const headers: HeadersInit = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch(`/api/bookmarks/${id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete bookmark');
      }

      fetchBookmarks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bookmark');
    }
  };

  const handleLogout = async () => {
    const csrfToken = getCsrfToken();
    const headers: HeadersInit = {};
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    await fetch('/api/auth/logout', {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    router.push('/login');
    router.refresh();
  };

  // Fetch distinct tags for filter dropdown (more efficient than looping)
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch('/api/bookmarks/tags', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setAllTags(data.data.tags);
        }
      } catch (err) {
        console.error('Failed to fetch tags:', err);
      }
    };
    fetchTags();
  }, []);

  // Replaced getUniqueTags with server-side distinct query

  if (loading && bookmarks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse">Loading bookmarks...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Bookmarks</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
          >
            {showAddForm ? 'Cancel' : 'Add Bookmark'}
          </button>
          <button
            onClick={handleLogout}
            className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80"
          >
            Logout
          </button>
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-4 border rounded-lg space-y-4 bg-card">
          <h2 className="text-xl font-semibold">
            {editingBookmark ? 'Edit Bookmark' : 'Add New Bookmark'}
          </h2>

          {error && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">URL *</label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full p-2 border rounded-md"
              placeholder="https://example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full p-2 border rounded-md"
              placeholder="Page title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2 border rounded-md"
              rows={2}
              placeholder="Brief description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full p-2 border rounded-md"
              placeholder="design, tools, productivity"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Saving...' : editingBookmark ? 'Update' : 'Save'}
          </button>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search bookmarks..."
          className="flex-1 p-2 border rounded-md"
        />
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="p-2 border rounded-md"
        >
          <option value="">All Tags</option>
          {allTags.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </div>

      {/* Bookmarks grid */}
      {bookmarks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No bookmarks found</p>
          <p className="text-sm">
            {search || selectedTag ? 'Try adjusting your filters' : 'Add your first bookmark!'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookmarks.map(bookmark => (
            <div key={bookmark.id} className="border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    {bookmark.faviconUrl ? (
                      <img
                        src={bookmark.faviconUrl}
                        alt=""
                        className="w-4 h-4 flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-4 h-4 flex-shrink-0 bg-muted rounded" />
                    )}
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary hover:underline truncate"
                    >
                      {bookmark.title || bookmark.url}
                    </a>
                  </div>

                  {bookmark.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {bookmark.description}
                    </p>
                  )}

                  {bookmark.aiSummary && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-blue-600 mb-1">AI Summary</p>
                      <p className="text-sm bg-blue-50 p-2 rounded border border-blue-200">
                        {bookmark.aiSummary}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {bookmark.tags.map(tag => (
                      <span
                        key={tag.id}
                        className="text-xs bg-secondary px-2 py-1 rounded-full"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground mt-2">
                    Added {new Date(bookmark.createdAt).toLocaleDateString()}
                    {bookmark.enrichedAt && (
                      <span> • Enriched {new Date(bookmark.enrichedAt).toLocaleDateString()}</span>
                    )}
                  </p>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(bookmark)}
                    className="text-sm text-primary hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(bookmark.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
