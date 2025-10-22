const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const { authenticate, requireModOrOwner } = require('../middleware/authMiddleware');

router.get('/public', async (req, res) => {
  try {
    const games = await Game.find({ public: true }).select('title _id coverImage intro');
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load public games' });
  }
});

// POST: Create new game
router.post('/', authenticate, async (req, res) => {
  const { title, intro, coverImage, steps, map } = req.body;

  if (!title || !Array.isArray(steps)) {
    return res.status(400).json({ error: 'Invalid game data' });
  }

  const sanitizeStep = (s) => ({
    title: s.title || '',
    qrCode: s.qrCode || '',
    triggerMethod: s.triggerMethod || 'QR',
    gps: s.gps || { lat: '', lon: '', radius: '' },
    arTargetIndex: Number.isInteger(s.arTargetIndex) ? s.arTargetIndex : 0,
    arImageUrl: s.arImageUrl || '',
    missionType: s.missionType || 'information',
    hintText: s.hintText || '',
    hintImageUrl: s.hintImageUrl || '',
    message: s.message || '',
    question: s.question || '',
    correctAnswer: s.correctAnswer || '',
    correctMessage: s.correctMessage || '',
    wrongMessage: s.wrongMessage || '',
    mapPos: s.mapPos && typeof s.mapPos === 'object'
      ? { x: s.mapPos.x ?? null, y: s.mapPos.y ?? null }
      : { x: null, y: null },

    // NOTE: mindFile is written by the AR upload route
  });

  try {
    const game = new Game({
      user_id: req.user.id,
      title,
      intro: intro || '',
      coverImage: coverImage || '',
      map: map && typeof map === 'object'
        ? { imageUrl: map.imageUrl || '' }
        : { imageUrl: '' },
      steps: steps.map(sanitizeStep)
    });

    await game.save();
    res.status(201).json({ message: 'Game saved', gameId: game._id });
  } catch (err) {
    console.error('Error saving game:', err);
    res.status(500).json({ error: 'Server error saving game' });
  }
});

// Update game (mod or original creator only)
router.put('/:id', authenticate, requireModOrOwner(Game), async (req, res) => {
  const { title, intro, coverImage, steps, map } = req.body;

  const sanitizeStep = (s) => ({
    title: s.title || '',
    qrCode: s.qrCode || '',
    triggerMethod: s.triggerMethod || 'QR',
    gps: s.gps || { lat: '', lon: '', radius: '' },
    arTargetIndex: Number.isInteger(s.arTargetIndex) ? s.arTargetIndex : 0,
    arImageUrl: s.arImageUrl || '',
    missionType: s.missionType || 'information',
    hintText: s.hintText || '',
    hintImageUrl: s.hintImageUrl || '',
    message: s.message || '',
    question: s.question || '',
    correctAnswer: s.correctAnswer || '',
    correctMessage: s.correctMessage || '',
    wrongMessage: s.wrongMessage || '',
    mapPos: s.mapPos && typeof s.mapPos === 'object'
      ? { x: s.mapPos.x ?? null, y: s.mapPos.y ?? null }
      : { x: null, y: null }
  });

  try {
    const update = {
      title,
      intro,
      coverImage
    };

    if (map && typeof map === 'object') {
      update.map = { imageUrl: map.imageUrl || '' };
    }

    if (Array.isArray(steps)) {
      const existingGame = await Game.findById(req.params.id).select('steps');
      update.steps = steps.map((s, i) => ({
        ...sanitizeStep(s),
        mindFile: s.mindFile || existingGame?.steps?.[i]?.mindFile || undefined,
      }));
    }


    const updatedGame = await Game.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    if (!updatedGame) return res.status(404).json({ error: 'Game not found' });
    res.json(updatedGame);
  } catch (err) {
    console.error('Error updating game:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});


router.delete('/:id', authenticate, requireModOrOwner(Game), async (req, res) => {
  try {
    const game = await Game.findByIdAndDelete(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json({ message: 'Game deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error deleting game' });
  }
});

// Toggle public status
router.patch('/:id/public', authenticate, requireModOrOwner(Game), async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    game.public = !game.public; // toggle
    await game.save();

    res.json({ success: true, public: game.public });
  } catch (err) {
    console.error('Error toggling public status:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: List all games
router.get('/', authenticate, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  try {
    let query = {};

    // Only filter by user_id if not Mod
    if (req.user.role !== 'Mod') {
      query.user_id = req.user._id;
    }

    const total = await Game.countDocuments(query);
    const games = await Game.find(query)
                            .skip(skip)
                            .limit(limit)
                            .sort({ createdAt: -1 });

    res.json({ games, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: "Game not found" });
    res.json(game);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post('/compile/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { images } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    const filenames = [];

    images.forEach((base64, i) => {
      const matches = base64.match(/^data:image\/jpeg;base64,(.+)$/);
      if (!matches) throw new Error("Invalid base64 format");

      const buffer = Buffer.from(matches[1], 'base64');
      const filename = `uploads/step${i}.jpg`;
      fs.writeFileSync(filename, buffer);
      filenames.push(filename);
    });

    const outputPath = `compiled_${Date.now()}.mind`;
    const args = ['image', 'compile', '--input', ...filenames, '--output', outputPath];

    execFile('./node_modules/.bin/mindar', args, async (err, stdout, stderr) => {
      filenames.forEach(f => fs.unlinkSync(f));
      if (err) {
        console.error('MindAR compile error:', stderr);
        return res.status(500).json({ error: 'MindAR compilation failed' });
      }

      const mindBuffer = fs.readFileSync(outputPath);
      fs.unlinkSync(outputPath);

      const updated = await Game.findByIdAndUpdate(gameId, { mindFile: mindBuffer }, { new: true });

      if (!updated) {
        return res.status(404).json({ error: 'Game not found' });
      }

      res.json({ success: true });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compile AR targets' });
  }
});


module.exports = router;
