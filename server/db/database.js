const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nexus-chat';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  username:      { type: String, required: true, unique: true, trim: true },
  password_hash: { type: String, required: true },
  avatar_color:  { type: String, default: '#6366f1' },
  is_online:     { type: Boolean, default: false },
  last_seen:     { type: Date, default: Date.now }
}, { timestamps: true });

// Case-insensitive unique index on username
userSchema.index({ username: 1 }, { collation: { locale: 'en', strength: 2 } });

const reactionSchema = new mongoose.Schema({
  emoji:    { type: String, required: true },
  user_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true }
}, { _id: false });

const messageSchema = new mongoose.Schema({
  user_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username:     { type: String, default: null },
  avatar_color: { type: String, default: null },
  content:      { type: String, required: true },
  type:         { type: String, enum: ['text', 'system'], default: 'text' },
  reactions:    [reactionSchema]
}, { timestamps: true });

messageSchema.index({ createdAt: -1 });

const User    = mongoose.model('User',    userSchema);
const Message = mongoose.model('Message', messageSchema);

// ─── Connection ───────────────────────────────────────────────────────────────

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB connected: ' + mongoose.connection.host);

    // Mark all users offline on startup (crash recovery)
    await User.updateMany({}, { is_online: false });
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
  mongoose.connection.on('reconnected',  () => console.log('♻️  MongoDB reconnected'));
}

module.exports = { connectDB, User, Message };
