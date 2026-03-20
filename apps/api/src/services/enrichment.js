const { PrismaClient } = require('@prisma/client');
const { fetchMetadata } = require('./metadata');
const { generateSummary } = require('./claude');

const prisma = new PrismaClient();

async function enrichBookmark(bookmarkId) {
  try {
    // 1. Fetch the bookmark from DB
    const bookmark = await prisma.bookmark.findUnique({
      where: { id: bookmarkId },
      include: {
        user: true
      }
    });

    if (!bookmark) {
      console.error(`Bookmark ${bookmarkId} not found`);
      return;
    }

    console.log(`Enriching bookmark ${bookmarkId}: ${bookmark.url}`);

    // 2. Fetch metadata (title, description, favicon)
    const metadata = await fetchMetadata(bookmark.url);

    // 3. Generate AI summary if we have at least title or description AND API key configured
    let aiSummary = null;
    if (process.env.CLAUDE_API_KEY && (metadata.title || metadata.description)) {
      try {
        aiSummary = await generateSummary(
          bookmark.url,
          metadata.title || bookmark.title,
          metadata.description || bookmark.description
        );
      } catch (summaryError) {
        console.error(`Summary generation failed for ${bookmarkId}:`, summaryError.message);
        // Continue without summary - it's optional enrichment
      }
    } else if (!process.env.CLAUDE_API_KEY) {
      console.log(`Skipping AI summary for ${bookmarkId} - CLAUDE_API_KEY not configured`);
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

    console.log(`Successfully enriched bookmark ${bookmarkId}`);
  } catch (error) {
    console.error(`Enrichment failed for bookmark ${bookmarkId}:`, error);
    throw error;
  }
}

module.exports = { enrichBookmark };
