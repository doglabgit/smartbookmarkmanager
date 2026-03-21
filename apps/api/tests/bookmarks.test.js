/**
 * Bookmark route tests
 *
 * Covers: list, get, create, update, delete with auth and validation
 */

const request = require('supertest');
const app = require('../index');
const { createTestUser, cleanupTestData } = require('./helpers');

const TEST_EMAIL = 'bookmark-test@example.com';
const TEST_PASSWORD = 'password123';

describe('Bookmark Routes', () => {
  let authCookie;
  let userId;

  beforeAll(async () => {
    await cleanupTestData();
    const user = await createTestUser(TEST_EMAIL, TEST_PASSWORD);
    userId = user.id;

    // Login to get cookie
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

    authCookie = loginRes.headers['set-cookie'];
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Clean bookmarks and tags before each test
    const { prisma } = require('./helpers');
    await prisma.bookmark.deleteMany({ where: { userId } });
    await prisma.tag.deleteMany({ where: { userId } });
  });

  describe('GET /api/bookmarks', () => {
    it('should return empty list when no bookmarks', async () => {
      const response = await request(app)
        .get('/api/bookmarks')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.data.bookmarks).toEqual([]);
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
      });
    });

    it('should return paginated bookmarks', async () => {
      const { prisma } = require('./helpers');
      // Create 25 bookmarks
      for (let i = 1; i <= 25; i++) {
        await prisma.bookmark.create({
          data: {
            userId,
            url: `https://example.com/bookmark-${i}`,
            title: `Bookmark ${i}`,
            description: `Description ${i}`
          }
        });
      }

      // Page 1 (default limit 20)
      const response = await request(app)
        .get('/api/bookmarks?page=1&limit=20')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.data.bookmarks).toHaveLength(20);
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 25,
        pages: 2
      });
    });

    it('should filter by search term', async () => {
      const { prisma } = require('./helpers');
      await prisma.bookmark.create({
        data: {
          userId,
          url: 'https://reactjs.org',
          title: 'React Documentation'
        }
      });
      await prisma.bookmark.create({
        data: {
          userId,
          url: 'https://vuejs.org',
          title: 'Vue Documentation'
        }
      });

      const response = await request(app)
        .get('/api/bookmarks?search=react')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.data.bookmarks).toHaveLength(1);
      expect(response.body.data.bookmarks[0].title).toBe('React Documentation');
    });

    it('should filter by tag', async () => {
      const { prisma } = require('./helpers');
      const tag = await prisma.tag.create({
        data: {
          userId,
          name: 'work'
        }
      });
      await prisma.bookmark.create({
        data: {
          userId,
          url: 'https://work.com',
          title: 'Work stuff',
          tags: { connect: [{ id: tag.id }] }
        }
      });
      await prisma.bookmark.create({
        data: {
          userId,
          url: 'https://personal.com',
          title: 'Personal stuff'
        }
      });

      const response = await request(app)
        .get('/api/bookmarks?tag=work')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.data.bookmarks).toHaveLength(1);
      expect(response.body.data.bookmarks[0].title).toBe('Work stuff');
    });

    it('should return 401 without auth', async () => {
      const response = await request(app)
        .get('/api/bookmarks')
        .expect(401);

      expect(response.body.error).toBe('No token provided');
    });
  });

  describe('GET /api/bookmarks/:id', () => {
    it('should return a specific bookmark', async () => {
      const { prisma } = require('./helpers');
      const bookmark = await prisma.bookmark.create({
        data: {
          userId,
          url: 'https://test.com',
          title: 'Test Bookmark',
          description: 'Test description'
        }
      });

      const response = await request(app)
        .get(`/api/bookmarks/${bookmark.id}`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.data.bookmark.id).toBe(bookmark.id);
      expect(response.body.data.bookmark.title).toBe('Test Bookmark');
    });

    it('should return 404 for non-existent bookmark', async () => {
      const response = await request(app)
        .get('/api/bookmarks/99999')
        .set('Cookie', authCookie)
        .expect(404);

      expect(response.body.error).toBe('Bookmark not found');
    });

    it('should return 404 for bookmark belonging to another user', async () => {
      const { prisma } = require('./helpers');
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          passwordHash: '$2a$10$dummyhash1234567890123456' // dummy
        }
      });
      const bookmark = await prisma.bookmark.create({
        data: {
          userId: otherUser.id,
          url: 'https://other.com',
          title: 'Other user bookmark'
        }
      });

      const response = await request(app)
        .get(`/api/bookmarks/${bookmark.id}`)
        .set('Cookie', authCookie)
        .expect(404);

      expect(response.body.error).toBe('Bookmark not found');
    });
  });

  describe('POST /api/bookmarks', () => {
    it('should create a bookmark successfully', async () => {
      const response = await request(app)
        .post('/api/bookmarks')
        .send({
          url: 'https://news.ycombinator.com',
          title: 'Hacker News',
          tags: ['tech', 'news']
        })
        .set('Cookie', authCookie)
        .expect(201);

      expect(response.body.data).toHaveProperty('bookmark');
      expect(response.body.data.bookmark.url).toBe('https://news.ycombinator.com');
      expect(response.body.data.bookmark.title).toBe('Hacker News');
      expect(response.body.data.bookmark.tags).toHaveLength(2);
      expect(response.body.data.message).toBe('Bookmark created. Enrichment pending.');
    });

    it('should create bookmark with empty tags array', async () => {
      const response = await request(app)
        .post('/api/bookmarks')
        .send({
          url: 'https://example.org',
          tags: []
        })
        .set('Cookie', authCookie)
        .expect(201);

      expect(response.body.data.bookmark.tags).toEqual([]);
    });

    it('should create bookmark without title/description', async () => {
      const response = await request(app)
        .post('/api/bookmarks')
        .send({
          url: 'https://example.org'
        })
        .set('Cookie', authCookie)
        .expect(201);

      expect(response.body.data.bookmark.title).toBeNull();
      expect(response.body.data.bookmark.description).toBeNull();
    });

    it('should return 400 if URL missing', async () => {
      const response = await request(app)
        .post('/api/bookmarks')
        .send({
          title: 'No URL'
        })
        .set('Cookie', authCookie)
        .expect(400);

      expect(response.body.error).toBe('URL is required');
    });

    it('should return 400 if URL invalid', async () => {
      const response = await request(app)
        .post('/api/bookmarks')
        .send({
          url: 'not a valid url'
        })
        .set('Cookie', authCookie)
        .expect(400);

      expect(response.body.error).toBe('Invalid URL format');
    });

    it('should normalize tag names to lowercase and trim', async () => {
      const { prisma } = require('./helpers');
      const response = await request(app)
        .post('/api/bookmarks')
        .send({
          url: 'https://example.org',
          tags: [' Work ', 'PERSONAL', '  MixEd  ']
        })
        .set('Cookie', authCookie)
        .expect(201);

      const tagNames = response.body.data.bookmark.tags.map(t => t.name).sort();
      expect(tagNames).toEqual(['mixed', 'personal', 'work']);

      // Verify in DB that tags are lowercased/trimmed
      const tags = await prisma.tag.findMany({
        where: { userId },
        orderBy: { name: 'asc' }
      });
      expect(tags.map(t => t.name)).toEqual(['mixed', 'personal', 'work']);
    });
  });

  describe('PATCH /api/bookmarks/:id', () => {
    it('should update bookmark title and description', async () => {
      const { prisma } = require('./helpers');
      const bookmark = await prisma.bookmark.create({
        data: {
          userId,
          url: 'https://original.com',
          title: 'Original Title'
        }
      });

      const response = await request(app)
        .patch(`/api/bookmarks/${bookmark.id}`)
        .send({
          title: 'Updated Title',
          description: 'New description'
        })
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.data.bookmark.title).toBe('Updated Title');
      expect(response.body.data.bookmark.description).toBe('New description');
    });

    it('should update tags', async () => {
      const { prisma } = require('./helpers');
      const tag1 = await prisma.tag.create({ data: { userId, name: 'tag1' } });
      const tag2 = await prisma.tag.create({ data: { userId, name: 'tag2' } });
      const bookmark = await prisma.bookmark.create({
        data: {
          userId,
          url: 'https://test.com',
          tags: { connect: [{ id: tag1.id }] }
        }
      });

      const response = await request(app)
        .patch(`/api/bookmarks/${bookmark.id}`)
        .send({
          tags: ['tag2', 'tag3']
        })
        .set('Cookie', authCookie)
        .expect(200);

      const tagNames = response.body.data.bookmark.tags.map(t => t.name).sort();
      expect(tagNames).toEqual(['tag2', 'tag3']);
    });

      it('should return 404 for non-existent bookmark', async () => {
        const response = await request(app)
          .patch('/api/bookmarks/99999')
          .send({ title: 'Update' })
          .set('Cookie', authCookie)
          .expect(404);

        expect(response.body.error).toBe('Bookmark not found');
      });

    it('should allow partial update (only title)', async () => {
      const { prisma } = require('./helpers');
      const bookmark = await prisma.bookmark.create({
        data: {
          userId,
          url: 'https://test.com',
          title: 'Original',
          description: 'Original desc'
        }
      });

      const response = await request(app)
        .patch(`/api/bookmarks/${bookmark.id}`)
        .send({ title: 'Title only updated' })
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.data.bookmark.title).toBe('Title only updated');
      expect(response.body.data.bookmark.description).toBe('Original desc');
    });
  });

  describe('DELETE /api/bookmarks/:id', () => {
    it('should delete a bookmark', async () => {
      const { prisma } = require('./helpers');
      const bookmark = await prisma.bookmark.create({
        data: {
          userId,
          url: 'https://todelete.com',
          title: 'To Delete'
        }
      });

      const response = await request(app)
        .delete(`/api/bookmarks/${bookmark.id}`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.data.message).toBe('Bookmark deleted');

      // Verify it's gone
      const getResponse = await request(app)
        .get(`/api/bookmarks/${bookmark.id}`)
        .set('Cookie', authCookie);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent bookmark', async () => {
      const response = await request(app)
        .delete('/api/bookmarks/99999')
        .set('Cookie', authCookie)
        .expect(404);

      expect(response.body.error).toBe('Bookmark not found');
    });
  });
});
