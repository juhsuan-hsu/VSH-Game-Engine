const express = require('express');
const User = require('../models/User');
const Game = require('../models/Game');
const bcrypt = require('bcryptjs');
const { authenticate, requireMod } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authenticate, requireMod, async (req, res) => {
  console.log("Fetching users: page", req.query.page, "limit", req.query.limit);
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  try {
    const users = await User.find({}, 'username role _id')
      .skip(skip)
      .limit(limit);

    const userIds = users.map(u => u._id);

    const gameCounts = await Game.aggregate([
      { $match: { creatorId: { $in: userIds } } },
      { $group: { _id: "$user_id", count: { $sum: 1 } } }
    ]);

    const countMap = {};
    gameCounts.forEach(entry => {
      countMap[entry._id.toString()] = entry.count;
    });

    const usersWithCount = users.map(u => ({
      _id: u._id,
      username: u.username,
      role: u.role,
      gameCount: countMap[u._id.toString()] || 0
    }));

    const total = await User.countDocuments();

    res.json({
      users: usersWithCount,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Failed to fetch users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.delete('/:id', authenticate, requireMod, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.post('/', authenticate, requireMod, async (req, res) => {
  console.log("POST /users body:", req.body);
  const { username, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword, role });
    await newUser.save();
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    console.error('Add user failed:', err);
    res.status(500).json({ error: 'Add user failed' });
  }
});

module.exports = router;
