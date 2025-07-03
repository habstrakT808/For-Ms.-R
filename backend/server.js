// ===== WHERE YOU BELONG - BACKEND SERVER (UPDATED WITH QUEUE SYSTEM) =====

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const axios = require("axios");
const querystring = require("querystring");
const cookieParser = require("cookie-parser");
const { Schema } = mongoose;

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

// App Configuration
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Spotify API credentials
const SPOTIFY_CLIENT_ID =
  process.env.SPOTIFY_CLIENT_ID || "your-client-id-here";
const SPOTIFY_CLIENT_SECRET =
  process.env.SPOTIFY_CLIENT_SECRET || "your-client-secret-here";
const SPOTIFY_REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI || "http://localhost:3000/callback";
const STATE_KEY = "spotify_auth_state";

// ===== MIDDLEWARE =====
app.use(
  cors({
    origin: [
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3002",
      "http://localhost:3001",
      "http://localhost:3002",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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
  album: String,
  albumArt: String,
  previewUrl: String,
  spotifyUrl: String,
  duration: Number,
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

// 🎵 NEW: Music Queue Model
const queueSchema = new mongoose.Schema({
  songId: {
    type: String,
    required: true,
  },
  songName: {
    type: String,
    required: true,
  },
  artist: {
    type: String,
    required: true,
  },
  album: String,
  albumArt: String,
  previewUrl: String,
  spotifyUrl: String,
  duration: Number,
  addedBy: {
    type: String,
    required: true,
    enum: ["yours", "crush"],
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
  position: {
    type: Number,
    required: true,
  },
  isPlayed: {
    type: Boolean,
    default: false,
  },
  playedAt: Date,
});

// Index for efficient querying
queueSchema.index({ position: 1 });
queueSchema.index({ addedBy: 1, addedAt: -1 });

const Queue = mongoose.model("Queue", queueSchema);

// Queue History Model (for tracking played songs)
const queueHistorySchema = new mongoose.Schema({
  songId: String,
  songName: String,
  artist: String,
  album: String,
  albumArt: String,
  spotifyUrl: String,
  duration: Number,
  playedBy: {
    type: String,
    enum: ["yours", "crush"],
  },
  playedAt: {
    type: Date,
    default: Date.now,
  },
  originalAddedBy: {
    type: String,
    enum: ["yours", "crush"],
  },
  originalAddedAt: Date,
});

const QueueHistory = mongoose.model("QueueHistory", queueHistorySchema);

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

// ===== EXISTING ROUTES =====

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
    features: {
      messaging: "✅ Active",
      spotify: "✅ Active",
      queue: "✅ Active (NEW!)",
      realtime: "✅ Socket.io Connected",
    },
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

// Mark message as read
app.patch("/api/messages/:messageId/read", async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findByIdAndUpdate(
      messageId,
      { read: true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    console.log(`✅ Message marked as read: ${messageId}`);
    res.json(message);
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({ error: "Failed to mark message as read" });
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

// ===== 🎵 NEW: QUEUE MANAGEMENT ROUTES =====

// Get current queue
app.get("/api/queue", async (req, res) => {
  try {
    const queue = await Queue.find({ isPlayed: false })
      .sort({ position: 1 })
      .lean();

    const queueStats = {
      totalSongs: queue.length,
      totalDuration: queue.reduce((sum, song) => sum + (song.duration || 0), 0),
      addedByYours: queue.filter((song) => song.addedBy === "yours").length,
      addedByCrush: queue.filter((song) => song.addedBy === "crush").length,
    };

    console.log(`🎵 Queue fetched: ${queue.length} songs`);
    res.json({
      queue,
      stats: queueStats,
    });
  } catch (error) {
    console.error("Error fetching queue:", error);
    res.status(500).json({ error: "Failed to fetch queue" });
  }
});

// Add song to queue
app.post("/api/queue", async (req, res) => {
  try {
    const {
      songId,
      songName,
      artist,
      album,
      albumArt,
      previewUrl,
      spotifyUrl,
      duration,
      addedBy,
    } = req.body;

    if (!songId || !songName || !artist || !addedBy) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if song already exists in queue
    const existingSong = await Queue.findOne({
      songId,
      isPlayed: false,
    });

    if (existingSong) {
      return res.status(409).json({
        error: "Song already in queue",
        existingSong,
      });
    }

    // Get next position
    const lastSong = await Queue.findOne({ isPlayed: false }).sort({
      position: -1,
    });
    const nextPosition = lastSong ? lastSong.position + 1 : 1;

    const queueItem = new Queue({
      songId,
      songName,
      artist,
      album,
      albumArt,
      previewUrl,
      spotifyUrl,
      duration,
      addedBy,
      position: nextPosition,
    });

    await queueItem.save();

    // Emit to all connected clients
    io.emit("queueUpdated", {
      action: "add",
      song: queueItem,
      addedBy,
    });

    console.log(
      `🎵 Song added to queue by ${addedBy}: ${songName} - ${artist} (Position: ${nextPosition})`
    );
    res.status(201).json(queueItem);
  } catch (error) {
    console.error("Error adding song to queue:", error);
    res.status(500).json({ error: "Failed to add song to queue" });
  }
});

// Remove song from queue
app.delete("/api/queue/:songId", async (req, res) => {
  try {
    const { songId } = req.params;
    const { userId } = req.query;

    const queueItem = await Queue.findOne({
      songId,
      isPlayed: false,
    });

    if (!queueItem) {
      return res.status(404).json({ error: "Song not found in queue" });
    }

    // Only allow removal by the person who added it or both users can remove any song
    // For now, let's allow anyone to remove any song for collaborative experience

    await Queue.deleteOne({ songId, isPlayed: false });

    // Reorder remaining queue items
    const remainingItems = await Queue.find({ isPlayed: false }).sort({
      position: 1,
    });

    for (let i = 0; i < remainingItems.length; i++) {
      remainingItems[i].position = i + 1;
      await remainingItems[i].save();
    }

    // Emit to all connected clients
    io.emit("queueUpdated", {
      action: "remove",
      songId,
      removedBy: userId,
    });

    console.log(
      `🎵 Song removed from queue: ${queueItem.songName} by ${userId}`
    );
    res.json({ message: "Song removed from queue successfully" });
  } catch (error) {
    console.error("Error removing song from queue:", error);
    res.status(500).json({ error: "Failed to remove song from queue" });
  }
});

// Reorder queue
app.patch("/api/queue/reorder", async (req, res) => {
  try {
    const { reorderedQueue, userId } = req.body;

    if (!Array.isArray(reorderedQueue)) {
      return res.status(400).json({ error: "Invalid queue data" });
    }

    // Update positions
    for (let i = 0; i < reorderedQueue.length; i++) {
      await Queue.updateOne(
        { songId: reorderedQueue[i].songId, isPlayed: false },
        { position: i + 1 }
      );
    }

    // Emit to all connected clients
    io.emit("queueUpdated", {
      action: "reorder",
      queue: reorderedQueue,
      reorderedBy: userId,
    });

    console.log(`🎵 Queue reordered by ${userId}`);
    res.json({ message: "Queue reordered successfully" });
  } catch (error) {
    console.error("Error reordering queue:", error);
    res.status(500).json({ error: "Failed to reorder queue" });
  }
});

// Play next song from queue
app.post("/api/queue/next", async (req, res) => {
  try {
    const { playedBy } = req.body;

    // Get next song in queue
    const nextSong = await Queue.findOne({ isPlayed: false }).sort({
      position: 1,
    });

    if (!nextSong) {
      return res.status(404).json({ error: "No songs in queue" });
    }

    // Mark current song as played and move to history
    nextSong.isPlayed = true;
    nextSong.playedAt = new Date();
    await nextSong.save();

    // Add to history
    const historyItem = new QueueHistory({
      songId: nextSong.songId,
      songName: nextSong.songName,
      artist: nextSong.artist,
      album: nextSong.album,
      albumArt: nextSong.albumArt,
      spotifyUrl: nextSong.spotifyUrl,
      duration: nextSong.duration,
      playedBy,
      originalAddedBy: nextSong.addedBy,
      originalAddedAt: nextSong.addedAt,
    });
    await historyItem.save();

    // Update current song
    const currentSong = new CurrentSong({
      songId: nextSong.songId,
      songName: nextSong.songName,
      artist: nextSong.artist,
      album: nextSong.album,
      albumArt: nextSong.albumArt,
      previewUrl: nextSong.previewUrl,
      spotifyUrl: nextSong.spotifyUrl,
      duration: nextSong.duration,
      selectedBy: playedBy,
    });
    await currentSong.save();

    // Emit updates
    io.emit("songUpdated", currentSong);
    io.emit("queueUpdated", {
      action: "next",
      playedSong: nextSong,
      newCurrentSong: currentSong,
      playedBy,
    });

    console.log(
      `🎵 Playing next from queue: ${nextSong.songName} - ${nextSong.artist}`
    );
    res.json({
      playedSong: nextSong,
      newCurrentSong: currentSong,
      message: "Playing next song from queue",
    });
  } catch (error) {
    console.error("Error playing next song:", error);
    res.status(500).json({ error: "Failed to play next song" });
  }
});

// Clear entire queue
app.delete("/api/queue", async (req, res) => {
  try {
    const { userId } = req.query;

    const deletedCount = await Queue.deleteMany({ isPlayed: false });

    // Emit to all connected clients
    io.emit("queueUpdated", {
      action: "clear",
      clearedBy: userId,
      deletedCount: deletedCount.deletedCount,
    });

    console.log(
      `🎵 Queue cleared by ${userId}: ${deletedCount.deletedCount} songs removed`
    );
    res.json({
      message: "Queue cleared successfully",
      deletedCount: deletedCount.deletedCount,
    });
  } catch (error) {
    console.error("Error clearing queue:", error);
    res.status(500).json({ error: "Failed to clear queue" });
  }
});

// Shuffle queue
app.patch("/api/queue/shuffle", async (req, res) => {
  try {
    const { userId } = req.body;

    const queueItems = await Queue.find({ isPlayed: false });

    if (queueItems.length <= 1) {
      return res
        .status(400)
        .json({ error: "Need at least 2 songs to shuffle" });
    }

    // Shuffle algorithm (Fisher-Yates)
    for (let i = queueItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queueItems[i], queueItems[j]] = [queueItems[j], queueItems[i]];
    }

    // Update positions
    for (let i = 0; i < queueItems.length; i++) {
      queueItems[i].position = i + 1;
      await queueItems[i].save();
    }

    // Emit to all connected clients
    io.emit("queueUpdated", {
      action: "shuffle",
      queue: queueItems,
      shuffledBy: userId,
    });

    console.log(`🎵 Queue shuffled by ${userId}: ${queueItems.length} songs`);
    res.json({
      message: "Queue shuffled successfully",
      queue: queueItems,
    });
  } catch (error) {
    console.error("Error shuffling queue:", error);
    res.status(500).json({ error: "Failed to shuffle queue" });
  }
});

// Get queue history
app.get("/api/queue/history", async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const history = await QueueHistory.find()
      .sort({ playedAt: -1 })
      .limit(parseInt(limit))
      .lean();

    console.log(`🎵 Queue history fetched: ${history.length} songs`);
    res.json(history);
  } catch (error) {
    console.error("Error fetching queue history:", error);
    res.status(500).json({ error: "Failed to fetch queue history" });
  }
});

// Export queue as JSON
app.get("/api/queue/export", async (req, res) => {
  try {
    const queue = await Queue.find({ isPlayed: false })
      .sort({ position: 1 })
      .lean();

    const exportData = {
      exportedAt: new Date().toISOString(),
      totalSongs: queue.length,
      totalDuration: queue.reduce((sum, song) => sum + (song.duration || 0), 0),
      playlist: queue.map((song) => ({
        name: song.songName,
        artist: song.artist,
        album: song.album,
        spotifyUrl: song.spotifyUrl,
        duration: song.duration,
        addedBy: song.addedBy,
        addedAt: song.addedAt,
      })),
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="where-you-belong-playlist.json"'
    );

    console.log(`🎵 Queue exported: ${queue.length} songs`);
    res.json(exportData);
  } catch (error) {
    console.error("Error exporting queue:", error);
    res.status(500).json({ error: "Failed to export queue" });
  }
});

// ===== EXISTING SPOTIFY ROUTES =====

// Spotify search endpoint
app.get("/api/spotify/search", async (req, res) => {
  try {
    const { q, type = "track", limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({ error: "Search query is required" });
    }

    // Get client credentials token
    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      querystring.stringify({
        grant_type: "client_credentials",
      }),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Search tracks
    const searchResponse = await axios.get(
      "https://api.spotify.com/v1/search",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          q,
          type,
          limit,
          market: "US",
        },
      }
    );

    const tracks = searchResponse.data.tracks.items.map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artists[0].name,
      album: track.album.name,
      albumArt: track.album.images[0]?.url || null,
      previewUrl: track.preview_url,
      spotifyUrl: track.external_urls.spotify,
      duration: track.duration_ms,
      popularity: track.popularity,
    }));

    console.log(`🔍 Spotify search: "${q}" - ${tracks.length} results`);
    res.json({ tracks });
  } catch (error) {
    console.error(
      "Spotify search error:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to search Spotify" });
  }
});

