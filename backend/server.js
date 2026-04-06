const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { connect, Admin, User, Photo, Like, Comment } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'grad-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, '../frontend')));

function requireAdmin(req, res, next) {
  if (req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ─── Admin Auth ───────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  req.session.isAdmin = true;
  res.json({ success: true });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/admin/me', (req, res) => {
  res.json({ isAdmin: !!req.session.isAdmin });
});

// ─── Users ────────────────────────────────────────────────────
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
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const photos = await Photo.find({ userId: req.params.id });
  for (const p of photos) {
    const fp = path.join(uploadsDir, p.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    await Like.deleteMany({ photoId: p._id });
    await Comment.deleteMany({ photoId: p._id });
  }
  await Photo.deleteMany({ userId: req.params.id });
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ─── Photos ───────────────────────────────────────────────────
app.post('/api/admin/users/:id/photos', requireAdmin, upload.array('photos', 50), async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const inserted = [];
  for (const file of req.files) {
    const photo = await Photo.create({
      userId: req.params.id,
      filename: file.filename,
      caption: req.body.caption || ''
    });
    inserted.push(photo);
  }
  res.json(inserted);
});

app.delete('/api/admin/photos/:id', requireAdmin, async (req, res) => {
  const photo = await Photo.findById(req.params.id);
  if (photo) {
    const fp = path.join(uploadsDir, photo.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    await Like.deleteMany({ photoId: photo._id });
    await Comment.deleteMany({ photoId: photo._id });
    await photo.deleteOne();
  }
  res.json({ success: true });
});

// ─── QR Code ──────────────────────────────────────────────────
app.get('/api/admin/users/:id/qr', requireAdmin, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const url = `${baseUrl}/gallery/${user.slug}`;
  const qr = await QRCode.toDataURL(url, { width: 300, margin: 2 });
  res.json({ qr, url });
});

// ─── Public Gallery ───────────────────────────────────────────
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

// ─── Likes ────────────────────────────────────────────────────
app.post('/api/photos/:id/like', async (req, res) => {
  const ip = req.ip;
  const existing = await Like.findOne({ photoId: req.params.id, ip });
  if (existing) {
    await existing.deleteOne();
  } else {
    await Like.create({ photoId: req.params.id, ip });
  }
  const likes = await Like.countDocuments({ photoId: req.params.id });
  res.json({ likes });
});

// ─── Comments ─────────────────────────────────────────────────
app.post('/api/photos/:id/comments', async (req, res) => {
  const { name, message } = req.body;
  if (!name || !message) return res.status(400).json({ error: 'Name and message required' });
  const comment = await Comment.create({ photoId: req.params.id, name, message });
  res.json(comment);
});

// ─── SPA fallback ─────────────────────────────────────────────
app.get('/gallery/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── Start ────────────────────────────────────────────────────
connect().then(async () => {
  const existing = await Admin.findOne({ username: 'admin' });
  if (!existing) {
    await Admin.create({ username: 'admin', password: bcrypt.hashSync('admin123', 10) });
    console.log('Default admin created: admin / admin123');
  }

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Admin panel:   http://localhost:${PORT}/admin.html`);
  });
}).catch(err => {
  console.error('MongoDB connection failed:', err.message);
  process.exit(1);
});
