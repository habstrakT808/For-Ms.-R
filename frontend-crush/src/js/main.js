// ===== WHERE YOU BELONG - ADVANCED QUEUE SYSTEM (PHASE 3) =====

// Global variables (Enhanced)
let socket = null;
let currentUser = null;
let isConnected = false;
let spotifyPlayer = null;
let currentPreview = null;
let currentAudio = null;
let isPlaying = false;
let musicQueue = [];
let currentQueueIndex = -1;
let queueStats = { totalSongs: 0, totalDuration: 0 };

// 🎵 NEW: Advanced queue settings
let queueSettings = {
  autoPlay: true,
  repeatMode: "none", // 'none', 'queue', 'song'
  smartShuffle: false,
  crossfade: true,
  autoAddSimilar: false,
};

// 🎵 NEW: Queue analytics
let queueAnalytics = {
  songsPlayed: 0,
  totalListeningTime: 0,
  favoriteArtists: {},
  queueHistory: [],
  collaborativeStats: {
    yoursAdded: 0,
    crushAdded: 0,
  },
};

// ===== INITIALIZATION =====

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Check login status before initializing app
  checkLoginStatus().then((isLoggedIn) => {
    if (isLoggedIn) {
      initializeApp();
    } else {
      // Redirect to login page if not in demo mode and not already on index page
      if (
        !window.location.href.includes("?demo=true") &&
        !window.location.pathname.endsWith("index.html")
      ) {
        window.location.href = "login.html";
      } else {
        initializeApp();
      }
    }
  });
});

// Check Spotify login status
async function checkLoginStatus() {
  // Check if we're already on the index page
  if (
    window.location.pathname.endsWith("index.html") ||
    window.location.pathname === "/" ||
    window.location.pathname.endsWith("/")
  ) {
    console.log("Already on index page, skipping login check");
    return true;
  }

  // Check for demo mode parameter
  if (window.location.href.includes("?demo=true")) {
    console.log("Running in demo mode");
    return true;
  }

  // Check for auth data in localStorage
  const authData = JSON.parse(
    localStorage.getItem("spotify_auth_data") || "null"
  );

  if (!authData) {
    console.log("No authentication data found");
    return false;
  }

  // Check if token is expired
  if (authData.tokenExpiry < Date.now()) {
    console.log("Token expired, attempting to refresh");

    try {
      // Try to refresh the token
      const refreshed = await refreshSpotifyToken(authData.refreshToken);
      if (!refreshed) {
        return false;
      }
      return true;
    } catch (error) {
      console.error("Failed to refresh token:", error);
      return false;
    }
  }

  // Set the user info in the UI
  if (authData.user && authData.user.name) {
    setUserInfo(authData.user);
  }

  return true;
}

// Refresh Spotify token
async function refreshSpotifyToken(refreshToken) {
  try {
    const response = await fetch("http://localhost:3000/refresh_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new Error("Failed to refresh token");
    }

    const data = await response.json();

    // Update auth data with new token
    const authData = JSON.parse(localStorage.getItem("spotify_auth_data"));
    authData.accessToken = data.access_token;
    authData.tokenExpiry = Date.now() + data.expires_in * 1000;
    localStorage.setItem("spotify_auth_data", JSON.stringify(authData));

    return true;
  } catch (error) {
    console.error("Token refresh error:", error);
    return false;
  }
}

// Set user info in UI
function setUserInfo(user) {
  // Add user info to the UI if needed
  console.log("Logged in as:", user.name);

  // Optional: update UI with user info
  const userEl = document.createElement("div");
  userEl.className =
    "flex items-center space-x-2 text-sm text-cream-600 dark:text-cream-400";

  if (user.image) {
    const imgEl = document.createElement("img");
    imgEl.src = user.image;
    imgEl.className = "w-6 h-6 rounded-full";
    userEl.appendChild(imgEl);
  }

  const nameEl = document.createElement("span");
  nameEl.textContent = user.name;
  userEl.appendChild(nameEl);

  // Add logout option
  const logoutBtn = document.createElement("button");
  logoutBtn.textContent = "Logout";
  logoutBtn.className =
    "ml-3 text-xs text-warm-500 hover:text-warm-600 dark:hover:text-warm-400";
  logoutBtn.addEventListener("click", logout);
  userEl.appendChild(logoutBtn);

  // Add to desktop nav menu
  const desktopNav = document.querySelector(
    ".hidden.md\\:flex.items-center.space-x-8"
  );
  if (desktopNav) {
    desktopNav.appendChild(userEl);
  }
}

// Logout function
function logout() {
  localStorage.removeItem("spotify_auth_data");
  window.location.href = "login.html";
}

// Initialize application
function initializeApp() {
  const userElement = document.getElementById("user-id");
  currentUser = userElement ? userElement.dataset.user : "crush";

  console.log(`🔌 Initializing as user: ${currentUser}`);

  // Load queue settings
  loadQueueSettings();

  // Get the base API URL based on current window location
  const apiBaseUrl = getApiBaseUrl();
  console.log(`🌐 Using API base URL: ${apiBaseUrl}`);

  initializeSocket(apiBaseUrl);
  initializeUI();
  loadInitialData(apiBaseUrl);
  loadQueue(apiBaseUrl);

  setTimeout(() => {
    initializeSpotify(apiBaseUrl);
  }, 1000);

  // Add event listener to stop polling when user leaves the page
  window.addEventListener("beforeunload", () => {
    if (spotifyPlayer) {
      spotifyPlayer.stopListeningActivityPolling();
    }
  });
}

