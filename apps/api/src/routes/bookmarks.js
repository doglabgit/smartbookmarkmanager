const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { bookmarkCreateSchema, bookmarkUpdateSchema } = require('../../validation/schemas');
const prisma = require('../database');
const router = express.Router();

// Rate limit bookmark creation: 30 per minute per user ID
// Disable in test environment to avoid interfering with tests
const createBookmarkRateLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : createRateLimiter({
      windowMs: 60 * 1000,
      max: 30,
      keyGenerator: (req) => req.user?.id || 'anonymous',
      message: 'Too many bookmark creations. Please slow down.'
    });

// Rate limit bookmark reads: 300 per minute per user ID (generous, but prevents abuse)
// Disable in test environment
const readBookmarksRateLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : createRateLimiter({
      windowMs: 60 * 1000,
      max: 300,
      keyGenerator: (req) => req.user?.id || 'anonymous',
      message: 'Too many requests. Please slow down.'
    });

// Helper to trigger background enrichment
const logger = require('../logger');

async function triggerEnrichment(bookmarkId) {
  try {
    // Import dynamically to avoid circular dependencies
    const { enrichBookmark } = require('../services/enrichment');
    await enrichBookmark(bookmarkId);
  } catch (error) {
    logger.error(`Background enrichment failed for bookmark ${bookmarkId}`, { error, bookmarkId });
  }
}

// GET /api/bookmarks/tags - Get distinct tag names for the user
router.get('/tags', authMiddleware, asyncHandler(async (req, res) => {
  const tags = await prisma.tag.findMany({
    where: { userId: req.user.id },
    distinct: ['name'],
    select: { name: true }
  });
  const tagNames = tags.map(t => t.name).sort();
  res.status(200).json({ data: { tags: tagNames } });
}));

// GET /api/bookmarks - List all bookmarks for the user
router.get('/', readBookmarksRateLimiter, asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  let limit = parseInt(req.query.limit, 10) || 20;
  const MAX_LIMIT = 100;
  if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }
  const { search, tag } = req.query;

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
}));

// GET /api/bookmarks/:id - Get a single bookmark
router.get('/:id', asyncHandler(async (req, res) => {
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
}));

// POST /api/bookmarks - Create a new bookmark
router.post('/',
  createBookmarkRateLimiter,
  // Pre-validation: check required fields
  (req, res, next) => {
    if (!req.body.url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    next();
  },
  validate(bookmarkCreateSchema),
  asyncHandler(async (req, res) => {
    const { url, title, description, faviconUrl, tags: tagNames } = req.body;

    // Create or get tags (tagNames already normalized by Zod schema: lowercase, trimmed)
    let tags = [];
    if (tagNames && Array.isArray(tagNames)) {
      tags = await Promise.all(
        tagNames.map(async (name) => {
          return prisma.tag.upsert({
            where: {
              userId_name: {
                userId: req.user.id,
                name: name
              }
            },
            update: {},
            create: {
              userId: req.user.id,
              name: name
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
  })
);

// PATCH /api/bookmarks/:id - Update a bookmark
router.patch('/:id', validate(bookmarkUpdateSchema), asyncHandler(async (req, res) => {
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

  // Update tags if provided (tagNames already normalized by Zod)
  let tagConnections = [];
  if (tagNames && Array.isArray(tagNames)) {
    const tags = await Promise.all(
      tagNames.map(async (name) => {
        return prisma.tag.upsert({
          where: {
            userId_name: {
              userId: req.user.id,
              name: name
            }
          },
          update: {},
          create: {
            userId: req.user.id,
            name: name
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
}));

// DELETE /api/bookmarks/:id - Delete a bookmark
router.delete('/:id', asyncHandler(async (req, res) => {
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
}));

module.exports = router;
module.exports.triggerEnrichment = triggerEnrichment;
