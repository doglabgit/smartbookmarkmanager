# CLAUDE.md

This file provides context about the Smart Bookmark Manager project to Claude Code.

## Project Summary

Smart Bookmark Manager is a full-stack bookmarking app with AI-powered summaries.
Users save URLs and get automatic metadata enrichment (title, description, favicon)
plus a Claude-generated AI summary. Can search and filter by tags.

## Tech Stack

- Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS
- Backend: Node.js + Express REST API
- Database: PostgreSQL via Prisma ORM
- AI: Claude API (claude-3-5-haiku)

## Architecture

- Monorepo structure using npm workspaces
- Frontend on port 3001 (Next.js dev)
- Backend on port 3000 (Express)
- Next.js config has rewrites to proxy `/api/*` to the backend
- Auth: JWT stored in httpOnly cookies
- Enrichment: Fire-and-forget async job after bookmark creation

## Code Conventions

- Use named exports only, no default exports
- Prefer `async/await` over `.then()` chains
- All API responses follow `{ data, error }` shape
- TypeScript strict mode is on — no `any` types
- Use Prisma for all DB queries, never raw SQL
- Tailwind only for styling, no inline styles or CSS modules

## Key Paths

- Frontend pages: `apps/web/src/app/`
- API routes: `apps/api/src/routes/`
- Auth middleware: `apps/api/src/middleware/auth.js`
- Enrichment service: `apps/api/src/services/enrichment.js`
- Metadata fetcher: `apps/api/src/services/metadata.js`
- Claude service: `apps/api/src/services/claude.js`
- Prisma schema: `apps/api/schema.prisma`

## Common Gotchas

- Always validate and sanitize URLs before fetching metadata (URL constructor)
- Favicon fetching often fails — fail silently and leave `favicon_url` null
- Claude API calls must include a timeout (10s max) — wrap in try/catch
- Never block the POST /bookmarks response — enrichment runs asynchronously

## Build Order

Follow this sequence when implementing:

1. DB schema + Prisma setup
2. Auth routes (register, login, /me)
3. Bookmark CRUD routes (no enrichment yet)
4. Enrichment service (metadata fetch + Claude summary)
5. Background job wiring (call enrichment after bookmark save)
6. Frontend auth pages (login, register)
7. Frontend bookmark list + add form
8. Frontend tag filtering + search
9. Polish: loading states, error handling, empty states

## Security Notes

- All Claude API calls are server-side only
- JWT secret must be strong and kept secret in production
- Auth middleware validates tokens on protected routes
- URLs are validated with URL constructor before processing
- httpOnly cookies prevent XSS token theft

## Development Workflow

```bash
# Install deps
npm install

# Run both dev servers
npm run dev

# DB migrations
cd apps/api && npx prisma migrate dev

# Generate Prisma client after schema changes
cd apps/api && npx prisma generate
```

## Do NOT

- Do not add Redis, queues, or worker processes — keep enrichment simple
- Do not add social features (sharing, public profiles)
- Do not use GraphQL
- Do not install new heavy dependencies without flagging it first
- Do not call Claude API from anywhere except `apps/api/src/services/claude.js`
