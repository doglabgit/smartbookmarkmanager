const cheerio = require('cheerio');
const { URL } = require('url');
const dns = require('dns');
const ipaddr = require('ipaddr.js');
const logger = require('../logger');

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

/**
 * Check if a hostname/IP resolves to a private/internal address
 * Prevents SSRF attacks targeting localhost, private networks, or link-local addresses
 */
async function isPrivateIp(hostname) {
  // First check if hostname itself is a private IP
  try {
    const addr = ipaddr.parse(hostname);
    if (addr.range() === 'private' || addr.range() === 'loopback' || addr.range() === 'link-local') {
      return true;
    }
    return false;
  } catch {
    // Not an IP, need to do DNS resolution
  }

  // Resolve hostname to IP addresses
  try {
    const addresses = await dns.promises.lookup(hostname, { family: 0 }); // 0 = both IPv4 and IPv6
    const addr = ipaddr.parse(addresses.address);
    if (addr.range() === 'private' || addr.range() === 'loopback' || addr.range() === 'link-local') {
      return true;
    }
    return false;
  } catch (error) {
    // DNS resolution failed — treat as suspect but not necessarily private
    logger.warn('DNS resolution failed for SSRF check', { hostname, error: error.message });
    return false;
  }
}

async function fetchMetadata(url) {
  try {
    // Validate URL
    const parsedUrl = new URL(url);

    // SSRF Protection: block private IP ranges and localhost
    // Check hostname directly for loopback names
    const blockedHostnames = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'];
    if (blockedHostnames.includes(parsedUrl.hostname)) {
      throw new Error('URL points to blocked host');
    }

    // Check if hostname resolves to a private IP
    if (await isPrivateIp(parsedUrl.hostname)) {
      throw new Error('URL points to private IP address (SSRF protection)');
    }

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
    logger.warn(`Metadata fetch failed`, { url, error: error.message });
    return {
      title: null,
      description: null,
      faviconUrl: null
    };
  }
}

module.exports = { fetchMetadata };
