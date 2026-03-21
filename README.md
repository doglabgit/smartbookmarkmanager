# Smart Bookmark Manager

A full-stack web application for managing bookmarks with automatic metadata enrichment and AI-powered summaries.

> 📖 **[User Guide](USER_GUIDE.md)** - Comprehensive documentation for end users

## Features

- Save and organize bookmarks with tags
- Automatic metadata extraction (title, description, favicon)
- AI-generated summaries using Claude (requires API key)
- Search and filter by tag
- Clean, responsive UI with dark mode toggle
- JWT-based authentication
- Implemented with custom design system (Helvetica Neue, JetBrains Mono, indigo primary)

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL with Prisma ORM
- **AI**: Claude API (claude-3-5-haiku)
- **Auth**: JWT stored in httpOnly cookies

## Project Structure

```
/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Express backend
├── packages/
│   └── shared/       # Shared TypeScript types (for future use)
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Claude API key from [Anthropic Console](https://console.anthropic.com/)

### Setup

1. **Clone and install dependencies**

   ```bash
   npm install
   ```

2. **Set up the database**

   ```bash
   # Create a PostgreSQL database
   createdb bookmarkdb

   # Configure database URL in apps/api/.env
   cd apps/api
   cp .env.example .env
   # Edit .env with your DATABASE_URL
   ```

3. **Generate Prisma client and run migrations**

   ```bash
   cd apps/api
   npx prisma generate

   # For development: use migrate dev (interactive, creates new migration)
   npx prisma migrate dev --name init

   # For production: use migrate deploy (runs existing migrations only, no prompt)
   # npx prisma migrate deploy
   ```

4. **Configure environment variables**

   Edit `apps/api/.env`:

   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/bookmarkdb?schema=public"
   JWT_SECRET="your-super-secret-jwt-key-change-this"
   # CLAUDE_API_KEY is optional - set it to enable AI summaries
   # Get your key from https://console.anthropic.com/
   ```

5. **Start the development servers**

   ```bash
   # From project root - runs both frontend and backend
   npm run dev

   # Or separately:
   # Terminal 1: npm run dev:api
   # Terminal 2: npm run dev:web
   ```

6. **Open the app**

   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3000
   - The frontend proxies `/api/*` requests to the backend

7. **Create your first account**

   - Go to http://localhost:3001/register
   - Create an account
   - Start adding bookmarks!

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Bookmarks (authenticated)

- `GET /api/bookmarks` - List bookmarks (filterable with `?search=query&tag=tagname`). **Rate limited: 300 req/min per user**
- `GET /api/bookmarks/tags` - Get distinct tag names (for filter dropdown). **Rate limited: 300 req/min per user**
- `GET /api/bookmarks/:id` - Get single bookmark
- `POST /api/bookmarks` - Create bookmark. **Rate limited: 30 req/min per user**
- `PATCH /api/bookmarks/:id` - Update bookmark
- `DELETE /api/bookmarks/:id` - Delete bookmark

## Enrichment Flow

1. User creates a bookmark with just a URL
2. Backend immediately responds with the saved bookmark
3. Asynchronous enrichment process starts:
   - Fetches webpage and extracts metadata (title, description, favicon)
   - If Claude API key is configured, generates an AI summary
   - Bookmark is updated with enriched data (non-blocking)
4. AI summaries are optional — the app works without a Claude API key

## Architecture Notes

- All Claude API calls go through `apps/api/src/services/claude.js` - do not call Claude directly elsewhere
- Enrichment is fire-and-forget - the POST response is never blocked
- Favicon fetching is best-effort (fail silently on errors)
- All API responses follow `{ data, error }` shape
- Strict TypeScript mode is enforced

## Development Commands

```bash
# Run both dev servers
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Database migrations
cd apps/api && npx prisma migrate dev

# Reset database
cd apps/api && npx prisma migrate reset
```

## Deployment

### Quick Deploy (3-5 minutes)

This application is production-ready and can be deployed to any Node.js + PostgreSQL hosting provider.

#### Option 1: Railway (Recommended for Beginners)

**Backend (API)**:
1. Create a new Railway service from your GitHub repo
2. Add a PostgreSQL plugin (creates `DATABASE_URL` automatically)
3. Set environment variables:
   - `JWT_SECRET` (generate: `openssl rand -base64 32`)
   - `ALLOWED_ORIGINS` = your frontend URL (e.g., `https://your-app.vercel.app`)
   - `NODE_ENV=production`
   - Optional: `CLAUDE_API_KEY` for AI summaries
4. Railway automatically builds and deploys
5. After deploy, run migrations in Railway Shell:
   ```bash
   cd /app
   npx prisma migrate deploy
   ```

**Frontend**:
- Deploy to Vercel (automatic from GitHub)
- Set `NEXT_PUBLIC_API_URL` to your Railway backend URL
- No other configuration needed

