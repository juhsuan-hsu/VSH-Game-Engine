const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const sharp = require('sharp');
const { execFile } = require('child_process');
const Game = require('../models/Game');
const memoryUpload = multer({ storage: multer.memoryStorage() });
const tempUpload = multer({ dest: 'uploads/' });


router.get('/mindfile/:gameId/:stepIndex', async (req, res) => {
  try {
    const { gameId, stepIndex } = req.params;
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).send('Game not found');

    const step = game.steps[stepIndex];
    if (!step || !step.mindFile) return res.status(404).send('Mind file not found for step');

    let buf = null;
    const mf = step.mindFile;

    if (Buffer.isBuffer(mf)) buf = mf;
    else if (mf?.buffer) buf = Buffer.from(mf.buffer); // BSON Binary
    else if (mf?.data) buf = Buffer.from(mf.data); 
    else if (typeof mf === 'string') buf = Buffer.from(mf, 'base64');

    if (!buf) return res.status(500).send('Invalid mind file format');

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Length': buf.length,
      'Cache-Control': 'public, max-age=31536000'
    });
    res.end(buf);
  } catch (err) {
    console.error('Error serving step-level mindfile:', err);
    res.status(500).send('Server error');
  }
});


router.post('/upload-mind/:gameId/:stepIndex', memoryUpload.single('mind'), async (req, res) => {
  try {
    const { gameId, stepIndex } = req.params;
    const { arTargetIndex } = req.body; 
    const mindBuffer = req.file?.buffer;

    if (!mindBuffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const index = parseInt(stepIndex);
    if (isNaN(index) || index < 0 || index >= game.steps.length) {
      return res.status(400).json({ error: 'Invalid step index' });
    }

    game.steps[index].mindFile = mindBuffer;

    if (arTargetIndex !== undefined) {
      game.steps[index].arTargetIndex = parseInt(arTargetIndex);
    }

    await game.save();

    res.json({
      success: true,
      url: `/api/ar/mindfile/${gameId}/${index}`
    });
  } catch (err) {
    console.error('Upload .mind file error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.post('/upload-step/:gameId/:stepIndex', memoryUpload.single('image'), async (req, res) => {
  try {
    const { gameId, stepIndex } = req.params;

    const compressed = await sharp(req.file.buffer)
      .resize({ width: 512 })
      .jpeg({ quality: 60 })
      .toBuffer();

    const base64Image = `data:image/jpeg;base64,${compressed.toString('base64')}`;

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const step = game.steps[stepIndex];
    if (!step) return res.status(404).json({ error: 'Step not found' });

    step.arImageBase64 = base64Image;
    await game.save();

    res.json({ success: true, previewUrl: base64Image });
  } catch (err) {
    console.error('Upload AR image failed:', err);
    res.status(500).json({ error: 'Failed to upload AR image' });
  }
});

router.post('/compile/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const { images } = req.body;

  console.log('Received compile request for game:', gameId);
  console.log('Number of images:', images?.length);
  console.log('First 50 chars of first image:', images?.[0]?.slice(0, 50));

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'No images provided' });
  }

  try {
    const filenames = [];

    images.forEach((base64, i) => {
      const matches = base64.match(/^data:image\/jpeg;base64,(.+)$/);
      if (!matches) throw new Error('Invalid base64 format');

      const buffer = Buffer.from(matches[1], 'base64');
      const filename = `/tmp/step${i}.jpg`;
      fs.writeFileSync(filename, buffer);
      filenames.push(filename);
      console.log(`Wrote image to ${filename}`);
    });

    const outputPath = `/tmp/compiled_${Date.now()}.mind`;
    const args = ['image', 'compile', '--input', ...filenames, '--output', outputPath];

    execFile('./node_modules/.bin/mindar', args, async (err, stdout, stderr) => {
        console.log('MindAR CLI stdout:', stdout);
        console.error('MindAR CLI stderr:', stderr);
        filenames.forEach(f => {
            try {
            fs.unlinkSync(f);
            } catch (e) {
            console.warn('Failed to delete temp file:', f, e.message);
            }
        });

        if (err) {
            console.error('MindAR compile error object:', err);
            return res.status(500).json({ error: 'MindAR compilation failed', detail: err.message });
        }

        let mindBuffer;
        try {
            mindBuffer = fs.readFileSync(outputPath);
            fs.unlinkSync(outputPath);
        } catch (readErr) {
            console.error('Failed to read or delete output .mind file:', readErr);
            return res.status(500).json({ error: 'Failed to read compiled .mind file' });
        }

        try {
            const updated = await Game.findByIdAndUpdate(gameId, { mindFile: mindBuffer }, { new: true });
            if (!updated) {
            return res.status(404).json({ error: 'Game not found' });
            }

            console.log('Mind file compiled and saved for game:', gameId);
            res.json({ success: true });
        } catch (dbErr) {
            console.error('MongoDB save failed:', dbErr);
            res.status(500).json({ error: 'Failed to save .mind file to game' });
        }
        });

  } catch (err) {
    console.error('Server error during compile:', err);
    res.status(500).json({ error: 'Failed to compile AR targets' });
  }
});


module.exports = router;
