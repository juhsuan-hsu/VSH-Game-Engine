const jwt = require('jsonwebtoken');

module.exports = function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ code: 'NO_TOKEN' });

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'BAD_TOKEN';
      return res.status(401).json({ code });
    }
    req.user = { id: payload.id, role: payload.role, username: payload.username };
    return next();
  });
};
