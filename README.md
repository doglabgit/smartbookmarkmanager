# Smart Bookmark Manager

A full-stack web application for managing bookmarks with automatic metadata enrichment and AI-powered summaries.

> 📖 **[User Guide](USER_GUIDE.md)** - Comprehensive documentation for end users

## Features

- Save and organize bookmarks with tags
- Automatic metadata extraction (title, description, favicon)
- AI-generated summaries using Claude (requires API key)
- Search and filter by tag
- Clean, responsive UI
- JWT-based authentication

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

- `GET /api/bookmarks` - List bookmarks (filterable with `?search=query&tag=tagname`)
- `GET /api/bookmarks/:id` - Get single bookmark
- `POST /api/bookmarks` - Create bookmark
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

### Recommended Setup

- **Frontend**: Vercel (automatic Next.js deployment)
- **Backend + Database**: Railway (or any Postgres provider)

### Environment Variables for Production

**Vercel (Frontend)**

- No special vars needed (proxies configured in `next.config.js`)

**Railway (Backend)**

- `DATABASE_URL` (provided by Railway Postgres plugin)
- `JWT_SECRET` (set a strong random secret, **required**, at least 32 characters)
- `CLAUDE_API_KEY` (your Anthropic API key, **optional** — without it, AI summaries are disabled)
- `ALLOWED_ORIGINS` (comma-separated list of frontend URLs that are allowed to make authenticated requests; **do not use `*`** when credentials (cookies) are enabled; e.g., `https://your-app.vercel.app,https://your-app.netlify.app`)

### Important Production Considerations

- Set `NODE_ENV=production` on the backend
- Update `JWT_SECRET` to a strong random value (at least 32 chars)
- Set `ALLOWED_ORIGINS` to your frontend URL(s). Do **not** use `*` when credentials (cookies) are enabled.
- Railway's free tier sleeps after inactivity - handle cold starts gracefully on the frontend with loading states
- **After initial deploy**, run `npx prisma migrate deploy` to apply database migrations (connect via API service shell in Render dashboard)

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
}
```

## Future Enhancements

- Bulk operations (delete multiple bookmarks)
- Bookmark export/import (HTML, JSON)
- Shareable bookmark collections
- Browser extension
- Advanced search (full-text, date ranges)
- Tag management UI (rename, merge, delete)
- OAuth support (Google, GitHub)
- Email digest of recent bookmarks

## License

MIT