// Helper function to get the appropriate API base URL
function getApiBaseUrl() {
  const hostname = window.location.hostname;
  // If we're using localhost in the browser, use localhost for the API
  // If we're using 127.0.0.1 in the browser, use 127.0.0.1 for the API
  return `http://${hostname === "127.0.0.1" ? "127.0.0.1" : "localhost"}:3000`;
}

// Load queue settings from localStorage or use defaults
function loadQueueSettings() {
  const savedSettings = JSON.parse(
    localStorage.getItem("queue_settings") || "null"
  );
  if (savedSettings) {
    queueSettings = { ...queueSettings, ...savedSettings };
    console.log("🎵 Loaded queue settings:", queueSettings);
  } else {
    console.log("🎵 Using default queue settings");
  }
}

// Load music queue from the server
async function loadQueue(apiBaseUrl) {
  if (!apiBaseUrl) {
    apiBaseUrl = getApiBaseUrl();
  }

  try {
    console.log("🎵 Loading music queue...");
    const response = await fetch(`${apiBaseUrl}/api/queue`);

    if (!response.ok) {
      throw new Error(`Failed to load queue: ${response.status}`);
    }

    const data = await response.json();
    musicQueue = data.queue || [];

    console.log(`🎵 Loaded ${musicQueue.length} songs in queue`);

    // Update UI if needed
    displayQueue();
    updateQueueStats();
  } catch (error) {
    console.error("❌ Failed to load queue:", error);
    showNotification("Could not load music queue", "error");
  }
}

// Display the queue in the UI
function displayQueue() {
  const queueContainer = document.getElementById("queue-container");
  if (!queueContainer) return;

  if (musicQueue.length === 0) {
    queueContainer.innerHTML = `
      <div class="text-center py-8">
        <div class="text-4xl mb-4">🎵</div>
        <p class="text-cream-600 dark:text-cream-400">Queue is empty</p>
        <p class="text-sm text-cream-500 dark:text-cream-500 mt-2">Add songs to the queue to get started</p>
      </div>
    `;
    return;
  }

  queueContainer.innerHTML = musicQueue
    .map(
      (song, index) => `
      <div class="queue-item bg-white/70 dark:bg-cream-800/70 rounded-lg p-3 mb-2 flex items-center space-x-3 hover:bg-white/90 dark:hover:bg-cream-700/90 transition-all duration-200">
        <div class="w-10 h-10 bg-gradient-to-br from-warm-300 to-cream-400 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
          ${
            song.albumArt
              ? `<img src="${song.albumArt}" alt="${song.album}" class="w-full h-full object-cover">`
              : `<span class="text-white text-sm">🎵</span>`
          }
        </div>
        <div class="flex-1 min-w-0">
          <h5 class="font-medium text-cream-900 dark:text-cream-200 truncate text-sm">
            ${song.songName}
          </h5>
          <p class="text-cream-600 dark:text-cream-400 text-xs truncate">
            ${song.artist}
          </p>
        </div>
        <div class="flex items-center space-x-1 flex-shrink-0">
          <button 
            onclick="removeFromQueue(${index})" 
            class="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-500 flex items-center justify-center text-xs"
            title="Remove from queue"
          >
            ×
          </button>
        </div>
      </div>
    `
    )
    .join("");
}

// Update queue statistics
function updateQueueStats() {
  queueStats.totalSongs = musicQueue.length;
  queueStats.totalDuration = musicQueue.reduce(
    (total, song) => total + (song.duration || 0),
    0
  );

  // Update the queue count display
  const queueCountEl = document.getElementById("queue-count");
  if (queueCountEl) {
    queueCountEl.textContent = `${queueStats.totalSongs} songs`;
  }

  // Update the queue duration display
  const queueDurationEl = document.getElementById("queue-duration");
  if (queueDurationEl) {
    const minutes = Math.floor(queueStats.totalDuration / 60000);
    const seconds = Math.floor((queueStats.totalDuration % 60000) / 1000);
    queueDurationEl.textContent = `${minutes}:${seconds
      .toString()
      .padStart(2, "0")} total`;
  }

  // Also update the legacy stats element if it exists
  const statsEl = document.getElementById("queue-stats");
  if (statsEl) {
    statsEl.textContent = `${queueStats.totalSongs} songs · ${Math.round(
      queueStats.totalDuration / 60000
    )} minutes`;
  }
}

// Update collaborative statistics
function updateCollaborativeStats() {
  queueAnalytics.collaborativeStats.yoursAdded = musicQueue.filter(
    (song) => song.addedBy === "yours"
  ).length;

  queueAnalytics.collaborativeStats.crushAdded = musicQueue.filter(
    (song) => song.addedBy === "crush"
  ).length;

  console.log(
    "📊 Queue collaboration stats:",
    queueAnalytics.collaborativeStats
  );
}

