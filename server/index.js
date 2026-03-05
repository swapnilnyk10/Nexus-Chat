require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const path       = require('path');

const { connectDB, User, Message } = require('./db/database');
const authRoutes        = require('./routes/auth.routes');
const authenticateToken = require('./middleware/auth');
const SERVER_ID = Date.now().toString();
const app    = express();
const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const PORT       = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── HTTP Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// Get last 100 messages
app.get('/api/messages', authenticateToken, async (req, res) => {
  const messages = await Message.find().sort({ createdAt: -1 }).limit(100).lean();
  const result = messages.reverse().map(m => ({
    id:          m._id,
    user_id:     m.user_id,
    username:    m.username,
    avatarColor: m.avatar_color,
    content:     m.content,
    type:        m.type,
    created_at:  m.createdAt,
    reactions:   aggregateReactions(m.reactions || [])
  }));
  res.json(result);
});

// Serve Angular in production
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io'))
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*' }
});

// Track who is online and who is typing (in-memory, resets on restart)
const connectedUsers = new Map(); // socketId -> { userId, username, avatarColor }
const typingUsers    = new Map(); // socketId -> username

// Verify JWT before allowing socket connection
io.use((socket, next) => {
  // console.log(socket)
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token provided'));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', async (socket) => {
  const { id: userId, username, avatarColor } = socket.user;
  console.log(username + ' connected');

  // Add to connected users map and mark online in DB
  const findUserIfAlreadyThere = Array.from(connectedUsers.values())
                                  .some(u => u.userId.toString() === userId.toString());
  connectedUsers.set(socket.id, { userId, username, avatarColor });
  await User.findByIdAndUpdate(userId, { is_online: true });

  console.log("#####")
  console.log(connectedUsers)
  // Send the new user their initial state
  socket.emit('init', {
    users:  uniqueUsers(),
    typing: Array.from(typingUsers.values()),
    serverId: SERVER_ID
  });

  // Tell everyone else this user joined
  socket.broadcast.emit('users:update', uniqueUsers());

  // Post a system message to the chat
  if(!findUserIfAlreadyThere){
    const joinMsg = await saveSystemMessage(username + ' joined the chat');
    io.emit('message:new', joinMsg);
  }

  // ── Send a message ──────────────────────────────────────────────────────────
  socket.on('message:send', async (data, callback) => {
    const content = data.content?.trim();
    if (!content) return;

    const doc = await Message.create({
      user_id: userId, username, avatar_color: avatarColor,
      content, type: 'text', reactions: []
    });

    io.emit('message:new', {
      id: doc._id, user_id: userId, username, avatarColor,
      content, type: 'text', created_at: doc.createdAt, reactions: []
    });

    // Clear typing indicator when user sends a message
    typingUsers.delete(socket.id);
    io.emit('typing:update', Array.from(typingUsers.values()));

    callback?.({ success: true });
  });

  // ── Typing indicators ───────────────────────────────────────────────────────
  socket.on('typing:start', () => {
    typingUsers.set(socket.id, username);
    io.emit('typing:update', Array.from(typingUsers.values()));
  });

  socket.on('typing:stop', () => {
    typingUsers.delete(socket.id);
    io.emit('typing:update', Array.from(typingUsers.values()));
  });

  // ── Emoji reactions ─────────────────────────────────────────────────────────
  socket.on('reaction:toggle', async (data, callback) => {
    const msg = await Message.findById(data.messageId);
    if (!msg) return;

    const existingIdx = msg.reactions.findIndex(
      r => r.user_id.toString() === userId.toString() && r.emoji === data.emoji
    );

    if (existingIdx >= 0) {
      msg.reactions.splice(existingIdx, 1); // remove reaction
    } else {
      msg.reactions.push({ emoji: data.emoji, user_id: userId, username }); // add reaction
    }

    await msg.save();

    io.emit('reaction:update', {
      messageId: data.messageId,
      reactions: aggregateReactions(msg.reactions)
    });

    callback?.({ success: true });
  });

  // ── Disconnect ──────────────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    console.log(username + ' disconnected');

    const userStillThereInAnotherTab = Array.from(connectedUsers.values())
                                    .some(u => u.userId.toString() === userId.toString());

    connectedUsers.delete(socket.id);
    typingUsers.delete(socket.id);
    await User.findByIdAndUpdate(userId, { is_online: false });

    io.emit('users:update', uniqueUsers());
    io.emit('typing:update', Array.from(typingUsers.values()));

    if(!userStillThereInAnotherTab){
      const leaveMsg = await saveSystemMessage(username + ' left the chat');
      io.emit('message:new', leaveMsg);
    }
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Group individual reactions into { emoji, count, users[] }
function aggregateReactions(reactions) {
  const map = {};
  for (const r of reactions) {
    if (!map[r.emoji]) map[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
    map[r.emoji].count++;
    map[r.emoji].users.push(r.username);
  }
  return Object.values(map);
}

function uniqueUsers() {
  const seen = new Set();
  return Array.from(connectedUsers.values()).filter(u => {
    const id = u.userId.toString();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// Save and return a system message (e.g. "Alice joined the chat")
async function saveSystemMessage(content) {
  const doc = await Message.create({ content, type: 'system', reactions: [] });
  return {
    id: doc._id, user_id: null, username: null, avatarColor: null,
    content, type: 'system', created_at: doc.createdAt, reactions: []
  };
}

// ─── Start ────────────────────────────────────────────────────────────────────
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log('Server running at http://localhost:' + PORT);
  });
});


