const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { connect, Admin, User, Photo, Like, Comment } = require('./db');
const { cloudinary } = require('./cloudinary');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'grad-jwt-secret-2024';

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

function requireAdmin(req, res, next) {
  const token = req.cookies?.admin_token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Unauthorized' }); }
}

let dbReady = false;
async function ensureDB() {
  if (!dbReady) {
    await connect();
    const existing = await Admin.findOne({ username: 'admin' });
    if (!existing)
      await Admin.create({ username: 'admin', password: bcrypt.hashSync('admin123', 10) });
    dbReady = true;
  }
}

app.use(async (req, res, next) => {
  try { await ensureDB(); next(); }
  catch (e) { res.status(500).json({ error: 'DB error: ' + e.message }); }
});

// ── Admin Auth ────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin || !bcrypt.compareSync(password, admin.password))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '24h' });
  res.cookie('admin_token', token, { httpOnly: true, sameSite: 'none', secure: true, maxAge: 86400000 });
  res.json({ success: true, token });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

app.get('/api/admin/me', (req, res) => {
  const token = req.cookies?.admin_token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.json({ isAdmin: false });
  try { jwt.verify(token, JWT_SECRET); res.json({ isAdmin: true }); }
  catch { res.json({ isAdmin: false }); }
});

// ── Cloudinary signature ──────────────────────────────────────
app.get('/api/cloudinary/signature', requireAdmin, (req, res) => {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = 'graduation-photos';
  // Cloudinary requires params sorted alphabetically + secret appended
  const toSign = `folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');
  res.json({
    timestamp,
    signature,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder
  });
});

// ── Users ─────────────────────────────────────────────────────
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users);
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
  try {
    const user = await User.create({ name, slug });
    res.json(user);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const photos = await Photo.find({ userId: req.params.id });
  for (const p of photos) {
    if (p.cloudinaryId) await cloudinary.uploader.destroy(p.cloudinaryId).catch(() => {});
    await Like.deleteMany({ photoId: p._id });
    await Comment.deleteMany({ photoId: p._id });
  }
  await Photo.deleteMany({ userId: req.params.id });
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ── Save photo after direct Cloudinary upload ─────────────────
app.post('/api/admin/users/:id/photos', requireAdmin, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { url, cloudinaryId, caption } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  const photo = await Photo.create({ userId: req.params.id, url, cloudinaryId: cloudinaryId || '', caption: caption || '' });
  res.json(photo);
});

app.delete('/api/admin/photos/:id', requireAdmin, async (req, res) => {
  const photo = await Photo.findById(req.params.id);
  if (photo) {
    if (photo.cloudinaryId) await cloudinary.uploader.destroy(photo.cloudinaryId).catch(() => {});
    await Like.deleteMany({ photoId: photo._id });
    await Comment.deleteMany({ photoId: photo._id });
    await photo.deleteOne();
  }
  res.json({ success: true });
});

// ── QR Code ───────────────────────────────────────────────────
app.get('/api/admin/users/:id/qr', requireAdmin, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${baseUrl}/gallery/${user.slug}`;
  const qr = await QRCode.toDataURL(url, { width: 300, margin: 2 });
  res.json({ qr, url });
});

// ── Public Gallery ────────────────────────────────────────────
app.get('/api/gallery/:slug', async (req, res) => {
  const user = await User.findOne({ slug: req.params.slug });
  if (!user) return res.status(404).json({ error: 'Not found' });
  const photos = await Photo.find({ userId: user._id }).sort({ createdAt: 1 });
  const photosWithData = await Promise.all(photos.map(async p => {
    const likes = await Like.countDocuments({ photoId: p._id });
    const comments = await Comment.find({ photoId: p._id }).sort({ createdAt: 1 });
    return { ...p.toObject(), likes, comments };
  }));
  res.json({ user, photos: photosWithData });
});

// ── Likes ─────────────────────────────────────────────────────
app.post('/api/photos/:id/like', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.ip;
  const existing = await Like.findOne({ photoId: req.params.id, ip });
  if (existing) await existing.deleteOne();
  else await Like.create({ photoId: req.params.id, ip });
  const likes = await Like.countDocuments({ photoId: req.params.id });
  res.json({ likes });
});

// ── Comments ──────────────────────────────────────────────────
app.post('/api/photos/:id/comments', async (req, res) => {
  const { name, message } = req.body;
  if (!name || !message) return res.status(400).json({ error: 'Name and message required' });
  const comment = await Comment.create({ photoId: req.params.id, name, message });
  res.json(comment);
});

// ── Gallery SPA ───────────────────────────────────────────────
app.get('/gallery/:slug', (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, '../frontend/index.html'), 'utf8');
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

module.exports = app;
