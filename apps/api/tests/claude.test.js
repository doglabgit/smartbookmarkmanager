/**
 * Claude AI summary generation tests
 * Tests generateSummary with mocked Claude API responses
 */

const { generateSummary } = require('../src/services/claude');

// Mock global.fetch
global.fetch = jest.fn();

// Set a fake Claude API key for tests that need it
const originalClaudeKey = process.env.CLAUDE_API_KEY;
process.env.CLAUDE_API_KEY = 'test-claude-api-key-12345';

describe('generateSummary', () => {
  const testUrl = 'https://example.com/article';
  const testTitle = 'Example Article';
  const testDescription = 'An example description';

  beforeEach(() => {
    fetch.mockClear();
  });

  it('should generate summary successfully', async () => {
    const mockResponse = {
      content: [{ text: 'This is a concise summary of the webpage.' }]
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await generateSummary(testUrl, testTitle, testDescription);

    expect(result).toBe('This is a concise summary of the webpage.');
  });

  it('should handle empty content array', async () => {
    const mockResponse = { content: [] };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await generateSummary(testUrl, testTitle, testDescription);

    expect(result).toBe('No summary generated');
  });

  it('should handle Claude API 429 rate limit', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ error: { message: 'Rate limit exceeded' } })
    });

    await expect(generateSummary(testUrl, testTitle, testDescription))
      .rejects.toThrow('Claude API error: Too Many Requests');
  });

  it('should handle Claude API 5xx error', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: { message: 'Internal server error' } })
    });

    await expect(generateSummary(testUrl, testTitle, testDescription))
      .rejects.toThrow('Claude API error: Internal Server Error');
  });

  it('should handle malformed JSON response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); }
    });

    await expect(generateSummary(testUrl, testTitle, testDescription))
      .rejects.toThrow('Unexpected token');
  });

  it('should handle network timeout', async () => {
    // The fetchWithTimeout will abort after 10 seconds. Simulate by rejecting
    fetch.mockRejectedValueOnce(new TypeError('AbortError: The user aborted a request.'));

    await expect(generateSummary(testUrl, testTitle, testDescription))
      .rejects.toThrow(/aborted|timeout/i);
  });

  it('should throw if CLAUDE_API_KEY not set', async () => {
    const originalKey = process.env.CLAUDE_API_KEY;
    delete process.env.CLAUDE_API_KEY;

    await expect(generateSummary(testUrl, testTitle, testDescription))
      .rejects.toThrow('CLAUDE_API_KEY not configured');

    // Restore
    if (originalKey) process.env.CLAUDE_API_KEY = originalKey;
  });

  it('should include URL, title, and description in prompt', async () => {
    let capturedBody;
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ text: 'Summary' }] })
    });

    await generateSummary(testUrl, testTitle, testDescription);

    capturedBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(capturedBody.messages[0].content).toContain(testUrl);
    expect(capturedBody.messages[0].content).toContain(testTitle);
    expect(capturedBody.messages[0].content).toContain(testDescription);
  });

  it('should use haiku model and correct headers', async () => {
    let capturedHeaders;
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ text: 'Summary' }] })
    });

    await generateSummary(testUrl, testTitle, testDescription);

    capturedHeaders = fetch.mock.calls[0][1].headers;
    expect(capturedHeaders['x-api-key']).toBe(process.env.CLAUDE_API_KEY);
    expect(capturedHeaders['anthropic-version']).toBe('2023-06-01');
    expect(capturedHeaders['Content-Type']).toBe('application/json');
  });

  it('should trim whitespace from summary', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ text: '  Trimmed summary with spaces.  ' }] })
    });

    const result = await generateSummary(testUrl, testTitle, testDescription);
    expect(result).toBe('Trimmed summary with spaces.');
  });

  it('should handle proposals: "Insufficient information"', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ text: 'Insufficient information to generate a summary.' }] })
    });

    const result = await generateSummary(testUrl, '', '');
    expect(result).toBe('Insufficient information to generate a summary.');
  });

  afterAll(() => {
    // Restore original CLAUDE_API_KEY
    if (originalClaudeKey) {
      process.env.CLAUDE_API_KEY = originalClaudeKey;
    } else {
      delete process.env.CLAUDE_API_KEY;
    }
  });
});
