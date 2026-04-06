const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://cheruu2a_db_user:nnx4cuwMLqmZRTB7@cluster0.qvtc9yy.mongodb.net/graduation?appName=Cluster0';

async function connect() {
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected');
}

// ── Schemas ──────────────────────────────────────────────────

const AdminSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true }
});

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true, required: true },
  createdAt: { type: Date, default: Date.now }
});

const PhotoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filename: { type: String, required: true },
  caption: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const LikeSchema = new mongoose.Schema({
  photoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Photo', required: true },
  ip: String,
  createdAt: { type: Date, default: Date.now }
});

const CommentSchema = new mongoose.Schema({
  photoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Photo', required: true },
  name: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Admin   = mongoose.model('Admin',   AdminSchema);
const User    = mongoose.model('User',    UserSchema);
const Photo   = mongoose.model('Photo',   PhotoSchema);
const Like    = mongoose.model('Like',    LikeSchema);
const Comment = mongoose.model('Comment', CommentSchema);

module.exports = { connect, Admin, User, Photo, Like, Comment };
