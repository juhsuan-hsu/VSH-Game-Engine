const jwt = require('jsonwebtoken');
const User = require('../models/User');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ code: 'NO_TOKEN' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ code: 'BAD_TOKEN' });
    }
    req.user = user;
    next();
  });
}


function requireMod(req, res, next) {
  if (req.user?.role !== 'Mod') return res.sendStatus(403);
  next();
}

function requireModOrOwner(model) {
  return async (req, res, next) => {
    const user = req.user;
    if (user.role === 'Mod') return next();

    try {
      const doc = await model.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Resource not found' });

      if (doc.user_id.toString() === user.id.toString()) {
        return next();
      }

      return res.status(403).json({ error: 'Forbidden' });
    } catch (err) {
      return res.status(500).json({ error: 'Server error' });
    }
  };
}

module.exports = {authenticate, requireMod, requireModOrOwner};