// Remove a song from the queue
window.removeFromQueue = async function (index) {
  if (index < 0 || index >= musicQueue.length) {
    console.error("❌ Invalid queue index:", index);
    return;
  }

  try {
    const apiBaseUrl = getApiBaseUrl();
    const song = musicQueue[index];

    console.log(`🎵 Removing song from queue: ${song.songName}`);

    const response = await fetch(`${apiBaseUrl}/api/queue/${index}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ removedBy: currentUser }),
    });

    if (!response.ok) {
      throw new Error(`Failed to remove song: ${response.status}`);
    }

    showNotification(`Removed "${song.songName}" from queue`, "info");

    // We'll let the socket event update the queue
  } catch (error) {
    console.error("❌ Failed to remove song from queue:", error);
    showNotification("Could not remove song from queue", "error");
  }
};

function initializeSocket(apiBaseUrl) {
  socket = io(apiBaseUrl, {
    transports: ["websocket", "polling"],
    timeout: 5000,
  });

  socket.on("connect", () => {
    console.log("🔌 Connected to server:", socket.id);
    isConnected = true;
    updateConnectionStatus(true);
    socket.emit("joinRoom", currentUser);
  });

  socket.on("disconnect", () => {
    console.log("🔌 Disconnected from server");
    isConnected = false;
    updateConnectionStatus(false);
  });

  socket.on("connect_error", (error) => {
    console.error("🔌 Connection error:", error);
    isConnected = false;
    updateConnectionStatus(false);
  });

  socket.on("newMessage", (message) => {
    console.log("💌 New message received:", message);
    if (message.sender !== currentUser) {
      displayNewMessage(message, true);
      showNotification(`New message from Someone Special! 💌`);
    }
  });

  socket.on("songUpdated", (song) => {
    console.log("🎵 Song updated:", song);
    updateCurrentSong(song);
    if (song.selectedBy !== currentUser) {
      showNotification(`Someone chose a new song: ${song.songName}! 🎵`);
    }
  });

  // Enhanced queue events
  socket.on("queueUpdated", (data) => {
    console.log("🎵 Queue updated:", data);

    switch (data.action) {
      case "init":
        musicQueue = data.queue;
        displayQueue();
        updateQueueStats();
        updateCollaborativeStats();
        break;

      case "add":
        if (data.addedBy !== currentUser) {
          showNotification(
            `✨ Someone added "${data.song.songName}" to queue!`
          );
        }
        loadQueue();
        break;

      case "remove":
        if (data.removedBy !== currentUser) {
          showNotification(`Someone removed a song from queue`);
        }
        loadQueue();
        break;

      case "reorder":
        if (data.reorderedBy !== currentUser) {
          showNotification(`Someone reordered the queue 🔄`);
        }
        musicQueue = data.queue;
        displayQueue();
        updateQueueStats();
        break;

      case "clear":
        if (data.clearedBy !== currentUser) {
          showNotification(`Someone cleared the queue`);
        }
        musicQueue = [];
        queueStats = { totalSongs: 0, totalDuration: 0 };
        displayQueue();
        updateQueueStats();
        updateCollaborativeStats();
        break;

      case "shuffle":
        if (data.shuffledBy !== currentUser) {
          showNotification(`Someone shuffled the queue! 🔀`);
        }
        musicQueue = data.queue;
        displayQueue();
        updateQueueStats();
        break;

      case "next":
        if (data.playedBy !== currentUser) {
          showNotification(
            `🎵 Someone played: ${data.newCurrentSong.songName}!`
          );
        }
        loadQueue();
        break;
    }
  });

  socket.on("queueError", (error) => {
    console.error("🎵 Queue error:", error);
    showNotification(error.error, "error");
  });
}

// ===== CONNECTION STATUS MANAGEMENT =====
function updateConnectionStatus(connected) {
  const connectionDot = document.getElementById("connection-dot");
  const connectionText = document.getElementById("connection-text");

  if (connected) {
    connectionDot?.classList.remove("bg-red-400");
    connectionDot?.classList.add("bg-green-400");
    if (connectionText) {
      connectionText.textContent = "Connected to your heart ✨";
    }
  } else {
    connectionDot?.classList.remove("bg-green-400");
    connectionDot?.classList.add("bg-red-400");
    if (connectionText) {
      connectionText.textContent = "Reconnecting...";
    }
  }
}

// ===== MESSAGING SYSTEM =====

async function loadInitialData() {
  try {
    showLoadingState();

    const apiBaseUrl = getApiBaseUrl();
    console.log("🔍 Attempting to fetch messages from backend...");
    const messagesUrl = `${apiBaseUrl}/api/messages/${currentUser}`;
    console.log(`🔗 Request URL: ${messagesUrl}`);

    const response = await fetch(messagesUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const allMessages = await response.json();
    console.log("📬 All messages received:", allMessages);

    const receivedMessages = allMessages.filter(
      (msg) => msg.recipient === currentUser
    );

    console.log(
      `📬 Loaded ${receivedMessages.length} received messages for ${currentUser}`
    );
    displayMessages(receivedMessages);

    console.log("🎵 Attempting to fetch current song...");
    const songUrl = `${apiBaseUrl}/api/current-song`;
    console.log(`🔗 Request URL: ${songUrl}`);

    const songResponse = await fetch(songUrl);
    if (!songResponse.ok) {
      throw new Error(`HTTP error! Status: ${songResponse.status}`);
    }

    const currentSong = await songResponse.json();
    console.log("🎵 Current song data:", currentSong);

    if (currentSong && Object.keys(currentSong).length > 0) {
      console.log("✅ Updating current song with:", currentSong);
      updateCurrentSong(currentSong);
    } else {
      console.log("⚠️ No current song found, showing default");
      showDefaultSong();
    }
  } catch (error) {
    console.error("❌ Error loading initial data:", error);
    showNotification("Failed to load data. Please refresh the page.", "error");
  }
}

function showLoadingState() {
  const lettersLoading = document.getElementById("letters-loading");
  const songLoading = document.getElementById("song-loading");

  if (lettersLoading) lettersLoading.classList.remove("hidden");
  if (songLoading) songLoading.classList.remove("hidden");
}

async function sendMessage(content) {
  try {
    if (!content || content.trim() === "") {
      return;
    }

    const apiBaseUrl = getApiBaseUrl();
    const messageData = {
      content,
      sender: currentUser,
      recipient: currentUser === "yours" ? "crush" : "yours",
    };

    const response = await fetch(`${apiBaseUrl}/api/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messageData),
    });

    if (response.ok) {
      const newMessage = await response.json();
      console.log("💌 Message sent:", newMessage);

      // Add to UI
      displayNewMessage(newMessage, true);

      // Clear input
      const messageInput = document.getElementById("message-input");
      if (messageInput) {
        messageInput.value = "";
        messageInput.focus();
      }

      showNotification("Message sent! ✨", "success");
    } else {
      throw new Error("Failed to send message");
    }
  } catch (error) {
    console.error("Error sending message:", error);
    showNotification("Failed to send message", "error");
  }
}

