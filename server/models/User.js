const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: { type: String, enum: ['Player', 'GameEditor', 'Mod'], default: 'Player' },
});

module.exports = mongoose.model('User', userSchema);
