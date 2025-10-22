const mongoose = require('mongoose');

const stepSchema = new mongoose.Schema({
  title: String,
  mapPos: { 
    x: { type: Number, default: null }, 
    y: { type: Number, default: null } 
  },
  hintText: String,
  hintImageUrl: String,
  infoImageUrl: String, 
  questionImageUrl: String,
  question: String,
  correctAnswer: String,
  correctMessage: String,
  wrongMessage: String,
  qrCode: String,
  message: String,

  missionType: {
    type: String,
    enum: ['short-answer', 'information', 'multiple-choice'],
    default: 'short-answer'
  },

  triggerMethod: {
    type: String,
    enum: ['QR', 'GPS', 'AR'],
    default: 'QR'
  },

  gps: {
    lat: Number,
    lon: Number,
    radius: Number
  },

  mindFile: Buffer,
  arTargetIndex: Number,
  arImageUrl: String
});

const gameSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  title: String,
  intro: String,
  coverImage: String,
  public: {
    type: Boolean,
    default: false
  },
  map: {
    imageUrl: { type: String, default: '' },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 }
  },
  steps: [stepSchema],
  finalMessage: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model('Game', gameSchema);