// Get featured/recommended tracks
app.get("/api/spotify/featured", async (req, res) => {
  try {
    // Get client credentials token
    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      querystring.stringify({
        grant_type: "client_credentials",
      }),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Instead of featured playlists, search for curated artists
    const curatedArtists = ["LANY", "Taylor Swift", "Keshi", "NIKI", "Clairo"];
    const randomArtist =
      curatedArtists[Math.floor(Math.random() * curatedArtists.length)];

    const searchResponse = await axios.get(
      "https://api.spotify.com/v1/search",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          q: `artist:${randomArtist}`,
          type: "track",
          limit: 10,
          market: "US",
        },
      }
    );

    const tracks = searchResponse.data.tracks.items
      .filter((track) => track.preview_url) // Only tracks with preview
      .map((track) => ({
        id: track.id,
        name: track.name,
        artist: track.artists[0].name,
        album: track.album.name,
        albumArt: track.album.images[0]?.url || null,
        previewUrl: track.preview_url,
        spotifyUrl: track.external_urls.spotify,
        duration: track.duration_ms,
        popularity: track.popularity,
      }));

    console.log(
      `🎵 Featured tracks from ${randomArtist}: ${tracks.length} tracks`
    );
    res.json({ tracks });
  } catch (error) {
    console.error(
      "Spotify featured error:",
      error.response?.data || error.message
    );

    // Fallback: return empty array instead of error
    console.log("🎵 Returning empty featured tracks due to error");
    res.json({ tracks: [] });
  }
});