function displayMessages(messages) {
  const lettersContainer = document.getElementById("letters-container");
  const loadingElement = document.getElementById("letters-loading");

  if (loadingElement) {
    loadingElement.classList.add("hidden");
  }

  if (!lettersContainer) return;

  const existingMessages = lettersContainer.querySelectorAll(".glass-effect");
  existingMessages.forEach((msg) => msg.remove());

  if (messages.length === 0) {
    lettersContainer.innerHTML = `
        <div class="text-center py-12">
          <div class="text-6xl mb-4">💌</div>
        <h3 class="text-xl font-semibold text-cream-800 dark:text-cream-200 mb-2">No letters yet</h3>
        <p class="text-cream-600 dark:text-cream-400">Waiting for someone to send you a message...</p>
        <p class="text-sm text-cream-500 dark:text-cream-500 mt-2">Messages you receive will appear here ✨</p>
        </div>
      `;
    return;
  }

  messages.reverse().forEach((message, index) => {
    displayNewMessage(message, false, index * 100);
  });
}

function displayNewMessage(message, animate = true, delay = 0) {
  const lettersContainer = document.getElementById("letters-container");
  if (!lettersContainer) return;

  if (message.sender === currentUser) {
    console.log("🚫 Not displaying own message in Letters");
    return;
  }

  const noLettersMsg = lettersContainer.querySelector(".text-center");
  if (noLettersMsg && noLettersMsg.textContent.includes("No letters yet")) {
    noLettersMsg.remove();
  }

  const messageElement = document.createElement("div");
  const timeAgo = getTimeAgo(new Date(message.timestamp));

  messageElement.className = `glass-effect rounded-xl p-6 transform transition-all duration-500 hover:shadow-lg ${
    animate ? "opacity-0 translate-y-4" : ""
  }`;

  messageElement.innerHTML = `
      <div class="flex items-start space-x-4">
        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-sage-400 to-warm-400 flex items-center justify-center shadow-lg flex-shrink-0">
          <span class="text-white font-semibold text-sm">💕</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-2 mb-2">
          <h4 class="font-medium text-cream-800 dark:text-cream-200">Someone Special</h4>
          <span class="text-xs text-cream-500 dark:text-cream-500">${timeAgo}</span>
            ${
              !message.read
                ? '<span class="w-2 h-2 bg-warm-400 rounded-full animate-pulse"></span>'
                : ""
            }
          </div>
        <p class="text-cream-700 dark:text-cream-300 leading-relaxed whitespace-pre-wrap">${escapeHtml(
          message.content
        )}</p>
        </div>
      </div>
    `;

  lettersContainer.insertBefore(messageElement, lettersContainer.firstChild);

  setTimeout(() => {
    messageElement.classList.remove("opacity-0", "translate-y-4");
  }, delay);

  if (!message.read) {
    markMessageAsRead(message._id);
  }
}

async function markMessageAsRead(messageId) {
  try {
    await fetch(`${apiBaseUrl}/api/messages/${messageId}/read`, {
      method: "PATCH",
    });
  } catch (error) {
    console.error("Failed to mark message as read:", error);
  }
}

// ===== MESSAGE FORM HANDLING =====
const messageForm = document.getElementById("message-form");
const messageTextarea = document.getElementById("message-text");
const charCount = document.getElementById("char-count");
const sendButton = document.getElementById("send-button");

if (messageTextarea && charCount) {
  messageTextarea.addEventListener("input", function () {
    const count = this.value.length;
    charCount.textContent = `${count}/1000`;

    if (count > 900) {
      charCount.classList.add("text-warm-600");
    } else {
      charCount.classList.remove("text-warm-600");
    }

    if (sendButton) {
      sendButton.disabled = count === 0 || count > 1000 || !isConnected;

      if (count === 0) {
        sendButton.classList.add("opacity-50", "cursor-not-allowed");
      } else {
        sendButton.classList.remove("opacity-50", "cursor-not-allowed");
      }
    }
  });

  messageTextarea.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
  });
}

if (messageForm) {
  messageForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const messageText = messageTextarea?.value?.trim();
    if (!messageText || !isConnected) return;

    sendButton.disabled = true;
    sendButton.innerHTML = `
        <div class="flex items-center justify-center space-x-2">
          <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Sending...</span>
        </div>
      `;

    try {
      await sendMessage(messageText);

      messageTextarea.value = "";
      messageTextarea.style.height = "auto";
      charCount.textContent = "0/1000";

      showNotification("Message sent successfully! 💌", "success");

      setTimeout(() => {
        showNotification(
          "Your message is on its way to someone special ✨",
          "info"
        );
      }, 1500);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      sendButton.disabled = false;
      sendButton.innerHTML = `
          <span>Send Message</span>
          <span>💌</span>
        `;
    }
  });
}

