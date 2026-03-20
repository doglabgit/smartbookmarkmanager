require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('./src/middleware/auth');

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cookieParser());
app.use(bodyParser.json());

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/bookmarks', authMiddleware, require('./src/routes/bookmarks'));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Close prisma on exit
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
