const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  // Get token from cookie or Authorization header
  const token = req.cookies?.accessToken || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Verify the JWT
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // Attach user info to request
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authMiddleware;