#### Option 2: Render

**Backend**:
1. Create a new Web Service
2. Build Command: `npm install && npx prisma generate && npx prisma migrate deploy`
3. Start Command: `npm start`
4. Set environment variables (same as Railway)
5. Add PostgreSQL database (set `DATABASE_URL`)

**Frontend**:
1. Create a new Static Site
2. Build Command: `npm run build`
3. Publish Directory: `.next`
4. Set `NEXT_PUBLIC_API_URL`

#### Option 3: Docker (Any Provider)

```bash
# Build images locally
cd apps/api && docker build -t smartbookmark-api .
cd ../web && docker build -t smartbookmark-frontend .

# Push to registry
docker push yourusername/smartbookmark-api
docker push yourusername/smartbookmark-frontend
```

Then deploy using your platform's Docker support (Kubernetes, ECS, etc.)

### Environment Variables for Production

**Required:**
```env
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
JWT_SECRET="your-32+char-random-secret-here"
```

**Recommended:**
```env
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS="https://your-frontend.com,https://staging.your-site.com"
ENRICHMENT_CONCURRENCY=10  # Tune based on DB pool size
```

**Optional:**
```env
CLAUDE_API_KEY="sk-ant-..."  # Enable AI summaries
REDIS_URL="redis://..."       # For distributed rate limiting (multi-instance)
```

⚠️ **Critical Security Notes:**
- **Never use `*` for `ALLOWED_ORIGINS`** when using cookies (credentials). Set exact frontend URLs.
- `JWT_SECRET` must be at least 32 random characters. Change from default!
- Always use HTTPS in production (set `secure: true` cookies automatically via `NODE_ENV=production`)

### Database Migrations

Migrations are included in the Docker image. On first deploy:

```bash
# Via platform shell (Railway, Render, etc.)
npx prisma migrate deploy
```

For existing databases with data, indexes are created concurrently to avoid locks (see `migrations/*/migration.sql`).

### Performance Optimizations

The application includes:
- **Database indexes** on `Bookmark(userId, createdAt)`, `Bookmark(userId, enrichedAt)`, and `Tag(name)` for fast queries
- **Connection pooling** via Prisma (default 5 connections)
- **Rate limiting** (30 creations/min, 300 reads/min per user)
- **Response compression** (gzip)
- **Concurrency control** for enrichment jobs (default 10 parallel)

### Health Checks & Monitoring

**Health Endpoint**: `GET /healthz`
- Returns 200 only if database is reachable
- Used by load balancers and uptime monitors

**Metrics Endpoint**: `GET /metrics` (Prometheus format)
- Request rates, latencies, error counts
- Enrichment job metrics (active, success, failure)
- Claude API call counters

**Logs**:
- JSON structured logs with request IDs
- Daily rotation (14 days)
- Separate error log in production

See [BACKUPS_MONITORING.md](BACKUPS_MONITORING.md) for complete monitoring setup and alerting rules.

## Database Schema

```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  passwordHash String
  createdAt DateTime @default(now())
  bookmarks Bookmark[]
  tags      Tag[]
}

model Bookmark {
  id          Int      @id @default(autoincrement())
  userId      Int
  url         String
  title       String?
  description String?
  faviconUrl  String?
  aiSummary   String?
  createdAt   DateTime @default(now())
  enrichedAt  DateTime?
  user        User     @relation(fields: [userId], references: [id])
  tags        Tag[]
}

model Tag {
  id        Int      @id @default(autoincrement())
  userId    Int
  name      String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  bookmarks Bookmark[]

  @@unique([userId, name])
  @@index([userId])
  @@index([name])  // For tag lookup performance
}
```

**Performance Indexes** (added in production):
- `Bookmark(userId, createdAt)` – Fast pagination and user-specific queries
- `Bookmark(userId, enrichedAt)` – Efficient enrichment cleanup and monitoring
- `Tag(name)` – Quick tag search and dropdown population

## Future Enhancements

- Bulk operations (delete multiple bookmarks)
- Bookmark export/import (HTML, JSON)
- Shareable bookmark collections
- Browser extension
- Advanced search (full-text, date ranges)
- Tag management UI (rename, merge, delete)
- OAuth support (Google, GitHub)
- Email digest of recent bookmarks

## Production Operations

### Monitoring & Alerting

See [BACKUPS_MONITORING.md](BACKUPS_MONITORING.md) for:
- Health check setup
- Prometheus metrics interpretation
- Recommended alerting rules
- Logging configuration
- Disaster recovery runbook

### Backups

Automated daily backups are **required** for production deployments.
See [BACKUPS_MONITORING.md](BACKUPS_MONITORING.md) for backup strategies and restore procedures.

## License

MIT
