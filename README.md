# Nexus Chat

A real-time group chat app built with Angular, Express, Socket.IO, and MongoDB.

---

## Features

- Register / login with JWT authentication
- Real-time messaging via WebSockets
- Typing indicators ("Alice is typing...")
- Online users list
- Emoji reactions on messages
- Message history loaded on join

---

## Project Structure

```
nexus-chat/
├── server/
│   ├── index.js              # Express server + all Socket.IO logic
│   ├── db/database.js        # MongoDB connection + Mongoose models
│   ├── middleware/auth.js    # JWT check for HTTP routes
│   └── routes/auth.routes.js # POST /register and POST /login
│
├── client/                   # Angular app
│   └── src/app/
│       ├── services/
│       │   ├── auth.service.ts    # login, register, save/load user from localStorage
│       │   └── socket.service.ts  # WebSocket connection + all socket events
│       ├── components/
│       │   ├── login/             # Login / register page
│       │   └── chat/              # Main chat UI
│       └── guards/auth.guard.ts  # Redirect if not logged in
│
└── package.json
```

---

## How It Works

**Authentication**
1. User registers or logs in via REST API (`/api/auth`)
2. Server returns a JWT token
3. Token is saved in localStorage and sent with every HTTP and WebSocket request

**Messaging**
1. On connecting, the client fetches the last 100 messages via REST
2. Socket.IO connection is opened with the JWT token
3. New messages are emitted via `message:send` → server saves to MongoDB → broadcasts `message:new` to all clients

**Typing Indicators**
- Client emits `typing:start` on input, `typing:stop` after 3s of silence
- Server broadcasts the list of currently typing usernames to everyone

**Reactions**
- Client emits `reaction:toggle` with a message ID and emoji
- Server adds or removes the reaction in MongoDB and broadcasts updated counts

---

## Getting Started

### Requirements
- Node.js 18+
- MongoDB running locally

### Install

```bash
# Install server dependencies
npm install

# Install Angular dependencies
cd client && npm install && cd ..
```

### Configure

Copy `.env.example` to `.env`:

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/nexus-chat
JWT_SECRET=dev-secret
```

### Run (Development)

**Run Mongodb**
```bash
brew services start mongodb-community
```

**Terminal 1 — Backend:**
```bash
npm run dev
# Server at http://localhost:3000
```

**Terminal 2 — Frontend:**
```bash
cd client && npm start

#To run in phone
cd client && npm start -- --host 0.0.0.0
# Angular at http://localhost:4200
```

Open http://localhost:4200, register a user, and start chatting.  
Open a second tab with a different user to test real-time features.

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | – | Register a new user |
| POST | `/api/auth/login` | – | Login, returns JWT |
| GET | `/api/messages` | Bearer token | Last 100 messages |

### Socket Events

| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| Client → Server | `message:send` | `{ content }` | Send a message |
| Client → Server | `typing:start` | – | Tell others you're typing |
| Client → Server | `typing:stop` | – | Tell others you stopped |
| Client → Server | `reaction:toggle` | `{ messageId, emoji }` | Add or remove a reaction |
| Server → Client | `init` | `{ users, typing }` | Sent once on connect |
| Server → Client | `message:new` | Message object | A new message arrived |
| Server → Client | `users:update` | User[] | Online users changed |
| Server → Client | `typing:update` | string[] | Who is currently typing |
| Server → Client | `reaction:update` | `{ messageId, reactions }` | Reactions changed |

---

## Tech Stack

| | Technology |
|---|---|
| Frontend | Angular 17, SCSS |
| Backend | Express.js, Socket.IO |
| Database | MongoDB (Mongoose) |
| Auth | JWT + bcryptjs |