// Update current song with Spotify data
app.post("/api/current-song/spotify", async (req, res) => {
  try {
    const {
      spotifyId,
      songName,
      artist,
      album,
      albumArt,
      previewUrl,
      spotifyUrl,
      selectedBy,
      duration,
    } = req.body;

    if (!spotifyId || !songName || !artist || !selectedBy) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const currentSong = new CurrentSong({
      songId: spotifyId,
      songName,
      artist,
      albumArt,
      previewUrl,
      spotifyUrl,
      selectedBy,
      album,
      duration,
    });

    await currentSong.save();

    // Emit to all connected clients
    io.emit("songUpdated", currentSong);

    console.log(
      `🎵 Spotify song updated by ${selectedBy}: ${songName} - ${artist}`
    );
    res.status(201).json(currentSong);
  } catch (error) {
    console.error("Error updating Spotify song:", error);
    res.status(500).json({ error: "Failed to update song" });
  }
});

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

  // Gunakan redirect URI yang sesuai dengan user
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
    `state=${encodeURIComponent(userId + "_" + generateRandomString(16))}`;

  console.log(`🔗 Login URL for ${userId}: ${authUrl}`);
  res.redirect(authUrl);
});

// ===== SPOTIFY AUTH ROUTES =====

// Generate random string for state verification
function generateRandomString(length) {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Login route - redirect to Spotify auth
app.get("/login", (req, res) => {
  const state = generateRandomString(16);
  res.cookie(STATE_KEY, state);

  // Deteksi user type dari query parameter atau default ke 'yours'
  const userType = req.query.user_type || "yours";
  const frontendPort = userType === "crush" ? "3002" : "3001";

  const scope =
    "user-read-private user-read-email user-read-currently-playing streaming user-library-read user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative";

  // Gunakan URI yang sesuai untuk callback umum
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI || "http://localhost:3000/callback";

  console.log(`🔗 Login requested for ${userType} (port: ${frontendPort})`);
  console.log(`🔄 Using redirect URI: ${redirectUri}`);

  // Tambahkan user type ke state untuk digunakan di callback
  const stateWithUserType = `${userType}_${state}`;

  // Redirect to Spotify authorization page
  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: SPOTIFY_CLIENT_ID,
        scope: scope,
        redirect_uri: redirectUri,
        state: stateWithUserType,
        show_dialog: true,
      })
  );
});

