const cheerio = require('cheerio');
const { URL } = require('url');

// AbortController for timeout since native fetch doesn't have timeout option
function fetchWithTimeout(url, options = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'SmartBookmarkManager/1.0',
        ...options.headers
      }
    })
      .then(res => resolve(res))
      .catch(err => reject(err))
      .finally(() => clearTimeout(timeoutId));
  });
}

async function fetchMetadata(url) {
  try {
    // Validate URL
    const parsedUrl = new URL(url);

    // Fetch the page with browser-like headers to avoid being blocked
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
      }
    }, 15000); // 15 second timeout

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract metadata
    let title = $('title').text().trim() ||
                $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                '';

    let description = $('meta[name="description"]').attr('content') ||
                      $('meta[property="og:description"]').attr('content') ||
                      $('meta[name="twitter:description"]').attr('content') ||
                      '';

    // Get favicon
    let faviconUrl = $('link[rel="icon"]').attr('href') ||
                     $('link[rel="shortcut icon"]').attr('href') ||
                     $('link[rel="apple-touch-icon"]').attr('href');

    if (faviconUrl && !faviconUrl.startsWith('http')) {
      // Resolve relative URL
      faviconUrl = new URL(faviconUrl, parsedUrl.origin).href;
    } else if (!faviconUrl) {
      // Default favicon
      faviconUrl = `${parsedUrl.origin}/favicon.ico`;
    }

    // Clean up whitespace
    title = title.replace(/\s+/g, ' ').trim();
    description = description.replace(/\s+/g, ' ').trim();

    return {
      title: title || null,
      description: description || null,
      faviconUrl: faviconUrl || null
    };
  } catch (error) {
    console.error(`Metadata fetch error for ${url}:`, error.message);
    return {
      title: null,
      description: null,
      faviconUrl: null
    };
  }
}

module.exports = { fetchMetadata };
