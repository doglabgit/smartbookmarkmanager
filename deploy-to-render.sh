#!/bin/bash
set -e

# Render Automated Deployment Script
# Usage: ./deploy-to-render.sh

# Configuration
REPO="doglabgit/smartbookmarkmanager"
BRANCH="main"
REGION="oregon"  # or "iowa", "frankfurt", etc.
SERVICE_PLAN="free"

# Require API key
if [ -z "$RENDER_API_KEY" ]; then
  echo "ERROR: RENDER_API_KEY environment variable not set"
  echo "Get it from: Render Dashboard → Account → API Keys"
  exit 1
fi

API_BASE="https://api.render.com/v1"

echo "🚀 Starting Render deployment..."

# 1. Create PostgreSQL Database
echo "📦 Creating PostgreSQL database..."
DB_RESPONSE=$(curl -s -X POST "$API_BASE/databases" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"postgres\",
    \"name\": \"smartbookmark-db\",
    \"plan\": \"$SERVICE_PLAN\"
  }")

DB_ID=$(echo "$DB_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$DB_ID" ]; then
  echo "Failed to create database. Response: $DB_RESPONSE"
  exit 1
fi
echo "✅ Database created (ID: $DB_ID). Waiting for connection string..."

# Wait for DB to be ready and get connection string
sleep 30
DB_INFO=$(curl -s -X GET "$API_BASE/databases/$DB_ID" \
  -H "Authorization: Bearer $RENDER_API_KEY")
DATABASE_URL=$(echo "$DB_INFO" | grep -o '"connectionString":"[^"]*"' | head -1 | sed 's/.*:"//;s/".*//')
if [ -z "$DATABASE_URL" ]; then
  echo "Could not get DATABASE_URL. Waiting a bit more..."
  sleep 30
  DB_INFO=$(curl -s -X GET "$API_BASE/databases/$DB_ID" \
    -H "Authorization: Bearer $RENDER_API_KEY")
  DATABASE_URL=$(echo "$DB_INFO" | grep -o '"connectionString":"[^"]*"' | head -1 | sed 's/.*:"//;s/".*//')
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: Could not retrieve DATABASE_URL"
  exit 1
fi
echo "✅ Got DATABASE_URL (truncated): ${DATABASE_URL:0:50}..."

# 2. Create API Service
echo "🔧 Creating API service..."
SERVICE_NAME="smartbookmark-api"
API_RESPONSE=$(curl -s -X POST "$API_BASE/services" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"web\",
    \"name\": \"$SERVICE_NAME\",
    \"env\": \"docker\",
    \"dockerfilePath\": \"apps/api/Dockerfile\",
    \"plan\": \"$SERVICE_PLAN\",
    \"branch\": \"$BRANCH\",
    \"repo\": \"$REPO\",
    \"region\": \"$REGION\",
    \"envVars\": [
      {\"key\": \"NODE_ENV\", \"value\": \"production\"},
      {\"key\": \"PORT\", \"value\": \"3000\"},
      {\"key\": \"DATABASE_URL\", \"value\": \"$DATABASE_URL\"},
      {\"key\": \"JWT_SECRET\", \"generateValue\": true},
      # ALLOWED_ORIGINS must be set manually in Render dashboard to your frontend URL (cannot be "*")
      {\"key\": \"ENRICHMENT_CONCURRENCY\", \"value\": \"10\"}
    ],
    \"healthCheckPath\": \"/healthz\",
    \"autoDeploy\": true
  }")

API_ID=$(echo "$API_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$API_ID" ]; then
  echo "Failed to create API service. Response: $API_RESPONSE"
  exit 1
fi
echo "✅ API service created (ID: $API_ID). Building..."

# 3. Create Frontend Service
echo "🎨 Creating frontend service..."
FRONTEND_NAME="smartbookmark-frontend"
# Determine API URL from service ID (will be available after deploy)
API_URL="https://$SERVICE_NAME.onrender.com"

FRONTEND_RESPONSE=$(curl -s -X POST "$API_BASE/services" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"web\",
    \"name\": \"$FRONTEND_NAME\",
    \"env\": \"docker\",
    \"dockerfilePath\": \"apps/web/Dockerfile\",
    \"plan\": \"$SERVICE_PLAN\",
    \"branch\": \"$BRANCH\",
    \"repo\": \"$REPO\",
    \"region\": \"$REGION\",
    \"envVars\": [
      {\"key\": \"NODE_ENV\", \"value\": \"production\"},
      {\"key\": \"PORT\", \"value\": \"3001\"},
      {\"key\": \"NEXT_PUBLIC_API_URL\", \"value\": \"$API_URL\"}
    ],
    \"healthCheckPath\": \"/\",
    \"autoDeploy\": true
  }")

FRONTEND_ID=$(echo "$FRONTEND_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$FRONTEND_ID" ]; then
  echo "Failed to create frontend service. Response: $FRONTEND_RESPONSE"
  exit 1
fi
echo "✅ Frontend service created (ID: $FRONTEND_ID). Building..."

# 4. Wait and get URLs
echo "⏳ Waiting for services to deploy (this takes 10-15 minutes)..."
sleep 60

echo ""
echo "📊 Service URLs:"
echo "  API: https://$SERVICE_NAME.onrender.com"
echo "  Frontend: https://$FRONTEND_NAME.onrender.com"
echo ""
echo "To check status:"
echo "  API logs:   https://dashboard.render.com/services/$SERVICE_NAME"
echo "  Frontend:   https://dashboard.render.com/services/$FRONTEND_NAME"
echo "  Database:   https://dashboard.render.com/databases/$DB_ID"
echo ""
echo "⏳ Next steps:"
echo "  1. Wait for both services to show 'Live' (check dashboard)"
echo "  2. Run migrations on API: go to API service → Shell → run: npx prisma migrate deploy"
echo "  3. Test: https://$FRONTEND_NAME.onrender.com"
echo ""
echo "✅ Deployment complete!"
