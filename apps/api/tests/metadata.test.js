/**
 * Metadata fetch service tests
 * Tests fetchMetadata with mocked HTTP responses
 */

const { fetchMetadata } = require('../src/services/metadata');

// Mock global.fetch
global.fetch = jest.fn();

describe('fetchMetadata', () => {
  const testUrl = 'https://example.com/page';

  beforeEach(() => {
    fetch.mockClear();
  });

  it('should extract title from <title> tag', async () => {
    const html = `
      <html>
        <head><title>Test Page Title</title></head>
        <body>Content</body>
      </html>
    `;

    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html
    });

    const result = await fetchMetadata(testUrl);

    expect(result).toEqual({
      title: 'Test Page Title',
      description: null,
      faviconUrl: 'https://example.com/favicon.ico'
    });
  });

  it('should fall back to og:title if <title> empty', async () => {
    const html = `
      <html>
        <head>
          <title></title>
          <meta property="og:title" content="OG Title">
        </head>
        <body>Content</body>
      </html>
    `;

    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html
    });

    const result = await fetchMetadata(testUrl);
    expect(result.title).toBe('OG Title');
  });

  it('should fall back to twitter:title if og:title missing', async () => {
    const html = `
      <html>
        <head>
          <title></title>
          <meta name="twitter:title" content="Twitter Title">
        </head>
        <body>Content</body>
      </html>
    `;

    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html
    });

    const result = await fetchMetadata(testUrl);
    expect(result.title).toBe('Twitter Title');
  });

  it('should extract description from meta description', async () => {
    const html = `
      <html>
        <head>
          <meta name="description" content="Page description">
        </head>
        <body>Content</body>
      </html>
    `;

    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html
    });

    const result = await fetchMetadata(testUrl);
    expect(result.description).toBe('Page description');
  });

  it('should extract favicon from link[rel="icon"]', async () => {
    const html = `
      <html>
        <head>
          <link rel="icon" href="/custom-favicon.ico">
        </head>
        <body>Content</body>
      </html>
    `;

    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html
    });

    const result = await fetchMetadata(testUrl);
    expect(result.faviconUrl).toBe('https://example.com/custom-favicon.ico');
  });

  it('should resolve relative favicon URL', async () => {
    const html = `
      <html>
        <head>
          <link rel="icon" href="favicon.ico">
        </head>
        <body>Content</body>
      </html>
    `;

    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html
    });

    const result = await fetchMetadata(testUrl);
    expect(result.faviconUrl).toBe('https://example.com/favicon.ico');
  });

  it('should return nulls on network error', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchMetadata(testUrl);

    expect(result).toEqual({
      title: null,
      description: null,
      faviconUrl: null
    });
  });

  it('should return nulls on non-200 response', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found'
    });

    const result = await fetchMetadata(testUrl);

    expect(result).toEqual({
      title: null,
      description: null,
      faviconUrl: null
    });
  });

  it('should handle huge HTML pages without crashing', async () => {
    const hugeHtml = '<html><head><title>Huge Page</title></head><body>' + 'a'.repeat(1000000) + '</body></html>';
    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => hugeHtml
    });

    const result = await fetchMetadata(testUrl);
    expect(result.title).toBe('Huge Page');
  });

  it('should handle redirects gracefully', async () => {
    // Simulate redirect response that fetch follows automatically
    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><head><title>Redirected</title></head><body></body></html>'
    });

    const result = await fetchMetadata(testUrl);
    expect(result.title).toBe('Redirected');
  });

  it('should trim whitespace from title and description', async () => {
    const html = `
      <html>
        <head>
          <title>   Spaces   and   More   </title>
          <meta name="description" content="  Lots   of   spaces  ">
        </head>
        <body>Content</body>
      </html>
    `;

    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html
    });

    const result = await fetchMetadata(testUrl);
    expect(result.title).toBe('Spaces and More');
    expect(result.description).toBe('Lots of spaces');
  });

  it('should sanitize HTML entities in title', async () => {
    const html = `
      <html>
        <head>
          <title>Test &amp; &lt;tag&gt;</title>
        </head>
        <body>Content</body>
      </html>
    `;

    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html
    });

    const result = await fetchMetadata(testUrl);
    expect(result.title).toBe('Test & <tag>');
  });
});