// ===== SPOTIFY INTEGRATION (Enhanced) =====

function initializeSpotify(apiBaseUrl) {
  if (window.SpotifyPlayer) {
    spotifyPlayer = new SpotifyPlayer();
    console.log("🎵 Spotify player initialized");
  } else {
    console.warn("⚠️ Spotify player not available");
  }
}

window.selectNewSong = function () {
  openMusicModal();
};

window.openMusicModal = async function () {
  const modal = document.getElementById("music-modal");
  if (modal) {
    modal.classList.remove("hidden");
    if (spotifyPlayer) {
      await loadFeaturedTracks();
    }
  }
};

window.closeMusicModal = function () {
  const modal = document.getElementById("music-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
  if (spotifyPlayer) {
    spotifyPlayer.stopPreview();
  }
};

async function loadFeaturedTracks() {
  try {
    const tracks = await spotifyPlayer.loadFeaturedTracks();
    displayTracks(tracks, "featured-tracks");
  } catch (error) {
    console.error("Failed to load featured tracks:", error);
    showNotification(
      "Failed to load recommendations. Try searching instead.",
      "error"
    );
  }
}

const searchInput = document.getElementById("spotify-search");
let searchTimeout;

if (searchInput) {
  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimeout);
    const query = this.value.trim();

    if (query.length === 0) {
      showFeaturedSection();
      return;
    }

    if (query.length < 2) return;

    searchTimeout = setTimeout(async () => {
      await performSearch(query);
    }, 500);
  });
}

async function performSearch(query) {
  const loadingEl = document.getElementById("spotify-loading");
  const resultsSection = document.getElementById("search-results-section");
  const featuredSection = document.getElementById("featured-section");
  const emptyState = document.getElementById("empty-state");

  try {
    if (loadingEl) loadingEl.classList.remove("hidden");
    if (resultsSection) resultsSection.classList.add("hidden");
    if (featuredSection) featuredSection.classList.add("hidden");
    if (emptyState) emptyState.classList.add("hidden");

    const tracks = await spotifyPlayer.searchTracks(query);

    if (loadingEl) loadingEl.classList.add("hidden");

    if (tracks.length > 0) {
      displayTracks(tracks, "search-results");
      if (resultsSection) resultsSection.classList.remove("hidden");
    } else {
      if (emptyState) emptyState.classList.remove("hidden");
    }
  } catch (error) {
    console.error("Search error:", error);
    if (loadingEl) loadingEl.classList.add("hidden");
    showNotification("Failed to search Spotify. Please try again.", "error");
  }
}

function showFeaturedSection() {
  const resultsSection = document.getElementById("search-results-section");
  const featuredSection = document.getElementById("featured-section");
  const emptyState = document.getElementById("empty-state");

  if (resultsSection) resultsSection.classList.add("hidden");
  if (featuredSection) featuredSection.classList.remove("hidden");
  if (emptyState) emptyState.classList.add("hidden");
}

