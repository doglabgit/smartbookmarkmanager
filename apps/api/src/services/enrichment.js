const { PrismaClient } = require('@prisma/client');
const { fetchMetadata } = require('./metadata');
const { generateSummary, trackClaudeCall } = require('./claude');
const logger = require('../logger');
const { Sema: Semaphore } = require('async-sema');
const { enrichmentActive, enrichmentSuccessTotal, enrichmentFailureTotal } = require('../metrics');

// Limit concurrent enrichment jobs to prevent overwhelming DB/API
// Tune this value based on DB pool size and Claude rate limits
const ENRICHMENT_CONCURRENCY = parseInt(process.env.ENRICHMENT_CONCURRENCY || '10', 10);
const enrichmentSemaphore = new Semaphore(ENRICHMENT_CONCURRENCY);

const prisma = new PrismaClient();

async function enrichBookmark(bookmarkId) {
  // Track active jobs
  enrichmentActive.inc();

  // Acquire semaphore slot to limit concurrency
  await enrichmentSemaphore.acquire();

  try {
    logger.debug(`Enrichment started (concurrency: ${ENRICHMENT_CONCURRENCY})`, { bookmarkId });

    // 1. Fetch the bookmark from DB
    const bookmark = await prisma.bookmark.findUnique({
      where: { id: bookmarkId },
      include: {
        user: true
      }
    });

    if (!bookmark) {
      logger.error(`Bookmark ${bookmarkId} not found`, { bookmarkId });
      return;
    }

    logger.info(`Starting enrichment`, { bookmarkId, url: bookmark.url });

    // 2. Fetch metadata (title, description, favicon)
    const metadata = await fetchMetadata(bookmark.url);

    // 3. Generate AI summary if we have at least title or description AND a valid API key configured
    let aiSummary = null;
    const hasValidApiKey = process.env.CLAUDE_API_KEY &&
                           process.env.CLAUDE_API_KEY !== 'your-anthropic-api-key-here' &&
                           !process.env.CLAUDE_API_KEY.includes('your-');

    if (hasValidApiKey && (metadata.title || metadata.description)) {
      try {
        aiSummary = await generateSummary(
          bookmark.url,
          metadata.title || bookmark.title,
          metadata.description || bookmark.description
        );
      } catch (summaryError) {
        logger.warn(`Summary generation failed, continuing without AI`, { bookmarkId, error: summaryError.message });
        // Continue without summary - it's optional enrichment
      }
    } else if (process.env.CLAUDE_API_KEY && !hasValidApiKey) {
      logger.info(`Skipping AI summary - CLAUDE_API_KEY not set to a real key`, { bookmarkId });
    } else if (!process.env.CLAUDE_API_KEY) {
      logger.info(`Skipping AI summary - CLAUDE_API_KEY not configured`, { bookmarkId });
    }

    // 4. Update the bookmark with enriched data
    await prisma.bookmark.update({
      where: { id: bookmarkId },
      data: {
        ...(metadata.title && { title: metadata.title }),
        ...(metadata.description && { description: metadata.description }),
        ...(metadata.faviconUrl && { faviconUrl: metadata.faviconUrl }),
        ...(aiSummary && { aiSummary }),
        enrichedAt: new Date()
      }
    });

    logger.info(`Successfully enriched bookmark`, { bookmarkId });
    enrichmentSuccessTotal.inc();
  } catch (error) {
    logger.error(`Enrichment failed`, { bookmarkId, error: error.message, stack: error.stack });
    enrichmentFailureTotal.inc();
    throw error;
  } finally {
    enrichmentSemaphore.release();
    enrichmentActive.dec();
  }
}

module.exports = { enrichBookmark };
