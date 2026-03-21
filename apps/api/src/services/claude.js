const logger = require('../logger');
const { claudeApiCallsTotal } = require('../metrics');

// Native fetch with AbortController for timeout
function fetchWithTimeout(url, options = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    fetch(url, {
      ...options,
      signal: controller.signal
    })
      .then(res => resolve(res))
      .catch(err => reject(err))
      .finally(() => clearTimeout(timeoutId));
  });
}

async function generateSummary(url, title, description) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY not configured');
  }

  // Track Claude API call attempt
  claudeApiCallsTotal.inc();

  const content = `
URL: ${url}
Title: ${title || 'N/A'}
Description: ${description || 'N/A'}

Based on the above information, provide a concise 2-3 sentence summary of what this webpage is about.
Focus on the key topics, purpose, or value proposition.
If the information is insufficient, respond with "Insufficient information to generate a summary."
  `.trim();

  try {
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022', // Cost-efficient model
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: content
          }
        ],
        temperature: 0.3
      })
    }, 10000);

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Claude API error', { url, status: response.status, errorData });
      throw new Error(`Claude API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.content && data.content.length > 0) {
      return data.content[0].text.trim();
    }

    return 'No summary generated';
  } catch (error) {
    logger.error('Claude summary error', { url, error: error.message });
    throw error;
  }
}

module.exports = { generateSummary };