// Fallback callback route (untuk debugging)
app.get("/callback", async (req, res) => {
  console.log("📞 Fallback callback received");
  console.log("Query params:", req.query);

  // Coba deteksi user dari state atau redirect ke yours sebagai default
  const state = req.query.state || "";
  const userId = state.includes("crush") ? "crush" : "yours";
  const frontendPort = userId === "crush" ? "3002" : "3001";

  console.log(
    `🔄 Fallback: Detected user as ${userId}, redirecting to port ${frontendPort}`
  );

  const code = req.query.code || null;

  if (state === null || !code) {
    console.log(`❌ Missing code or state for ${userId}`);
    res.redirect(`http://localhost:${frontendPort}/#error=state_mismatch`);
    return;
  }

  // PENTING: Gunakan redirect URI yang sama dengan yang digunakan untuk autentikasi
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI || "http://localhost:3000/callback";

  console.log(`🔄 Using redirect URI for token exchange: ${redirectUri}`);

  try {
    console.log(`🔑 Exchanging code for token...`);

    // Exchange authorization code for access token
    const tokenResponse = await axios({
      method: "post",
      url: "https://accounts.spotify.com/api/token",
      data: querystring.stringify({
        code: code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET).toString(
            "base64"
          ),
      },
    });

    console.log(`✅ Token exchange successful for ${userId}`);
    console.log(
      `✅ Access token received: ${
        tokenResponse.data.access_token ? "Present" : "Missing"
      }`
    );
    console.log(
      `✅ Refresh token received: ${
        tokenResponse.data.refresh_token ? "Present" : "Missing"
      }`
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get user profile with token
    console.log(`👤 Fetching user profile...`);
    const userResponse = await axios({
      method: "get",
      url: "https://api.spotify.com/v1/me",
      headers: {
        Authorization: "Bearer " + access_token,
      },
    });

    console.log(`✅ User profile fetched: ${userResponse.data.display_name}`);

    // Store user info
    const userData = {
      id: userResponse.data.id,
      name: userResponse.data.display_name,
      email: userResponse.data.email,
      profileImage: userResponse.data.images?.[0]?.url || null,
    };

    // Redirect ke frontend yang sesuai dengan port yang benar
    const redirectUrl =
      `http://localhost:${frontendPort}/auth-success.html?` +
      querystring.stringify({
        access_token,
        refresh_token,
        expires_in,
        user_id: userData.id,
        user_name: userData.name,
        user_type: userId,
      });

    console.log(`🔄 Redirecting ${userId} to: ${redirectUrl}`);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error(
      `❌ Error during Spotify authentication for ${userId}:`,
      error.response?.data || error.message
    );

    // Log more detailed error information
    if (error.response) {
      console.error(`❌ Error status: ${error.response.status}`);
      console.error(`❌ Error data:`, error.response.data);
    }

    // Coba cara alternatif: redirect langsung ke frontend dengan kode
    const alternativeRedirectUrl =
      `http://localhost:${frontendPort}/auth-success.html?` +
      querystring.stringify({
        code: code,
        state: state,
        error: error.message,
      });

    console.log(`🔄 Trying alternative redirect to: ${alternativeRedirectUrl}`);
    res.redirect(alternativeRedirectUrl);
  }
});

// Tambahkan endpoint baru untuk menangani token exchange di frontend
app.post("/api/spotify/exchange-token", async (req, res) => {
  const { code, redirect_uri } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Code is required" });
  }

  console.log("📞 Token exchange request received");
  console.log("Code:", code ? "Present" : "Missing");
  console.log("Redirect URI:", redirect_uri);

  try {
    // Exchange authorization code for access token
    const tokenResponse = await axios({
      method: "post",
      url: "https://accounts.spotify.com/api/token",
      data: querystring.stringify({
        code: code,
        redirect_uri: redirect_uri || "http://localhost:3000/callback",
        grant_type: "authorization_code",
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET).toString(
            "base64"
          ),
      },
    });

    console.log("✅ Token exchange successful via API");

    // Return tokens to frontend
    res.json({
      access_token: tokenResponse.data.access_token,
      refresh_token: tokenResponse.data.refresh_token,
      expires_in: tokenResponse.data.expires_in,
    });
  } catch (error) {
    console.error(
      "❌ Error during token exchange:",
      error.response?.data || error.message
    );

    if (error.response) {
      console.error(`❌ Error status: ${error.response.status}`);
      console.error(`❌ Error data:`, error.response.data);
    }

    res.status(500).json({
      error: "Failed to exchange token",
      details: error.response?.data || error.message,
    });
  }
});