function displayTracks(tracks, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (tracks.length === 0) {
    container.innerHTML = `
        <div class="text-center py-8">
          <div class="text-4xl mb-4">🎵</div>
        <p class="text-cream-600 dark:text-cream-400">No tracks available</p>
        </div>
      `;
    return;
  }

  container.innerHTML = tracks
    .slice(0, 10)
    .map(
      (track) => `
    <div class="track-card bg-white/70 dark:bg-cream-800/70 rounded-xl p-4 hover:bg-white/90 dark:hover:bg-cream-700/90 transition-all duration-200 cursor-pointer group">
        <div class="flex items-center space-x-4">
          <div class="w-16 h-16 bg-gradient-to-br from-warm-300 to-cream-400 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md">
            ${
              track.albumArt
                ? `<img src="${track.albumArt}" alt="${escapeHtml(
                    track.album
                  )}" class="w-full h-full object-cover">`
                : `<span class="text-white text-xl">🎵</span>`
            }
          </div>
          
          <div class="flex-1 min-w-0">
          <h5 class="font-bold text-cream-900 dark:text-cream-200 truncate text-lg group-hover:text-warm-700 dark:group-hover:text-warm-400 transition-colors">
              ${escapeHtml(track.name)}
            </h5>
          <p class="text-cream-700 dark:text-cream-300 text-sm truncate font-medium">
              ${escapeHtml(track.artist)}
            </p>
          <p class="text-cream-500 dark:text-cream-500 text-xs truncate">
              ${escapeHtml(track.album)}
            </p>
            <div class="flex items-center space-x-2 mt-1">
            <span class="text-xs text-cream-400 dark:text-cream-500">
                ${track.duration ? formatDuration(track.duration) : "Unknown"}
              </span>
              ${
                track.popularity
                  ? `<span class="text-xs text-cream-400 dark:text-cream-500">• ${track.popularity}% popular</span>`
                  : ""
              }
            </div>
          </div>
          
          <div class="flex items-center space-x-2 flex-shrink-0">
            ${
              track.previewUrl
                ? `<button 
                onclick="event.stopPropagation(); playPreview('${track.previewUrl}', this)" 
                class="btn-preview w-10 h-10 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200"
                title="Play 30s preview"
              >
                <span class="text-sm">▶</span>
              </button>`
                : `<div class="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-500 text-xs" title="No preview available">
                🚫
              </div>`
            }
          <button 
            onclick="event.stopPropagation(); addTrackToQueue('${track.id}')" 
            class="btn-queue px-3 py-2 bg-gradient-to-r from-blue-400 to-indigo-500 hover:from-blue-500 hover:to-indigo-600 text-white text-sm font-bold rounded-lg shadow-lg transition-all duration-200"
            title="Add to queue"
          >
            + Queue
          </button>
            <button 
              onclick="event.stopPropagation(); selectTrack('${track.id}')" 
              class="btn-choose px-4 py-2 bg-gradient-to-r from-warm-400 to-cream-500 hover:from-warm-500 hover:to-cream-600 text-white text-sm font-bold rounded-lg shadow-lg transition-all duration-200"
            >
              Choose ✨
            </button>
          </div>
        </div>
      </div>
    `
    )
    .join("");
}

window.playPreview = function (previewUrl, buttonElement) {
  if (spotifyPlayer) {
    spotifyPlayer.stopPreview();

    const allPlayButtons = document.querySelectorAll(".btn-preview");
    allPlayButtons.forEach((btn) => {
      btn.innerHTML = '<span class="text-sm">▶</span>';
      btn.classList.remove("bg-red-500");
      btn.classList.add("bg-green-500");
    });

    buttonElement.innerHTML = '<span class="text-sm">⏸</span>';
    buttonElement.classList.remove("bg-green-500");
    buttonElement.classList.add("bg-red-500");

    const audio = spotifyPlayer.playPreview(previewUrl);

    if (audio) {
      audio.addEventListener("ended", () => {
        buttonElement.innerHTML = '<span class="text-sm">▶</span>';
        buttonElement.classList.remove("bg-red-500");
        buttonElement.classList.add("bg-green-500");
      });
    }

    showNotification("Playing 30-second preview 🎵", "info");
  }
};

window.addTrackToQueue = async function (trackId) {
  try {
    const track = [
      ...(spotifyPlayer.searchResults || []),
      ...(spotifyPlayer.featuredTracks || []),
    ].find((t) => t.id === trackId);

    if (!track) {
      showNotification("Track not found", "error");
      return;
    }

    await addToQueue(track);
  } catch (error) {
    console.error("Failed to add track to queue:", error);
  }
};

window.selectTrack = async function (trackId) {
  try {
    const track = [
      ...(spotifyPlayer.searchResults || []),
      ...(spotifyPlayer.featuredTracks || []),
    ].find((t) => t.id === trackId);

    if (!track) {
      showNotification("Track not found", "error");
      return;
    }

    showNotification("Setting as comfort song...", "info");

    await spotifyPlayer.selectSong(track, currentUser);

    closeMusicModal();

    showNotification(`"${track.name}" is now your comfort song! 🎵`, "success");

    setTimeout(() => {
      scrollToSection("music");
    }, 1000);
  } catch (error) {
    console.error("Failed to select track:", error);
    showNotification("Failed to select song. Please try again.", "error");
  }
};

window.clearSearch = function () {
  const searchInput = document.getElementById("spotify-search");
  if (searchInput) {
    searchInput.value = "";
    showFeaturedSection();
  }
};

document.getElementById("music-modal")?.addEventListener("click", function (e) {
  if (e.target === this) {
    closeMusicModal();
  }
});

// Enhanced notification system
function showNotification(message, type = "success") {
  const notification = document.createElement("div");
  const bgColor =
    type === "success"
      ? "from-sage-400 to-warm-400"
      : type === "error"
      ? "from-red-400 to-orange-400"
      : "from-blue-400 to-indigo-400";

  notification.className = `fixed top-20 right-4 bg-gradient-to-r ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300 max-w-sm`;
  notification.innerHTML = `
      <div class="flex items-center space-x-2">
      <span>${type === "success" ? "✅" : type === "error" ? "⚠️" : "ℹ️"}</span>
        <span class="text-sm font-medium flex-1">${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" class="text-white/80 hover:text-white ml-2 text-lg leading-none">&times;</button>
      </div>
    `;

  document.body.appendChild(notification);

  setTimeout(() => notification.classList.remove("translate-x-full"), 100);
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.classList.add("translate-x-full");
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }
  }, 5000);
}

window.openSpotify = function () {
  if (window.currentSong?.spotifyUrl) {
    window.open(window.currentSong.spotifyUrl, "_blank");
  } else {
    showNotification("Spotify link not available", "error");
  }
};

// ===== DARK MODE FUNCTIONALITY =====

function initializeDarkMode() {
  const savedTheme = localStorage.getItem("theme") || "light";

  setTheme(savedTheme);

  const themeToggle = document.getElementById("theme-toggle");
  const themeToggleMobile = document.getElementById("theme-toggle-mobile");

  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }

  if (themeToggleMobile) {
    themeToggleMobile.addEventListener("click", toggleTheme);
  }

  console.log(`🌙 Theme initialized: ${savedTheme}`);
}

function toggleTheme() {
  const currentTheme =
    document.documentElement.getAttribute("data-theme") || "light";
  const newTheme = currentTheme === "light" ? "dark" : "light";

  setTheme(newTheme);
  localStorage.setItem("theme", newTheme);

  const themeEmoji = newTheme === "dark" ? "🌙" : "☀️";
  const themeName = newTheme === "dark" ? "Dark" : "Light";
  showNotification(`${themeEmoji} Switched to ${themeName} mode`, "info");

  console.log(`🎨 Theme changed to: ${newTheme}`);
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  if (theme === "dark") {
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
    document.body.classList.remove("dark");
  }

  updateThemeIcons(theme);
}

function updateThemeIcons(theme) {
  const themeIcon = document.getElementById("theme-icon");
  const themeIconMobile = document.getElementById("theme-icon-mobile");

  const icon = theme === "dark" ? "☀️" : "🌙";

  if (themeIcon) themeIcon.textContent = icon;
  if (themeIconMobile) themeIconMobile.textContent = icon;
}

// ===== UI INITIALIZATION =====

// Global scrollToSection function
window.scrollToSection = function (sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    const mobileMenu = document.getElementById("mobile-menu");
    if (mobileMenu) {
      mobileMenu.classList.add("hidden");
    }
  }
};

function initializeUI() {
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener("click", function () {
      mobileMenu.classList.toggle("hidden");
    });
  }

  const nav = document.querySelector("nav");
  const navLinks = document.querySelectorAll(".nav-link");

  window.addEventListener("scroll", function () {
    const scrollY = window.scrollY;

    if (scrollY > 100) {
      nav?.classList.add("bg-white/90", "shadow-lg");
      nav?.classList.remove("bg-white/20");
    } else {
      nav?.classList.add("bg-white/20");
      nav?.classList.remove("bg-white/90", "shadow-lg");
    }
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href").substring(1);
      scrollToSection(targetId);
    });
  });

  initializeDarkMode();

  document
    .getElementById("progress-container")
    ?.addEventListener("click", function (e) {
      if (!currentAudio) return;

      const rect = this.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;

      currentAudio.currentTime = percentage * currentAudio.duration;
    });

  document
    .getElementById("volume-slider")
    ?.addEventListener("input", function () {
      if (currentAudio) {
        currentAudio.volume = this.value / 100;
      }
    });
}

// ===== CONSOLE WELCOME =====
console.log(
  "%c🎵 Where You Belong - Advanced Queue System Active!",
  "color: #d4a574; font-size: 18px; font-weight: bold;"
);
console.log(
  `%c✨ Connected as: ${currentUser}`,
  "color: #8b7355; font-size: 14px;"
);
console.log(
  "%c🎶 NEW: Advanced queue features loaded!",
  "color: #ff6b6b; font-size: 12px; font-weight: bold;"
);
console.log(
  "%c🧠 Smart shuffle, auto-play, repeat modes, analytics & more!",
  "color: #4ecdc4; font-size: 12px;"
);

// Update the current song display
function updateCurrentSong(song) {
  if (!song) {
    showDefaultSong();
    return;
  }

  window.currentSong = song;

  const songLoading = document.getElementById("song-loading");
  const songDisplay = document.getElementById("song-display");

  if (songLoading) songLoading.classList.add("hidden");
  if (songDisplay) songDisplay.classList.remove("hidden");

  // Update song details
  const titleElement = document.getElementById("song-title");
  const artistElement = document.getElementById("song-artist");
  const albumElement = document.getElementById("song-album");
  const albumArtElement = document.getElementById("song-album-art");
  const placeholderElement = document.getElementById("song-placeholder");
  const messageElement = document.getElementById("song-message");
  const durationElement = document.getElementById("song-duration");
  const popularityElement = document.getElementById("song-popularity");
  const selectedTimeElement = document.getElementById("song-selected-time");
  const selectedByElement = document.getElementById("song-selected-by");

  if (titleElement) titleElement.textContent = song.songName || "Unknown Song";
  if (artistElement)
    artistElement.textContent = song.artist || "Unknown Artist";
  if (albumElement) albumElement.textContent = song.album || "Unknown Album";

  if (albumArtElement && song.albumArt) {
    albumArtElement.src = song.albumArt;
    albumArtElement.classList.remove("hidden");
    if (placeholderElement) placeholderElement.classList.add("hidden");
  } else if (placeholderElement) {
    placeholderElement.classList.remove("hidden");
    if (albumArtElement) albumArtElement.classList.add("hidden");
  }

  if (messageElement && song.message) {
    messageElement.textContent = song.message;
  }

  if (durationElement && song.duration) {
    durationElement.textContent = formatDuration(song.duration);
  }

  if (popularityElement && song.popularity) {
    popularityElement.textContent = `${song.popularity}% popular`;
  }

  if (selectedTimeElement && song.timestamp) {
    const timeAgo = getTimeAgo(new Date(song.timestamp));
    selectedTimeElement.textContent = `Selected ${timeAgo}`;
  }

  if (selectedByElement && song.selectedBy) {
    const byText =
      song.selectedBy === currentUser ? "by you" : "by someone special";
    selectedByElement.textContent = `Chosen with love ${byText} ✨`;
  }

  // If we have a preview URL, set up the audio player
  if (song.previewUrl) {
    setupAudioPlayer(song.previewUrl);
  }
}

// Show default song state
function showDefaultSong() {
  const songLoading = document.getElementById("song-loading");
  const songDisplay = document.getElementById("song-display");

  if (songLoading) songLoading.classList.add("hidden");
  if (songDisplay) songDisplay.classList.remove("hidden");

  const titleElement = document.getElementById("song-title");
  const artistElement = document.getElementById("song-artist");
  const albumElement = document.getElementById("song-album");
  const messageElement = document.getElementById("song-message");

  if (titleElement) titleElement.textContent = "No song selected yet";
  if (artistElement) artistElement.textContent = "Select a song to share";
  if (albumElement) albumElement.textContent = "Use the button below";
  if (messageElement)
    messageElement.textContent = "Share a special song with someone";
}

// ===== UTILITY FUNCTIONS =====

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Format duration in seconds to MM:SS
function formatDuration(durationMs) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Get time ago string
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString();
}

// Setup audio player for preview
function setupAudioPlayer(previewUrl) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  currentAudio = new Audio(previewUrl);

  const playButton = document.getElementById("play-button");
  const progressBar = document.getElementById("progress-bar");
  const currentTimeElement = document.getElementById("current-time");
  const totalTimeElement = document.getElementById("total-time");

  if (playButton) {
    playButton.innerHTML = '<span class="text-lg">▶</span>';
    playButton.onclick = togglePlayback;
  }

  currentAudio.addEventListener("loadedmetadata", function () {
    if (totalTimeElement) {
      totalTimeElement.textContent = formatDuration(
        currentAudio.duration * 1000
      );
    }
  });

  currentAudio.addEventListener("timeupdate", function () {
    if (currentTimeElement) {
      currentTimeElement.textContent = formatDuration(
        currentAudio.currentTime * 1000
      );
    }

    if (progressBar) {
      const percent = (currentAudio.currentTime / currentAudio.duration) * 100;
      progressBar.style.width = `${percent}%`;
    }
  });

  currentAudio.addEventListener("ended", function () {
    if (playButton) {
      playButton.innerHTML = '<span class="text-lg">▶</span>';
    }
    isPlaying = false;
  });
}

// Toggle audio playback
window.togglePlayback = function () {
  if (!currentAudio) return;

  const playButton = document.getElementById("play-button");

  if (isPlaying) {
    currentAudio.pause();
    if (playButton) {
      playButton.innerHTML = '<span class="text-lg">▶</span>';
    }
  } else {
    currentAudio.play();
    if (playButton) {
      playButton.innerHTML = '<span class="text-lg">⏸</span>';
    }
  }

  isPlaying = !isPlaying;
};

// Add a track to the queue
async function addToQueue(track) {
  if (!track || !track.id) {
    console.error("❌ Invalid track:", track);
    showNotification("Cannot add invalid track to queue", "error");
    return;
  }

  try {
    const apiBaseUrl = getApiBaseUrl();

    console.log(`🎵 Adding track to queue: ${track.name}`);

    const queueItem = {
      songId: track.id,
      songName: track.name,
      artist: track.artist,
      album: track.album,
      albumArt: track.albumArt,
      duration: track.duration,
      previewUrl: track.previewUrl,
      spotifyUrl: track.spotifyUrl,
      addedBy: currentUser,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(`${apiBaseUrl}/api/queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(queueItem),
    });

    if (!response.ok) {
      throw new Error(`Failed to add to queue: ${response.status}`);
    }

    showNotification(`Added "${track.name}" to queue ✨`, "success");

    // The socket event will update the queue
  } catch (error) {
    console.error("❌ Failed to add track to queue:", error);
    showNotification("Could not add track to queue", "error");
  }
}

