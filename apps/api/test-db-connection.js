const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    // Test if we can query the database
    const userCount = await prisma.user.count();
    const bookmarkCount = await prisma.bookmark.count();
    const tagCount = await prisma.tag.count();

    console.log('✅ Database connection successful!');
    console.log(`   Users: ${userCount}`);
    console.log(`   Bookmarks: ${bookmarkCount}`);
    console.log(`   Tags: ${tagCount}`);
    console.log('\n✅ Schema is properly set up!');

    // Show the schema structure
    console.log('\n📋 Schema structure:');
    console.log('   - User (id, email, passwordHash, createdAt) → bookmarks, tags');
    console.log('   - Bookmark (id, userId, url, title, description, faviconUrl, aiSummary, createdAt, enrichedAt) → user, tags');
    console.log('   - Tag (id, userId, name, createdAt) → user, bookmarks');
    console.log('   - Implicit join table: _BookmarkToTag (A: bookmarkId, B: tagId)');

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
