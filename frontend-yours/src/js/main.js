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
      // Redirect to login page if not in demo mode
      if (!window.location.href.includes("?demo=true")) {
        window.location.href = "login.html";
      } else {
        initializeApp();
      }
    }
  });
});

// Check Spotify login status
async function checkLoginStatus() {
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
  // ===== INITIALIZE USER & SOCKET CONNECTION =====
  const userId = document.getElementById("user-id").dataset.user;
  const socketUrl = "http://localhost:3000"; // Change for production

  console.log(
    "%c🎵 Where You Belong - Music for someone special",
    "color: #4ecdc4; font-size: 12px;"
  );

  // Initialize Spotify Player
  window.spotifyPlayer = new SpotifyPlayer();

  // Initialize socket connection
  initializeSocket(userId, socketUrl);

  // ===== UTILITY FUNCTIONS =====

  function getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDuration(ms) {
    if (!ms) return "0:00";

    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function formatTotalDuration(totalMs) {
    if (!totalMs) return "0:00";

    const totalSeconds = Math.floor(totalMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // 🎵 NEW: Save queue settings to localStorage
  function saveQueueSettings() {
    localStorage.setItem("queueSettings", JSON.stringify(queueSettings));
    console.log("🎵 Queue settings saved:", queueSettings);
  }

  // 🎵 NEW: Load queue settings from localStorage
  function loadQueueSettings() {
    const saved = localStorage.getItem("queueSettings");
    if (saved) {
      queueSettings = { ...queueSettings, ...JSON.parse(saved) };
      updateQueueSettingsUI();
      console.log("🎵 Queue settings loaded:", queueSettings);
    }
  }

  // 🎵 NEW: Update queue settings UI
  function updateQueueSettingsUI() {
    const autoPlayToggle = document.getElementById("auto-play-toggle");
    const repeatModeSelect = document.getElementById("repeat-mode-select");
    const smartShuffleToggle = document.getElementById("smart-shuffle-toggle");

    if (autoPlayToggle) autoPlayToggle.checked = queueSettings.autoPlay;
    if (repeatModeSelect) repeatModeSelect.value = queueSettings.repeatMode;
    if (smartShuffleToggle)
      smartShuffleToggle.checked = queueSettings.smartShuffle;

    // Update repeat button icon
    updateRepeatModeIcon();
  }

  // 🎵 NEW: Update repeat mode icon
  function updateRepeatModeIcon() {
    const repeatBtn = document.getElementById("repeat-mode-btn");
    if (!repeatBtn) return;

    const icons = {
      none: "🔁",
      queue: "🔁",
      song: "🔂",
    };

    const colors = {
      none: "bg-cream-200 text-cream-600",
      queue: "bg-blue-500 text-white",
      song: "bg-green-500 text-white",
    };

    repeatBtn.innerHTML = `<span class="text-sm">${
      icons[queueSettings.repeatMode]
    }</span>`;
    repeatBtn.className = `w-10 h-10 ${
      colors[queueSettings.repeatMode]
    } hover:scale-105 rounded-full flex items-center justify-center transition-all duration-200`;
  }

  // ===== ENHANCED MUSIC PLAYER FUNCTIONS =====

  function updateCurrentSong(song) {
    const songDisplay = document.getElementById("song-display");
    const songLoading = document.getElementById("song-loading");
    const songTitle = document.getElementById("song-title");
    const songArtist = document.getElementById("song-artist");
    const songAlbum = document.getElementById("song-album");
    const songAlbumArt = document.getElementById("song-album-art");
    const songPlaceholder = document.getElementById("song-placeholder");
    const songSelectedBy = document.getElementById("song-selected-by");
    const songDuration = document.getElementById("song-duration");
    const songPopularity = document.getElementById("song-popularity");
    const songSelectedTime = document.getElementById("song-selected-time");
    const totalTime = document.getElementById("total-time");

    if (songLoading) songLoading.classList.add("hidden");
    if (songDisplay) songDisplay.classList.remove("hidden");

    if (songTitle) songTitle.textContent = song.songName;
    if (songArtist) songArtist.textContent = song.artist;
    if (songAlbum) songAlbum.textContent = song.album || "Unknown Album";
    if (songSelectedBy) {
      const selectedByText =
        song.selectedBy === currentUser ? "you" : "someone special";
      songSelectedBy.textContent = `Chosen by ${selectedByText} ✨`;
    }

    // Update song stats
    if (songDuration && song.duration) {
      const duration = formatDuration(song.duration);
      songDuration.textContent = duration;
      if (totalTime) totalTime.textContent = duration;
    }

    if (songPopularity && song.popularity) {
      songPopularity.textContent = `${song.popularity}% popular`;
    }

    if (songSelectedTime && song.selectedAt) {
      songSelectedTime.textContent = getTimeAgo(new Date(song.selectedAt));
    }

    // Update album art with smooth transition
    if (song.albumArt && songAlbumArt && songPlaceholder) {
      // Fade out current image
      songAlbumArt.style.opacity = "0";

      setTimeout(() => {
        songAlbumArt.src = song.albumArt;
        songAlbumArt.onload = () => {
          songAlbumArt.classList.remove("hidden");
          songPlaceholder.classList.add("hidden");
          // Fade in new image
          songAlbumArt.style.opacity = "1";
        };
      }, 200);
    }

    // Store current song data
    window.currentSong = song;

    // Setup audio if preview available
    setupAudioPlayer(song.previewUrl);

    // 🎵 NEW: Update analytics
    updateQueueAnalytics(song);
  }

  function showDefaultSong() {
    const songDisplay = document.getElementById("song-display");
    const songLoading = document.getElementById("song-loading");
    const songTitle = document.getElementById("song-title");
    const songArtist = document.getElementById("song-artist");
    const songSelectedBy = document.getElementById("song-selected-by");

    if (songLoading) songLoading.classList.add("hidden");
    if (songDisplay) songDisplay.classList.remove("hidden");

    if (songTitle) songTitle.textContent = "No song selected yet";
    if (songArtist) songArtist.textContent = "Choose your first comfort song";
    if (songSelectedBy)
      songSelectedBy.textContent = "Waiting for someone to choose a song ✨";
  }

  // Enhanced audio player setup
  function setupAudioPlayer(previewUrl) {
    // Stop current audio with fade out
    if (currentAudio) {
      fadeOutAudio(currentAudio, () => {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
      });
    }

    const playPauseBtn = document.getElementById("play-pause-btn");
    const musicStatusText = document.getElementById("music-status-text");
    const musicStatusDot = document.getElementById("music-status-dot");

    if (previewUrl) {
      currentAudio = new Audio(previewUrl);
      currentAudio.volume = queueSettings.crossfade ? 0 : 0.7;
      currentAudio.crossOrigin = "anonymous";

      // Enable play button
      if (playPauseBtn) {
        playPauseBtn.disabled = false;
        playPauseBtn.classList.remove("opacity-50", "cursor-not-allowed");
        playPauseBtn.classList.add("hover:scale-105");
      }

      if (musicStatusText)
        musicStatusText.textContent = "Ready to play preview";
      if (musicStatusDot) {
        musicStatusDot.classList.remove("bg-red-400");
        musicStatusDot.classList.add("bg-green-400");
      }

      // Audio event listeners
      currentAudio.addEventListener("loadedmetadata", () => {
        const totalTime = document.getElementById("total-time");
        if (totalTime && currentAudio.duration) {
          totalTime.textContent = formatDuration(currentAudio.duration * 1000);
        }
        console.log("🎵 Audio loaded, duration:", currentAudio.duration);
      });

      currentAudio.addEventListener("timeupdate", updateProgress);

      currentAudio.addEventListener("ended", () => {
        isPlaying = false;
        updatePlayPauseButton();
        resetProgress();
        if (musicStatusText) musicStatusText.textContent = "Preview ended";
        console.log("🎵 Audio ended");

        // 🎵 ENHANCED: Smart auto-play logic
        handleAudioEnd();
      });

      currentAudio.addEventListener("error", (e) => {
        console.error("🎵 Audio error:", e);
        if (musicStatusText)
          musicStatusText.textContent = "Error loading preview";
        if (musicStatusDot) {
          musicStatusDot.classList.remove("bg-green-400");
          musicStatusDot.classList.add("bg-red-400");
        }
      });

      // 🎵 NEW: Crossfade in if enabled
      if (queueSettings.crossfade) {
        fadeInAudio(currentAudio, 0.7);
      }
    } else {
      // Cek apakah lagu memiliki URL Spotify
      const hasSpotifyUrl = window.currentSong && window.currentSong.spotifyUrl;

      if (hasSpotifyUrl) {
        // Enable play button jika ada URL Spotify
        if (playPauseBtn) {
          playPauseBtn.disabled = false;
          playPauseBtn.classList.remove("opacity-50", "cursor-not-allowed");
          playPauseBtn.classList.add("hover:scale-105");
        }

        if (musicStatusText) musicStatusText.textContent = "Play in Spotify";
        if (musicStatusDot) {
          musicStatusDot.classList.remove("bg-red-400");
          musicStatusDot.classList.add("bg-orange-400");
        }

        // Tambahkan label untuk menunjukkan bahwa akan dibuka di Spotify
        const previewNotice = document.getElementById("preview-notice");
        if (!previewNotice) {
          const noticeContainer = document.createElement("div");
          noticeContainer.id = "preview-notice";
          noticeContainer.className =
            "text-center mt-2 text-sm text-orange-500";
          noticeContainer.innerHTML =
            "No preview available. Will open in Spotify.";

          const controlsContainer = document.querySelector(".mobile-controls");
          if (controlsContainer) {
            controlsContainer.parentNode.insertBefore(
              noticeContainer,
              controlsContainer.nextSibling
            );
          }
        } else {
          previewNotice.innerHTML =
            "No preview available. Will open in Spotify.";
          previewNotice.classList.remove("hidden");
        }
      } else {
        // Disable play button jika tidak ada URL Spotify
        if (playPauseBtn) {
          playPauseBtn.disabled = true;
          playPauseBtn.classList.add("opacity-50", "cursor-not-allowed");
          playPauseBtn.classList.remove("hover:scale-105");
        }

        if (musicStatusText)
          musicStatusText.textContent = "No preview available";
        if (musicStatusDot) {
          musicStatusDot.classList.remove("bg-green-400");
          musicStatusDot.classList.add("bg-red-400");
        }
      }
    }
  }

  // 🎵 NEW: Fade in audio
  function fadeInAudio(audio, targetVolume, duration = 1000) {
    const steps = 20;
    const stepTime = duration / steps;
    const volumeStep = targetVolume / steps;
    let currentStep = 0;

    const fadeInterval = setInterval(() => {
      if (currentStep >= steps) {
        clearInterval(fadeInterval);
        audio.volume = targetVolume;
        return;
      }

      audio.volume = volumeStep * currentStep;
      currentStep++;
    }, stepTime);
  }

  // 🎵 NEW: Fade out audio
  function fadeOutAudio(audio, callback, duration = 1000) {
    const steps = 20;
    const stepTime = duration / steps;
    const volumeStep = audio.volume / steps;
    let currentStep = 0;

    const fadeInterval = setInterval(() => {
      if (currentStep >= steps) {
        clearInterval(fadeInterval);
        if (callback) callback();
        return;
      }

      audio.volume = audio.volume - volumeStep;
      currentStep++;
    }, stepTime);
  }

  // 🎵 NEW: Handle audio end with smart logic
  function handleAudioEnd() {
    if (!queueSettings.autoPlay) return;

    switch (queueSettings.repeatMode) {
      case "song":
        // Repeat current song
        setTimeout(() => {
          if (currentAudio) {
            currentAudio.currentTime = 0;
            togglePlayback();
          }
        }, 500);
        break;

      case "queue":
      case "none":
        // Play next from queue
        if (musicQueue.length > 0) {
          setTimeout(() => {
            playNextFromQueue();
          }, 1000);
        } else if (queueSettings.repeatMode === "queue") {
          // If queue is empty but repeat queue is on, reload queue
          setTimeout(() => {
            reloadQueueForRepeat();
          }, 1000);
        }
        break;
    }
  }

  // 🎵 NEW: Reload queue for repeat mode
  async function reloadQueueForRepeat() {
    try {
      const response = await fetch(
        "http://localhost:3000/api/queue/history?limit=10"
      );
      const history = await response.json();

      if (history.length > 0) {
        showNotification("🔁 Repeating queue from history", "info");
        // Add recent songs back to queue
        for (const song of history.reverse()) {
          await addToQueue({
            id: song.songId,
            name: song.songName,
            artist: song.artist,
            album: song.album,
            albumArt: song.albumArt,
            previewUrl: song.previewUrl,
            spotifyUrl: song.spotifyUrl,
            duration: song.duration,
          });
        }
      }
    } catch (error) {
      console.error("Error reloading queue for repeat:", error);
    }
  }

  // Toggle playback (enhanced)
  window.togglePlayback = function () {
    if (!currentAudio) {
      // Jika tidak ada audio, cek apakah ada URL Spotify dan coba putar di Spotify
      if (window.currentSong && window.currentSong.spotifyUrl) {
        const spotifyUrl = window.currentSong.spotifyUrl;
        const duration = window.currentSong.duration || 30000; // Default 30 detik jika tidak ada durasi

        // Buka di Spotify dan mulai simulasi progress
        const simulatedAudio = spotifyPlayer.playInSpotify(
          spotifyUrl,
          duration
        );

        if (simulatedAudio) {
          // Gunakan simulatedAudio sebagai pengganti currentAudio
          currentAudio = simulatedAudio;
          isPlaying = true;

          // Setup event listeners untuk update progress
          currentAudio.addEventListener("timeupdate", updateProgress);
          currentAudio.addEventListener("ended", () => {
            isPlaying = false;
            updatePlayPauseButton();
            resetProgress();
            if (musicStatusText) musicStatusText.textContent = "Playback ended";
            console.log("🎵 Simulated playback ended");

            // Handle auto-play
            handleAudioEnd();
          });

          updatePlayPauseButton();
          updateMusicStatus();

          showNotification(
            "Playing in Spotify. Timeline will be simulated here.",
            "info"
          );
          return;
        }
      }

      showNotification(
        "No audio available. Try choosing another song.",
        "error"
      );
      return;
    }

    if (isPlaying) {
      if (queueSettings.crossfade) {
        fadeOutAudio(
          currentAudio,
          () => {
            currentAudio.pause();
          },
          500
        );
      } else {
        currentAudio.pause();
      }
      isPlaying = false;
      console.log("🎵 Audio paused");
    } else {
      const playPromise = currentAudio.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            isPlaying = true;
            console.log("🎵 Audio playing");

            // Fade in if crossfade enabled
            if (queueSettings.crossfade && currentAudio.volume < 0.7) {
              fadeInAudio(currentAudio, 0.7, 500);
            }
          })
          .catch((error) => {
            console.error("🎵 Play failed:", error);

            // Jika gagal memutar audio, coba buka di Spotify
            if (window.currentSong && window.currentSong.spotifyUrl) {
              showNotification(
                "Cannot play preview. Opening in Spotify instead.",
                "info"
              );
              spotifyPlayer.playInSpotify(
                window.currentSong.spotifyUrl,
                window.currentSong.duration || 30000
              );
            } else {
              showNotification(
                "Failed to play audio. Try clicking play again.",
                "error"
              );
            }

            isPlaying = false;
          });
      }
    }

    updatePlayPauseButton();
    updateMusicStatus();
  };

  // Update play/pause button
  function updatePlayPauseButton() {
    const playPauseIcon = document.getElementById("play-pause-icon");
    const playPauseBtn = document.getElementById("play-pause-btn");

    if (playPauseIcon) {
      playPauseIcon.textContent = isPlaying ? "⏸" : "▶";
    }

    if (playPauseBtn) {
      if (isPlaying) {
        playPauseBtn.classList.add("animate-pulse");
      } else {
        playPauseBtn.classList.remove("animate-pulse");
      }
    }
  }

  // Update music status
  function updateMusicStatus() {
    const musicStatusText = document.getElementById("music-status-text");
    const musicStatusDot = document.getElementById("music-status-dot");

    if (musicStatusText) {
      if (isPlaying) {
        musicStatusText.textContent = "Playing preview...";
      } else {
        musicStatusText.textContent = currentAudio ? "Paused" : "Ready to play";
      }
    }

    if (musicStatusDot) {
      if (isPlaying) {
        musicStatusDot.classList.remove("bg-green-400");
        musicStatusDot.classList.add("bg-blue-400");
      } else {
        musicStatusDot.classList.remove("bg-blue-400");
        musicStatusDot.classList.add("bg-green-400");
      }
    }
  }

  // Update progress bar
  function updateProgress() {
    if (!currentAudio) return;

    const progressBar = document.getElementById("progress-bar");
    const currentTimeEl = document.getElementById("current-time");

    const progress = (currentAudio.currentTime / currentAudio.duration) * 100;

    if (progressBar) {
      progressBar.style.width = progress + "%";
    }

    if (currentTimeEl) {
      currentTimeEl.textContent = formatDuration(
        currentAudio.currentTime * 1000
      );
    }
  }

  // Reset progress
  function resetProgress() {
    const progressBar = document.getElementById("progress-bar");
    const currentTimeEl = document.getElementById("current-time");

    if (progressBar) progressBar.style.width = "0%";
    if (currentTimeEl) currentTimeEl.textContent = "0:00";
  }

  // 🎵 NEW: Update queue analytics
  function updateQueueAnalytics(song) {
    queueAnalytics.songsPlayed++;

    if (song.duration) {
      queueAnalytics.totalListeningTime += song.duration;
    }

    // Track favorite artists
    if (song.artist) {
      queueAnalytics.favoriteArtists[song.artist] =
        (queueAnalytics.favoriteArtists[song.artist] || 0) + 1;
    }

    // Add to history
    queueAnalytics.queueHistory.unshift({
      song: song.songName,
      artist: song.artist,
      playedAt: new Date(),
      playedBy: song.selectedBy,
    });

    // Keep only last 50 songs in history
    if (queueAnalytics.queueHistory.length > 50) {
      queueAnalytics.queueHistory = queueAnalytics.queueHistory.slice(0, 50);
    }

    // Update analytics display
    updateAnalyticsDisplay();

    console.log("🎵 Analytics updated:", queueAnalytics);
  }

  // 🎵 NEW: Update analytics display
  function updateAnalyticsDisplay() {
    const songsPlayedEl = document.getElementById("songs-played-count");
    const listeningTimeEl = document.getElementById("listening-time-total");
    const topArtistEl = document.getElementById("top-artist-name");

    if (songsPlayedEl) {
      songsPlayedEl.textContent = queueAnalytics.songsPlayed;
    }

    if (listeningTimeEl) {
      listeningTimeEl.textContent = formatTotalDuration(
        queueAnalytics.totalListeningTime
      );
    }

    if (topArtistEl) {
      const topArtist = Object.entries(queueAnalytics.favoriteArtists).sort(
        ([, a], [, b]) => b - a
      )[0];
      topArtistEl.textContent = topArtist ? topArtist[0] : "None yet";
    }
  }

  // ===== ENHANCED QUEUE MANAGEMENT =====

  // Load and display queue
  async function loadQueue() {
    try {
      const response = await fetch("http://localhost:3000/api/queue");
      const data = await response.json();

      if (response.ok) {
        musicQueue = data.queue;
        queueStats = data.stats;
        displayQueue();
        updateQueueStats();
        updateCollaborativeStats();
        console.log(`🎵 Queue loaded: ${musicQueue.length} songs`);
      }
    } catch (error) {
      console.error("Error loading queue:", error);
      showNotification("Failed to load queue", "error");
    }
  }

  // 🎵 NEW: Update collaborative stats
  function updateCollaborativeStats() {
    queueAnalytics.collaborativeStats.yoursAdded = musicQueue.filter(
      (song) => song.addedBy === "yours"
    ).length;
    queueAnalytics.collaborativeStats.crushAdded = musicQueue.filter(
      (song) => song.addedBy === "crush"
    ).length;

    const yoursCountEl = document.getElementById("yours-added-count");
    const crushCountEl = document.getElementById("crush-added-count");

    if (yoursCountEl) {
      yoursCountEl.textContent = queueAnalytics.collaborativeStats.yoursAdded;
    }
    if (crushCountEl) {
      crushCountEl.textContent = queueAnalytics.collaborativeStats.crushAdded;
    }
  }

  // Enhanced display queue
  function displayQueue() {
    const queueContainer = document.getElementById("queue-container");
    const queueEmpty = document.getElementById("queue-empty");

    if (!queueContainer) return;

    if (musicQueue.length === 0) {
      if (queueEmpty) queueEmpty.classList.remove("hidden");
      const existingItems = queueContainer.querySelectorAll(".queue-item");
      existingItems.forEach((item) => item.remove());
      return;
    }

    if (queueEmpty) queueEmpty.classList.add("hidden");

    const existingItems = queueContainer.querySelectorAll(".queue-item");
    existingItems.forEach((item) => item.remove());

    musicQueue.forEach((song, index) => {
      const queueItem = createQueueItem(song, index);
      queueContainer.appendChild(queueItem);

      // Add entrance animation
      setTimeout(() => {
        queueItem.style.opacity = "1";
        queueItem.style.transform = "translateY(0)";
      }, index * 50);
    });
  }

  // Enhanced queue item creation
  function createQueueItem(song, index) {
    const queueItem = document.createElement("div");
    queueItem.className =
      "queue-item glass-effect rounded-lg p-4 hover:shadow-md transition-all duration-200 group opacity-0 transform translate-y-2";
    queueItem.setAttribute("data-song-id", song.songId);
    queueItem.setAttribute("data-position", song.position);
    queueItem.style.transition = "all 0.3s ease";

    const addedByText =
      song.addedBy === currentUser ? "you" : "someone special";
    const timeAgo = getTimeAgo(new Date(song.addedAt));
    const isCurrentUser = song.addedBy === currentUser;

    queueItem.innerHTML = `
      <div class="flex items-center space-x-4">
        <!-- Enhanced Position Number -->
        <div class="w-8 h-8 bg-gradient-to-br ${
          isCurrentUser
            ? "from-warm-400 to-cream-500"
            : "from-sage-400 to-blue-500"
        } rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md">
          ${song.position}
        </div>

        <!-- Enhanced Album Art -->
        <div class="w-12 h-12 bg-gradient-to-br from-warm-300 to-cream-400 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md hover:shadow-lg transition-shadow duration-200">
          ${
            song.albumArt
              ? `<img src="${song.albumArt}" alt="${escapeHtml(
                  song.album
                )}" class="w-full h-full object-cover hover:scale-110 transition-transform duration-200">`
              : `<span class="text-white text-lg">🎵</span>`
          }
        </div>

        <!-- Enhanced Song Info -->
        <div class="flex-1 min-w-0">
          <h5 class="font-bold text-cream-900 dark:text-cream-200 truncate group-hover:text-warm-700 dark:group-hover:text-warm-400 transition-colors">
            ${escapeHtml(song.songName)}
          </h5>
          <p class="text-cream-700 dark:text-cream-300 text-sm truncate">
            ${escapeHtml(song.artist)}
          </p>
          <div class="flex items-center space-x-2 mt-1 text-xs text-cream-500 dark:text-cream-500">
            <span>${
              song.duration ? formatDuration(song.duration) : "Unknown"
            }</span>
            <span>•</span>
            <span class="${
              isCurrentUser ? "text-warm-600 font-medium" : ""
            }">Added by ${addedByText}</span>
            <span>•</span>
            <span>${timeAgo}</span>
          </div>
        </div>

        <!-- Enhanced Controls -->
        <div class="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <!-- Play Now Button -->
          <button 
            onclick="playFromQueue('${song.songId}')"
            class="w-8 h-8 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white text-sm transition-all duration-200 hover:scale-110 shadow-md"
            title="Play now"
          >
            ▶
          </button>

          <!-- Move Up -->
          ${
            song.position > 1
              ? `
            <button 
              onclick="moveQueueItem('${song.songId}', 'up')"
              class="w-8 h-8 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white text-sm transition-all duration-200 hover:scale-110 shadow-md"
              title="Move up"
            >
              ↑
            </button>
          `
              : ""
          }

          <!-- Move Down -->
          ${
            song.position < musicQueue.length
              ? `
            <button 
              onclick="moveQueueItem('${song.songId}', 'down')"
              class="w-8 h-8 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white text-sm transition-all duration-200 hover:scale-110 shadow-md"
              title="Move down"
            >
              ↓
            </button>
          `
              : ""
          }

          <!-- Remove -->
          <button 
            onclick="removeFromQueue('${song.songId}')"
            class="w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-sm transition-all duration-200 hover:scale-110 shadow-md"
            title="Remove from queue"
          >
            ×
          </button>
        </div>
      </div>
    `;

    return queueItem;
  }

  // Update queue statistics
  function updateQueueStats() {
    const queueCount = document.getElementById("queue-count");
    const queueDuration = document.getElementById("queue-duration");

    if (queueCount) {
      queueCount.textContent = `${queueStats.totalSongs} song${
        queueStats.totalSongs !== 1 ? "s" : ""
      }`;
    }

    if (queueDuration) {
      queueDuration.textContent = `${formatTotalDuration(
        queueStats.totalDuration
      )} total`;
    }
  }

  // Add song to queue (enhanced with smart features)
  async function addToQueue(song) {
    try {
      const queueData = {
        songId: song.id,
        songName: song.name,
        artist: song.artist,
        album: song.album,
        albumArt: song.albumArt,
        previewUrl: song.previewUrl,
        spotifyUrl: song.spotifyUrl,
        duration: song.duration,
        addedBy: currentUser,
      };

      const response = await fetch("http://localhost:3000/api/queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(queueData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Song added to queue:", result);
        showNotification(`"${song.name}" added to queue! 🎵`, "success");

        // 🎵 NEW: Auto-add similar songs if enabled
        if (queueSettings.autoAddSimilar && Math.random() < 0.3) {
          setTimeout(() => {
            suggestSimilarSongs(song);
          }, 2000);
        }

        return result;
      } else {
        const error = await response.json();
        if (response.status === 409) {
          showNotification("Song already in queue", "error");
        } else {
          throw new Error(error.error);
        }
      }
    } catch (error) {
      console.error("❌ Error adding to queue:", error);
      showNotification("Failed to add song to queue", "error");
      throw error;
    }
  }

  // 🎵 NEW: Suggest similar songs
  async function suggestSimilarSongs(baseSong) {
    try {
      if (!spotifyPlayer) return;

      const searchQuery = `artist:${baseSong.artist}`;
      const similarTracks = await spotifyPlayer.searchTracks(searchQuery);

      if (similarTracks.length > 1) {
        const randomSimilar = similarTracks
          .filter((track) => track.id !== baseSong.id)
          .sort(() => 0.5 - Math.random())
          .slice(0, 1)[0];

        if (randomSimilar) {
          showNotification(
            `💡 Found similar song: "${randomSimilar.name}" - Add to queue?`,
            "info"
          );

          // Show suggestion notification with action
          showSuggestionNotification(randomSimilar);
        }
      }
    } catch (error) {
      console.error("Error suggesting similar songs:", error);
    }
  }

  // 🎵 NEW: Show suggestion notification
  function showSuggestionNotification(song) {
    const notification = document.createElement("div");
    notification.className =
      "fixed top-32 right-4 bg-gradient-to-r from-purple-400 to-pink-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-sm";

    notification.innerHTML = `
      <div class="flex items-center space-x-3">
        <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
          💡
        </div>
        <div class="flex-1">
          <h4 class="font-bold text-sm">Similar Song Found!</h4>
          <p class="text-xs opacity-90">"${song.name}" by ${song.artist}</p>
          <div class="flex space-x-2 mt-2">
            <button onclick="addSuggestedSong('${song.id}'); this.closest('.fixed').remove();" class="px-3 py-1 bg-white/20 rounded text-xs hover:bg-white/30 transition-colors">
              Add to Queue
            </button>
            <button onclick="this.closest('.fixed').remove();" class="px-3 py-1 bg-white/10 rounded text-xs hover:bg-white/20 transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.style.transform = "translateX(100%)";
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }
    }, 10000);
  }

  // 🎵 NEW: Add suggested song
  window.addSuggestedSong = async function (trackId) {
    try {
      const track = [
        ...(spotifyPlayer.searchResults || []),
        ...(spotifyPlayer.featuredTracks || []),
      ].find((t) => t.id === trackId);

      if (track) {
        await addToQueue(track);
        showNotification("✨ Suggested song added!", "success");
      }
    } catch (error) {
      console.error("Error adding suggested song:", error);
    }
  };

  // Remove song from queue (enhanced)
  window.removeFromQueue = async function (songId) {
    try {
      // Add removal animation
      const queueItem = document.querySelector(`[data-song-id="${songId}"]`);
      if (queueItem) {
        queueItem.style.transform = "translateX(-100%)";
        queueItem.style.opacity = "0";
      }

      const response = await fetch(
        `http://localhost:3000/api/queue/${songId}?userId=${currentUser}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        console.log("✅ Song removed from queue");
        showNotification("Song removed from queue", "success");
      } else {
        // Revert animation if failed
        if (queueItem) {
          queueItem.style.transform = "translateX(0)";
          queueItem.style.opacity = "1";
        }
        throw new Error("Failed to remove song");
      }
    } catch (error) {
      console.error("❌ Error removing from queue:", error);
      showNotification("Failed to remove song from queue", "error");
    }
  };

  // Play song from queue (enhanced)
  window.playFromQueue = async function (songId) {
    try {
      showNotification("🎵 Loading song...", "info");

      const response = await fetch("http://localhost:3000/api/queue/next", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playedBy: currentUser }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Playing from queue:", result);
        showNotification(
          `Now playing: ${result.newCurrentSong.songName}! 🎵`,
          "success"
        );

        // Smooth scroll to music section
        setTimeout(() => {
          scrollToSection("music");
        }, 1000);
      } else {
        throw new Error("Failed to play from queue");
      }
    } catch (error) {
      console.error("❌ Error playing from queue:", error);
      showNotification("Failed to play song from queue", "error");
    }
  };

  // Play next song from queue (enhanced)
  window.playNextFromQueue = async function () {
    try {
      const response = await fetch("http://localhost:3000/api/queue/next", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playedBy: currentUser }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Playing next from queue:", result);
        showNotification(
          `Auto-playing next: ${result.newCurrentSong.songName}! 🎵`,
          "success"
        );
      } else {
        const error = await response.json();
        if (response.status === 404) {
          showNotification("Queue is empty", "info");

          // If repeat queue is enabled, try to reload
          if (queueSettings.repeatMode === "queue") {
            reloadQueueForRepeat();
          }
        } else {
          throw new Error(error.error);
        }
      }
    } catch (error) {
      console.error("❌ Error playing next from queue:", error);
      showNotification("Failed to play next song", "error");
    }
  };

  // Move queue item (enhanced with animation)
  window.moveQueueItem = async function (songId, direction) {
    try {
      const songIndex = musicQueue.findIndex((song) => song.songId === songId);
      if (songIndex === -1) return;

      const newQueue = [...musicQueue];
      const targetIndex = direction === "up" ? songIndex - 1 : songIndex + 1;

      if (targetIndex < 0 || targetIndex >= newQueue.length) return;

      // Add visual feedback
      const queueItem = document.querySelector(`[data-song-id="${songId}"]`);
      if (queueItem) {
        queueItem.style.transform =
          direction === "up" ? "translateY(-20px)" : "translateY(20px)";
        setTimeout(() => {
          queueItem.style.transform = "translateY(0)";
        }, 200);
      }

      // Swap positions
      [newQueue[songIndex], newQueue[targetIndex]] = [
        newQueue[targetIndex],
        newQueue[songIndex],
      ];

      // Update positions
      newQueue.forEach((song, index) => {
        song.position = index + 1;
      });

      const response = await fetch("http://localhost:3000/api/queue/reorder", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reorderedQueue: newQueue,
          userId: currentUser,
        }),
      });

      if (response.ok) {
        console.log("✅ Queue reordered");
      } else {
        throw new Error("Failed to reorder queue");
      }
    } catch (error) {
      console.error("❌ Error moving queue item:", error);
      showNotification("Failed to reorder queue", "error");
    }
  };

  // Clear entire queue (enhanced)
  window.clearQueue = async function () {
    if (musicQueue.length === 0) {
      showNotification("Queue is already empty", "info");
      return;
    }

    const confirmed = await showConfirmDialog(
      "Clear Queue",
      `Are you sure you want to clear all ${musicQueue.length} songs from the queue?`,
      "Clear",
      "Cancel"
    );

    if (!confirmed) return;

    try {
      // Add clearing animation
      const queueItems = document.querySelectorAll(".queue-item");
      queueItems.forEach((item, index) => {
        setTimeout(() => {
          item.style.transform = "translateX(-100%)";
          item.style.opacity = "0";
        }, index * 50);
      });

      const response = await fetch(
        `http://localhost:3000/api/queue?userId=${currentUser}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        console.log("✅ Queue cleared");
        showNotification("Queue cleared successfully", "success");
      } else {
        throw new Error("Failed to clear queue");
      }
    } catch (error) {
      console.error("❌ Error clearing queue:", error);
      showNotification("Failed to clear queue", "error");
    }
  };

  // Smart shuffle queue
  window.shuffleQueue = async function () {
    if (musicQueue.length <= 1) {
      showNotification("Need at least 2 songs to shuffle", "info");
      return;
    }

    try {
      // Add shuffle animation
      const queueContainer = document.getElementById("queue-container");
      if (queueContainer) {
        queueContainer.style.transform = "scale(0.95)";
        queueContainer.style.opacity = "0.7";

        setTimeout(() => {
          queueContainer.style.transform = "scale(1)";
          queueContainer.style.opacity = "1";
        }, 300);
      }

      const response = await fetch("http://localhost:3000/api/queue/shuffle", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: currentUser,
          smartShuffle: queueSettings.smartShuffle,
        }),
      });

      if (response.ok) {
        console.log("✅ Queue shuffled");
        const shuffleType = queueSettings.smartShuffle
          ? "Smart shuffled"
          : "Shuffled";
        showNotification(`${shuffleType} queue! 🔀`, "success");
      } else {
        throw new Error("Failed to shuffle queue");
      }
    } catch (error) {
      console.error("❌ Error shuffling queue:", error);
      showNotification("Failed to shuffle queue", "error");
    }
  };

  // Enhanced export queue
  window.exportQueue = async function () {
    if (musicQueue.length === 0) {
      showNotification("Queue is empty, nothing to export", "info");
      return;
    }

    try {
      showNotification("📤 Preparing export...", "info");

      const response = await fetch("http://localhost:3000/api/queue/export");

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `where-you-belong-playlist-${
          new Date().toISOString().split("T")[0]
        }.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showNotification(
          `Playlist exported! 📤 (${musicQueue.length} songs)`,
          "success"
        );
        console.log("✅ Queue exported");
      } else {
        throw new Error("Failed to export queue");
      }
    } catch (error) {
      console.error("❌ Error exporting queue:", error);
      showNotification("Failed to export playlist", "error");
    }
  };

  // 🎵 NEW: Toggle repeat mode
  window.toggleRepeatMode = function () {
    const modes = ["none", "queue", "song"];
    const currentIndex = modes.indexOf(queueSettings.repeatMode);
    const nextIndex = (currentIndex + 1) % modes.length;

    queueSettings.repeatMode = modes[nextIndex];
    updateRepeatModeIcon();
    saveQueueSettings();

    const modeNames = {
      none: "Off",
      queue: "Repeat Queue",
      song: "Repeat Song",
    };

    showNotification(
      `🔁 Repeat: ${modeNames[queueSettings.repeatMode]}`,
      "info"
    );
  };

  // 🎵 NEW: Toggle auto-play
  window.toggleAutoPlay = function () {
    queueSettings.autoPlay = !queueSettings.autoPlay;
    saveQueueSettings();

    const autoPlayToggle = document.getElementById("auto-play-toggle");
    if (autoPlayToggle) autoPlayToggle.checked = queueSettings.autoPlay;

    showNotification(
      `🎵 Auto-play: ${queueSettings.autoPlay ? "On" : "Off"}`,
      "info"
    );
  };

  // 🎵 NEW: Toggle smart shuffle
  window.toggleSmartShuffle = function () {
    queueSettings.smartShuffle = !queueSettings.smartShuffle;
    saveQueueSettings();

    const smartShuffleToggle = document.getElementById("smart-shuffle-toggle");
    if (smartShuffleToggle)
      smartShuffleToggle.checked = queueSettings.smartShuffle;

    showNotification(
      `🧠 Smart shuffle: ${queueSettings.smartShuffle ? "On" : "Off"}`,
      "info"
    );
  };

  // 🎵 NEW: Show confirm dialog
  function showConfirmDialog(title, message, confirmText, cancelText) {
    return new Promise((resolve) => {
      const dialog = document.createElement("div");
      dialog.className =
        "fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4";

      dialog.innerHTML = `
        <div class="bg-white dark:bg-cream-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
          <h3 class="text-xl font-bold text-cream-900 dark:text-cream-200 mb-4">${title}</h3>
          <p class="text-cream-700 dark:text-cream-300 mb-6">${message}</p>
          <div class="flex space-x-3 justify-end">
            <button id="cancel-btn" class="px-4 py-2 bg-cream-200 dark:bg-cream-700 text-cream-700 dark:text-cream-300 rounded-lg hover:bg-cream-300 dark:hover:bg-cream-600 transition-colors">
              ${cancelText}
            </button>
            <button id="confirm-btn" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
              ${confirmText}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);

      dialog.querySelector("#cancel-btn").onclick = () => {
        document.body.removeChild(dialog);
        resolve(false);
      };

      dialog.querySelector("#confirm-btn").onclick = () => {
        document.body.removeChild(dialog);
        resolve(true);
      };

      dialog.onclick = (e) => {
        if (e.target === dialog) {
          document.body.removeChild(dialog);
          resolve(false);
        }
      };
    });
  }

  // ===== SOCKET.IO CONNECTION (Enhanced) =====
  function initializeApp() {
    const userElement = document.getElementById("user-id");
    currentUser = userElement ? userElement.dataset.user : "yours";

    console.log(`🔌 Initializing as user: ${currentUser}`);

    // Load queue settings
    loadQueueSettings();

    initializeSocket();
    initializeUI();
    loadInitialData();
    loadQueue();

    setTimeout(() => {
      initializeSpotify();
    }, 1000);
  }

  function initializeSocket() {
    socket = io("http://localhost:3000", {
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

  // ===== MESSAGING SYSTEM (Existing code continues...) =====

  async function loadInitialData() {
    try {
      showLoadingState();

      const response = await fetch(
        `http://localhost:3000/api/messages/${currentUser}`
      );
      const allMessages = await response.json();

      const receivedMessages = allMessages.filter(
        (msg) => msg.recipient === currentUser
      );

      console.log(
        `📬 Loaded ${receivedMessages.length} received messages for ${currentUser}`
      );
      displayMessages(receivedMessages);

      const songResponse = await fetch(
        "http://localhost:3000/api/current-song"
      );
      const currentSong = await songResponse.json();
      if (currentSong) {
        updateCurrentSong(currentSong);
      } else {
        showDefaultSong();
      }
    } catch (error) {
      console.error("Error loading initial data:", error);
      showNotification(
        "Failed to load data. Please refresh the page.",
        "error"
      );
    }
  }

  function showLoadingState() {
    const lettersLoading = document.getElementById("letters-loading");
    const songLoading = document.getElementById("song-loading");

    if (lettersLoading) lettersLoading.classList.remove("hidden");
    if (songLoading) songLoading.classList.remove("hidden");
  }

  async function sendMessage(content) {
    if (!content.trim()) return;

    const messageData = {
      content: content.trim(),
      sender: currentUser,
      recipient: currentUser === "yours" ? "crush" : "yours",
    };

    try {
      const response = await fetch("http://localhost:3000/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageData),
      });

      if (response.ok) {
        const message = await response.json();
        console.log("✅ Message sent successfully:", message);
        return message;
      } else {
        throw new Error("Failed to send message");
      }
    } catch (error) {
      console.error("❌ Error sending message:", error);
      showNotification("Failed to send message. Please try again.", "error");
      throw error;
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
      await fetch(`http://localhost:3000/api/messages/${messageId}/read`, {
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

  function initializeSpotify() {
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

      showNotification(
        `"${track.name}" is now your comfort song! 🎵`,
        "success"
      );

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

  document
    .getElementById("music-modal")
    ?.addEventListener("click", function (e) {
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
        <span>${
          type === "success" ? "✅" : type === "error" ? "⚠️" : "ℹ️"
        }</span>
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

  function initializeUI() {
    const mobileMenuBtn = document.getElementById("mobile-menu-btn");
    const mobileMenu = document.getElementById("mobile-menu");

    if (mobileMenuBtn && mobileMenu) {
      mobileMenuBtn.addEventListener("click", function () {
        mobileMenu.classList.toggle("hidden");
      });
    }

    window.scrollToSection = function (sectionId) {
      const section = document.getElementById(sectionId);
      if (section) {
        section.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        if (mobileMenu) {
          mobileMenu.classList.add("hidden");
        }
      }
    };

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
}
