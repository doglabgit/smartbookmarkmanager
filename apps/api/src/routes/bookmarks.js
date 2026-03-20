const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

// Helper to trigger background enrichment
async function triggerEnrichment(bookmarkId) {
  try {
    // Import dynamically to avoid circular dependencies
    const { enrichBookmark } = require('../services/enrichment');
    await enrichBookmark(bookmarkId);
  } catch (error) {
    console.error(`Background enrichment failed for bookmark ${bookmarkId}:`, error);
  }
}

// GET /api/bookmarks - List all bookmarks for the user
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, tag } = req.query;

    const where = {
      userId: req.user.id,
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { url: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(tag && {
        tags: {
          some: { name: tag }
        }
      })
    };

    const [bookmarks, total] = await Promise.all([
      prisma.bookmark.findMany({
        where,
        include: {
          tags: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: Number(limit)
      }),
      prisma.bookmark.count({ where })
    ]);

    res.status(200).json({
      data: {
        bookmarks,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/bookmarks/:id - Get a single bookmark
router.get('/:id', async (req, res) => {
  try {
    const bookmark = await prisma.bookmark.findFirst({
      where: {
        id: Number(req.params.id),
        userId: req.user.id
      },
      include: {
        tags: true
      }
    });

    if (!bookmark) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }

    res.status(200).json({ data: { bookmark } });
  } catch (error) {
    console.error('Get bookmark error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/bookmarks - Create a new bookmark
router.post('/', async (req, res) => {
  try {
    const { url, title, description, faviconUrl, tags: tagNames } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Create or get tags
    let tags = [];
    if (tagNames && Array.isArray(tagNames)) {
      tags = await Promise.all(
        tagNames.map(async (name) => {
          const normalizedName = name.toLowerCase().trim();
          return prisma.tag.upsert({
            where: {
              userId_name: {
                userId: req.user.id,
                name: normalizedName
              }
            },
            update: {},
            create: {
              userId: req.user.id,
              name: normalizedName
            }
          });
        })
      );
    }

    // Create bookmark
    const bookmark = await prisma.bookmark.create({
      data: {
        userId: req.user.id,
        url,
        title: title || null,
        description: description || null,
        faviconUrl: faviconUrl || null,
        tags: {
          connect: tags.map(tag => ({ id: tag.id }))
        }
      },
      include: {
        tags: true
      }
    });

    res.status(201).json({
      data: {
        bookmark,
        message: 'Bookmark created. Enrichment pending.'
      }
    });

    // Trigger background enrichment (fire and forget)
    process.nextTick(() => triggerEnrichment(bookmark.id));
  } catch (error) {
    console.error('Create bookmark error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/bookmarks/:id - Update a bookmark
router.patch('/:id', async (req, res) => {
  try {
    const { title, description, faviconUrl, tags: tagNames } = req.body;

    // Check bookmark exists and belongs to user
    const existing = await prisma.bookmark.findFirst({
      where: {
        id: Number(req.params.id),
        userId: req.user.id
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }

    // Update tags if provided
    let tagConnections = [];
    if (tagNames && Array.isArray(tagNames)) {
      const tags = await Promise.all(
        tagNames.map(async (name) => {
          const normalizedName = name.toLowerCase().trim();
          return prisma.tag.upsert({
            where: {
              userId_name: {
                userId: req.user.id,
                name: normalizedName
              }
            },
            update: {},
            create: {
              userId: req.user.id,
              name: normalizedName
            }
          });
        })
      );
      tagConnections = tags.map(tag => ({ id: tag.id }));
    }

    // Build update data
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (faviconUrl !== undefined) updateData.faviconUrl = faviconUrl;
    if (tagConnections.length > 0) {
      updateData.tags = {
        set: [],
        connect: tagConnections
      };
    }

    const bookmark = await prisma.bookmark.update({
      where: { id: Number(req.params.id) },
      data: updateData,
      include: {
        tags: true
      }
    });

    res.status(200).json({
      data: {
        bookmark,
        message: 'Bookmark updated'
      }
    });
  } catch (error) {
    console.error('Update bookmark error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/bookmarks/:id - Delete a bookmark
router.delete('/:id', async (req, res) => {
  try {
    // Check bookmark exists and belongs to user
    const existing = await prisma.bookmark.findFirst({
      where: {
        id: Number(req.params.id),
        userId: req.user.id
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }

    await prisma.bookmark.delete({
      where: { id: Number(req.params.id) }
    });

    res.status(200).json({
      data: {
        message: 'Bookmark deleted'
      }
    });
  } catch (error) {
    console.error('Delete bookmark error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