// Clear the queue
window.clearQueue = async function () {
  if (musicQueue.length === 0) {
    showNotification("Queue is already empty", "info");
    return;
  }

  try {
    const apiBaseUrl = getApiBaseUrl();

    console.log("🎵 Clearing queue");

    const response = await fetch(`${apiBaseUrl}/api/queue/clear`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clearedBy: currentUser }),
    });

    if (!response.ok) {
      throw new Error(`Failed to clear queue: ${response.status}`);
    }

    showNotification("Queue cleared ✨", "success");

    // The socket event will update the queue
  } catch (error) {
    console.error("❌ Failed to clear queue:", error);
    showNotification("Could not clear queue", "error");
  }
};

// Shuffle the queue
window.shuffleQueue = async function () {
  if (musicQueue.length <= 1) {
    showNotification("Need at least 2 songs to shuffle", "info");
    return;
  }

  try {
    const apiBaseUrl = getApiBaseUrl();

    console.log("🎵 Shuffling queue");

    const response = await fetch(`${apiBaseUrl}/api/queue/shuffle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ shuffledBy: currentUser }),
    });

    if (!response.ok) {
      throw new Error(`Failed to shuffle queue: ${response.status}`);
    }

    showNotification("Queue shuffled 🔀", "success");

    // The socket event will update the queue
  } catch (error) {
    console.error("❌ Failed to shuffle queue:", error);
    showNotification("Could not shuffle queue", "error");
  }
};

// Export the queue as a playlist
window.exportQueue = function () {
  if (musicQueue.length === 0) {
    showNotification("Queue is empty, nothing to export", "info");
    return;
  }

  try {
    // Create a text representation of the playlist
    let playlistText = "# Where You Belong - Playlist\n\n";

    musicQueue.forEach((song, index) => {
      playlistText += `${index + 1}. ${song.songName} - ${song.artist}\n`;
    });

    playlistText += "\n---\n";
    playlistText += `Generated on ${new Date().toLocaleString()}\n`;
    playlistText += "Where You Belong - Shared with love ❤️\n";

    // Create a blob and download link
    const blob = new Blob([playlistText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "where-you-belong-playlist.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification("Playlist exported successfully ✨", "success");
  } catch (error) {
    console.error("❌ Failed to export playlist:", error);
    showNotification("Could not export playlist", "error");
  }
};
