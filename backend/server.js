// ===== WHERE YOU BELONG - BACKEND SERVER =====

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

// Load .env from parent directory
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// Debug: Check if env variables are loaded
console.log("🔍 Environment check:");
console.log(
  "📊 MONGODB_URI:",
  process.env.MONGODB_URI ? "Loaded ✅" : "Missing ❌"
);
console.log(
  "🎵 SPOTIFY_CLIENT_ID:",
  process.env.SPOTIFY_CLIENT_ID ? "Loaded ✅" : "Missing ❌"
);

// ===== APP SETUP =====
const app = express();
const server = http.createServer(app);

// ===== SOCKET.IO SETUP =====
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3001", "http://localhost:3002"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ===== MIDDLEWARE =====
app.use(
  cors({
    origin: ["http://localhost:3001", "http://localhost:3002"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== DATABASE CONNECTION =====
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("🍃 Connected to MongoDB Atlas");
    console.log("📊 Database: where-you-belong");
  })
  .catch((error) => {
    console.error("❌ MongoDB connection error:", error);
    console.log("💡 Falling back to in-memory storage...");
  });

// ===== MODELS =====

// Message Model
const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  sender: {
    type: String,
    required: true,
    enum: ["yours", "crush"],
  },
  recipient: {
    type: String,
    required: true,
    enum: ["yours", "crush"],
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  read: {
    type: Boolean,
    default: false,
  },
});

const Message = mongoose.model("Message", messageSchema);

// Current Song Model
const currentSongSchema = new mongoose.Schema({
  songId: String,
  songName: String,
  artist: String,
  albumArt: String,
  previewUrl: String,
  spotifyUrl: String,
  selectedBy: {
    type: String,
    enum: ["yours", "crush"],
  },
  selectedAt: {
    type: Date,
    default: Date.now,
  },
});

const CurrentSong = mongoose.model("CurrentSong", currentSongSchema);

// User Session Model (for Spotify tokens)
const userSessionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    enum: ["yours", "crush"],
  },
  spotifyAccessToken: String,
  spotifyRefreshToken: String,
  tokenExpiresAt: Date,
  spotifyUserId: String,
  lastActive: {
    type: Date,
    default: Date.now,
  },
});

const UserSession = mongoose.model("UserSession", userSessionSchema);

// ===== ROUTES =====

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Where You Belong Backend is running!",
    timestamp: new Date().toISOString(),
    database:
      mongoose.connection.readyState === 1
        ? "MongoDB Atlas Connected"
        : "MongoDB Disconnected",
    environment: process.env.NODE_ENV || "development",
  });
});

// Get all messages for a user
app.get("/api/messages/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await Message.find({
      $or: [{ sender: userId }, { recipient: userId }],
    }).sort({ timestamp: -1 });

    console.log(`📬 Fetched ${messages.length} messages for ${userId}`);
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Send a new message
app.post("/api/messages", async (req, res) => {
  try {
    const { content, sender, recipient } = req.body;

    if (!content || !sender || !recipient) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const message = new Message({
      content,
      sender,
      recipient,
    });

    await message.save();

    // Emit to all connected clients
    io.emit("newMessage", message);

    console.log(`💌 New message saved: ${sender} → ${recipient}`);
    res.status(201).json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Get current comfort song
app.get("/api/current-song", async (req, res) => {
  try {
    const currentSong = await CurrentSong.findOne().sort({ selectedAt: -1 });
    console.log(
      `🎵 Current song: ${currentSong ? currentSong.songName : "None"}`
    );
    res.json(currentSong || null);
  } catch (error) {
    console.error("Error fetching current song:", error);
    res.status(500).json({ error: "Failed to fetch current song" });
  }
});

// Update current comfort song
app.post("/api/current-song", async (req, res) => {
  try {
    const {
      songId,
      songName,
      artist,
      albumArt,
      previewUrl,
      spotifyUrl,
      selectedBy,
    } = req.body;

    if (!songName || !artist || !selectedBy) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const currentSong = new CurrentSong({
      songId,
      songName,
      artist,
      albumArt,
      previewUrl,
      spotifyUrl,
      selectedBy,
    });

    await currentSong.save();

    // Emit to all connected clients
    io.emit("songUpdated", currentSong);

    console.log(`🎵 Song updated by ${selectedBy}: ${songName} - ${artist}`);
    res.status(201).json(currentSong);
  } catch (error) {
    console.error("Error updating current song:", error);
    res.status(500).json({ error: "Failed to update current song" });
  }
});

// ===== SPOTIFY ROUTES =====

// Spotify login
app.get("/api/spotify/login/:userId", (req, res) => {
  const { userId } = req.params;
  const scopes = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "playlist-read-private",
    "playlist-read-collaborative",
  ].join(" ");

  const redirectUri =
    userId === "yours"
      ? process.env.SPOTIFY_REDIRECT_URI_YOURS
      : process.env.SPOTIFY_REDIRECT_URI_CRUSH;

  const authUrl =
    `https://accounts.spotify.com/authorize?` +
    `client_id=${process.env.SPOTIFY_CLIENT_ID}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `state=${userId}&` +
    `show_dialog=true`;

  console.log(`🎵 Spotify login initiated for ${userId}`);
  res.redirect(authUrl);
});

// Test route for frontend
app.get("/api/test", (req, res) => {
  res.json({
    message: "Backend is working!",
    timestamp: new Date().toISOString(),
    routes: [
      "GET /api/health",
      "GET /api/messages/:userId",
      "POST /api/messages",
      "GET /api/current-song",
      "POST /api/current-song",
      "GET /api/spotify/login/:userId",
    ],
  });
});

// ===== SOCKET.IO EVENTS =====
io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  // Join user to their room
  socket.on("joinRoom", async (userId) => {
    socket.join(userId);
    console.log(`👤 User ${userId} joined room`);

    // Send current song to newly connected user
    try {
      const currentSong = await CurrentSong.findOne().sort({ selectedAt: -1 });
      if (currentSong) {
        socket.emit("songUpdated", currentSong);
      }
    } catch (error) {
      console.error("Error sending current song to new user:", error);
    }
  });

  // Handle real-time messaging
  socket.on("sendMessage", async (data) => {
    try {
      const message = new Message(data);
      await message.save();

      // Send to all clients
      io.emit("newMessage", message);

      console.log(`💌 Socket message: ${data.sender} → ${data.recipient}`);
    } catch (error) {
      console.error("Socket message error:", error);
    }
  });

  // Handle song updates
  socket.on("updateSong", async (data) => {
    try {
      const currentSong = new CurrentSong(data);
      await currentSong.save();

      // Broadcast to all users
      io.emit("songUpdated", currentSong);

      console.log(
        `🎵 Socket song update: ${data.songName} by ${data.selectedBy}`
      );
    } catch (error) {
      console.error("Socket song update error:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔌 User disconnected:", socket.id);
  });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🎵 Where You Belong Backend is live!`);
  console.log(`📱 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(
    `🔗 MongoDB: ${
      mongoose.connection.readyState === 1 ? "Connected" : "Connecting..."
    }`
  );
});

// ===== ERROR HANDLING =====
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});