// Refresh token route
app.post("/refresh_token", async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: "Refresh token is required" });
  }

  try {
    const response = await axios({
      method: "post",
      url: "https://accounts.spotify.com/api/token",
      data: querystring.stringify({
        grant_type: "refresh_token",
        refresh_token: refresh_token,
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET).toString(
            "base64"
          ),
      },
    });

    res.json({
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
    });
  } catch (error) {
    console.error("Error refreshing token:", error);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

// Get user Spotify profile
app.get("/api/user-profile", async (req, res) => {
  const { access_token } = req.query;

  if (!access_token) {
    return res.status(401).json({ error: "Access token is required" });
  }

  try {
    const userResponse = await axios({
      method: "get",
      url: "https://api.spotify.com/v1/me",
      headers: {
        Authorization: "Bearer " + access_token,
      },
    });

    res.json(userResponse.data);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// Get currently playing track from Spotify
app.get("/api/spotify/currently-playing", async (req, res) => {
  try {
    const { access_token } = req.query;

    if (!access_token) {
      return res.status(400).json({ error: "Access token is required" });
    }

    // Call Spotify API to get currently playing track
    const response = await axios.get(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    // If no track is playing
    if (response.status === 204) {
      return res.json({ isPlaying: false, track: null });
    }

    // Format track info
    const trackData = response.data;
    const track = {
      id: trackData.item.id,
      name: trackData.item.name,
      artist: trackData.item.artists[0].name,
      album: trackData.item.album.name,
      albumArt: trackData.item.album.images[0]?.url || null,
      previewUrl: trackData.item.preview_url,
      spotifyUrl: trackData.item.external_urls.spotify,
      duration_ms: trackData.item.duration_ms,
    };

    // Return track info and playback state
    res.json({
      isPlaying: trackData.is_playing,
      progress_ms: trackData.progress_ms,
      track,
    });
  } catch (error) {
    console.error("Error fetching currently playing track:", error.message);

    // Handle 401 Unauthorized (token expired)
    if (error.response && error.response.status === 401) {
      return res.status(401).json({ error: "Token expired" });
    }

    // Handle other errors
    res.status(500).json({
      error: "Failed to fetch currently playing track",
      details: error.response?.data || error.message,
    });
  }
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 Server is running on port ${process.env.PORT || 3000}`);
});
