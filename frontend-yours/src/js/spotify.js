// ===== SPOTIFY INTEGRATION MODULE =====

class SpotifyPlayer {
  constructor() {
    this.currentTrack = null;
    this.isPlaying = false;
    this.searchResults = [];
    this.featuredTracks = [];
    this.player = null;
    this.deviceId = null;
    this.currentPreview = null;
    this.simulatedProgress = null; // Untuk simulasi progress ketika tidak ada preview
    this.listeningActivityInterval = null; // Interval untuk update listening activity

    this.initializeSpotifySDK();
    this.loadFeaturedTracks();
    this.initializeListeningActivity();
  }

  // Initialize Spotify Web Playback SDK
  initializeSpotifySDK() {
    // Check for auth data
    const authData = JSON.parse(
      localStorage.getItem("spotify_auth_data") || "null"
    );

    // Only proceed if we have valid auth data
    if (!authData || !authData.accessToken) {
      console.log("🎵 No Spotify auth data, using preview mode");
      return;
    }

    // Load Spotify Web Playback SDK script if needed
    if (!window.Spotify) {
      this.loadSpotifyScript();
    } else {
      this.setupPlayer(authData.accessToken);
    }
  }

  // Initialize listening activity feature
  initializeListeningActivity() {
    // Check for auth data
    const authData = JSON.parse(
      localStorage.getItem("spotify_auth_data") || "null"
    );

    // Only proceed if we have valid auth data
    if (!authData || !authData.accessToken) {
      console.log("🎵 No Spotify auth data for listening activity");
      this.showLoginPromptInListeningActivity();
      return;
    }

    // Start polling for currently playing track
    this.startListeningActivityPolling(authData.accessToken);
  }

  // Start polling for currently playing track
  startListeningActivityPolling(accessToken) {
    // Clear any existing interval
    if (this.listeningActivityInterval) {
      clearInterval(this.listeningActivityInterval);
    }

    // Initial fetch
    this.fetchCurrentlyPlaying(accessToken);

    // Set up polling every 10 seconds
    this.listeningActivityInterval = setInterval(() => {
      this.fetchCurrentlyPlaying(accessToken);
    }, 10000); // 10 seconds
  }

  // Fetch currently playing track from Spotify
  async fetchCurrentlyPlaying(accessToken) {
    try {
      const response = await fetch(
        `http://localhost:3000/api/spotify/currently-playing?access_token=${accessToken}`
      );

      // Handle token expiration
      if (response.status === 401) {
        console.log("🎵 Spotify token expired, refreshing...");
        this.refreshToken();
        return;
      }

      const data = await response.json();

      // Update the UI with the currently playing track
      this.updateListeningActivityUI(data);
    } catch (error) {
      console.error("❌ Error fetching currently playing track:", error);
      // Show error in the listening activity section
      this.showListeningActivityError();
    }
  }

  // Update the UI with currently playing track
  updateListeningActivityUI(data) {
    const listeningActivityContainer =
      document.getElementById("listening-activity");

    if (!listeningActivityContainer) {
      console.log("Listening activity container not found");
      return;
    }

    // If no track is playing
    if (!data.isPlaying || !data.track) {
      listeningActivityContainer.innerHTML = `
        <div class="p-4 bg-gray-800 rounded-lg">
          <div class="flex items-center">
            <div class="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
              <i class="fas fa-music text-gray-400"></i>
            </div>
            <div class="ml-3">
              <p class="text-white text-sm">Not playing</p>
              <p class="text-gray-400 text-xs">Spotify</p>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Format time
    const formatTime = (ms) => {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    const currentTime = formatTime(data.progress_ms);
    const totalTime = formatTime(data.track.duration_ms);
    const progressPercentage =
      (data.progress_ms / data.track.duration_ms) * 100;

    // Update the UI with the track info
    listeningActivityContainer.innerHTML = `
      <div class="p-4 bg-gray-800 rounded-lg">
        <div class="text-sm text-gray-300 mb-2">
          <span class="flex items-center">
            <span class="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            Listening to Spotify
          </span>
        </div>
        <div class="flex items-center">
          <img src="${data.track.albumArt}" alt="${data.track.album}" class="w-12 h-12 rounded">
          <div class="ml-3">
            <p class="text-white text-sm font-medium">${data.track.name}</p>
            <p class="text-gray-400 text-xs">${data.track.artist}</p>
            <div class="mt-1">
              <div class="w-32 bg-gray-700 rounded-full h-1">
                <div class="bg-green-500 h-1 rounded-full" style="width: ${progressPercentage}%"></div>
              </div>
              <div class="flex justify-between text-xs text-gray-400 mt-1">
                <span>${currentTime}</span>
                <span>${totalTime}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-2">
          <a href="${data.track.spotifyUrl}" target="_blank" class="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white text-xs py-1 px-3 rounded-full w-full">
            <i class="fab fa-spotify mr-1"></i> Play on Spotify
          </a>
        </div>
      </div>
    `;
  }

  // Show login prompt in listening activity section
  showLoginPromptInListeningActivity() {
    const listeningActivityContainer =
      document.getElementById("listening-activity");

    if (!listeningActivityContainer) return;

    listeningActivityContainer.innerHTML = `
      <div class="p-4 bg-gray-800 rounded-lg">
        <div class="flex items-center">
          <div class="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
            <i class="fab fa-spotify text-gray-400 text-xl"></i>
          </div>
          <div class="ml-3">
            <p class="text-white text-sm">Connect with Spotify</p>
            <p class="text-gray-400 text-xs mb-2">to show your listening activity</p>
            <button id="spotify-login-btn" class="bg-green-600 hover:bg-green-700 text-white text-xs py-1 px-3 rounded-full">
              Connect
            </button>
          </div>
        </div>
      </div>
    `;

    // Add event listener to the login button
    const loginBtn = document.getElementById("spotify-login-btn");
    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        // Use the main login endpoint with user_type parameter
        window.location.href = "http://localhost:3000/login?user_type=yours";
      });
    }
  }

  // Show error in listening activity section
  showListeningActivityError() {
    const listeningActivityContainer =
      document.getElementById("listening-activity");

    if (!listeningActivityContainer) return;

    listeningActivityContainer.innerHTML = `
      <div class="p-4 bg-gray-800 rounded-lg">
        <div class="flex items-center">
          <div class="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
            <i class="fas fa-exclamation-triangle text-yellow-500"></i>
          </div>
          <div class="ml-3">
            <p class="text-white text-sm">Connection Error</p>
            <p class="text-gray-400 text-xs">Unable to connect to Spotify</p>
            <button id="retry-spotify-btn" class="mt-2 bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-3 rounded-full">
              Retry
            </button>
          </div>
        </div>
      </div>
    `;

    // Add event listener to the retry button
    const retryBtn = document.getElementById("retry-spotify-btn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        const authData = JSON.parse(
          localStorage.getItem("spotify_auth_data") || "null"
        );
        if (authData && authData.accessToken) {
          this.fetchCurrentlyPlaying(authData.accessToken);
        } else {
          this.showLoginPromptInListeningActivity();
        }
      });
    }
  }

  // Refresh token when expired
  async refreshToken() {
    try {
      const authData = JSON.parse(
        localStorage.getItem("spotify_auth_data") || "null"
      );

      if (!authData || !authData.refreshToken) {
        console.log("No refresh token available");
        this.showLoginPromptInListeningActivity();
        return;
      }

      const response = await fetch("http://localhost:3000/refresh_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: authData.refreshToken }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update stored token
        authData.accessToken = data.access_token;
        localStorage.setItem("spotify_auth_data", JSON.stringify(authData));

        // Restart polling with new token
        this.startListeningActivityPolling(data.access_token);
        console.log("Token refreshed successfully");
      } else {
        console.error("Failed to refresh token:", data.error);
        this.showLoginPromptInListeningActivity();
      }
    } catch (error) {
      console.error("Error refreshing token:", error);
      this.showLoginPromptInListeningActivity();
    }
  }

  // Stop listening activity polling
  stopListeningActivityPolling() {
    if (this.listeningActivityInterval) {
      clearInterval(this.listeningActivityInterval);
      this.listeningActivityInterval = null;
      console.log("Listening activity polling stopped");
    }
  }

  // Load Spotify Web Playback SDK script
  loadSpotifyScript() {
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;

    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const authData = JSON.parse(
        localStorage.getItem("spotify_auth_data") || "null"
      );
      if (authData && authData.accessToken) {
        this.setupPlayer(authData.accessToken);
      }
    };
  }

  // Setup player with Spotify Web Playback SDK
  setupPlayer(token) {
    const player = new window.Spotify.Player({
      name: "Where You Belong Web Player",
      getOAuthToken: (cb) => cb(token),
      volume: 0.5,
    });

    // Error handling
    player.addListener("initialization_error", ({ message }) => {
      console.error("Failed to initialize Spotify player:", message);
    });

    player.addListener("authentication_error", ({ message }) => {
      console.error("Failed to authenticate with Spotify:", message);
    });

    player.addListener("account_error", ({ message }) => {
      console.log("Non-premium account cannot use Web Playback SDK:", message);
    });

    player.addListener("playback_error", ({ message }) => {
      console.error("Playback error:", message);
    });

    // Playback status updates
    player.addListener("player_state_changed", (state) => {
      if (state) {
        console.log("Spotify playback state updated");
        this.updatePlayerState(state);
      }
    });

    // Ready
    player.addListener("ready", ({ device_id }) => {
      console.log("Spotify Web Playback SDK ready with device ID:", device_id);
      this.deviceId = device_id;
      this.player = player;
    });

    // Not Ready
    player.addListener("not_ready", ({ device_id }) => {
      console.log("Device ID is not ready for playback:", device_id);
      this.deviceId = null;
    });

    // Connect to Spotify
    player.connect();
  }

  // Update player state based on Spotify state
  updatePlayerState(state) {
    // If no track, return
    if (!state.track_window || !state.track_window.current_track) {
      return;
    }

    const { current_track } = state.track_window;

    // Update UI if needed
    if (window.currentSong && window.currentSong.id === current_track.id) {
      // Update play state
      window.isPlaying = !state.paused;

      // Update UI elements
      const playPauseBtn = document.getElementById("play-pause-btn");
      if (playPauseBtn) {
        playPauseBtn.innerHTML = state.paused
          ? '<i class="fas fa-play"></i>'
          : '<i class="fas fa-pause"></i>';
      }

      // Update music status
      const musicStatusText = document.getElementById("music-status-text");
      if (musicStatusText) {
        musicStatusText.textContent = state.paused ? "Paused" : "Now Playing";
      }

      const musicStatusDot = document.getElementById("music-status-dot");
      if (musicStatusDot) {
        if (state.paused) {
          musicStatusDot.classList.remove("animate-pulse");
        } else {
          musicStatusDot.classList.add("animate-pulse");
        }
      }

      // Update progress bar if applicable
      if (!state.paused) {
        const progressBar = document.getElementById("progress-bar");
        if (progressBar) {
          const percentage = (state.position / state.duration) * 100;
          progressBar.style.width = `${percentage}%`;
        }
      }
    }
  }

  // Search Spotify tracks
  async searchTracks(query) {
    try {
      if (!query.trim()) return [];

      console.log(`🔍 Searching Spotify: "${query}"`);

      const response = await fetch(
        `http://localhost:3000/api/spotify/search?q=${encodeURIComponent(
          query
        )}&limit=20`
      );
      const data = await response.json();

      if (response.ok) {
        this.searchResults = data.tracks;
        console.log(`✅ Found ${data.tracks.length} tracks`);
        return data.tracks;
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("❌ Spotify search error:", error);
      throw error;
    }
  }

  // Load featured/recommended tracks
  async loadFeaturedTracks() {
    try {
      console.log("🎵 Loading featured tracks...");

      const response = await fetch(
        "http://localhost:3000/api/spotify/featured"
      );
      const data = await response.json();

      if (response.ok) {
        this.featuredTracks = data.tracks;
        console.log(`✅ Loaded ${data.tracks.length} featured tracks`);
        return data.tracks;
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("❌ Featured tracks error:", error);
      return [];
    }
  }

  // Select song as current comfort song
  async selectSong(track, selectedBy) {
    try {
      console.log(`🎵 Selecting song: ${track.name} - ${track.artist}`);

      const songData = {
        spotifyId: track.id,
        songName: track.name,
        artist: track.artist,
        album: track.album,
        albumArt: track.albumArt,
        previewUrl: track.previewUrl,
        spotifyUrl: track.spotifyUrl,
        selectedBy: selectedBy,
        duration: track.duration,
      };

      const response = await fetch(
        "http://localhost:3000/api/current-song/spotify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(songData),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Song selected successfully");
        return result;
      } else {
        throw new Error("Failed to select song");
      }
    } catch (error) {
      console.error("❌ Select song error:", error);
      throw error;
    }
  }

  // Play preview
  playPreview(previewUrl) {
    // Stop current preview
    this.stopPreview();

    if (!previewUrl) {
      console.warn("⚠️ No preview available for this track");
      return null;
    }

    this.currentPreview = new Audio(previewUrl);
    this.currentPreview.volume = 0.7;
    this.currentPreview.play();

    console.log("▶️ Playing preview");
    return this.currentPreview;
  }

  // Stop preview
  stopPreview() {
    if (this.currentPreview) {
      this.currentPreview.pause();
      this.currentPreview = null;
      console.log("⏸️ Preview stopped");
    }

    // Juga hentikan simulasi progress jika sedang berjalan
    this.stopSimulatedProgress();
  }

  // Play a track in Spotify and simulate progress
  playInSpotify(spotifyUrl, duration = 30000) {
    // Get current auth data if available
    const authData = JSON.parse(
      localStorage.getItem("spotify_auth_data") || "null"
    );

    // If we have valid auth data and the Spotify Web Playback SDK is loaded
    if (authData && authData.accessToken && window.Spotify && this.deviceId) {
      // Try to play directly in the web app using Spotify API
      fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${authData.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uris: [spotifyUrl],
          }),
        }
      )
        .then((response) => {
          if (response.ok) {
            console.log("Playing directly in web app via Spotify API");
            return;
          } else {
            // If API fails, fall back to opening Spotify
            this.openSpotifyAndSimulate(spotifyUrl, duration);
          }
        })
        .catch((error) => {
          console.error("Error playing via Spotify API:", error);
          this.openSpotifyAndSimulate(spotifyUrl, duration);
        });
    } else {
      // Fall back to opening in Spotify app/web player
      this.openSpotifyAndSimulate(spotifyUrl, duration);
    }

    // Return the simulated audio object for consistent interface
    return this.startSimulatedProgress(duration);
  }

  // Open in Spotify app or web player
  openSpotifyAndSimulate(spotifyUrl, duration) {
    // Convert API URL to app/web URL if needed
    let playableUrl = spotifyUrl;
    if (spotifyUrl.includes("spotify:track:")) {
      playableUrl = spotifyUrl;
    } else if (spotifyUrl.includes("/tracks/")) {
      const trackId = spotifyUrl.split("/tracks/")[1].split("?")[0];
      playableUrl = `spotify:track:${trackId}`;
    }

    // Open Spotify
    window.open(playableUrl, "_blank");
    console.log("Opening in Spotify:", playableUrl);

    // Return the simulated audio for UI updates
    return this.startSimulatedProgress(duration);
  }

  // Mulai simulasi progress untuk lagu yang diputar di Spotify
  startSimulatedProgress(duration) {
    // Hentikan simulasi yang sedang berjalan
    this.stopSimulatedProgress();

    const totalDuration = duration; // dalam milidetik
    const startTime = Date.now();
    const updateInterval = 500; // Update setiap 500ms

    // Buat event untuk simulasi progress
    const simulatedAudio = new EventTarget();
    simulatedAudio.duration = totalDuration / 1000; // dalam detik
    simulatedAudio.currentTime = 0;

    // Simpan interval ID untuk dihentikan nanti
    this.simulatedProgress = setInterval(() => {
      const elapsedTime = Date.now() - startTime;
      const progressSeconds = elapsedTime / 1000;

      // Update currentTime
      simulatedAudio.currentTime = progressSeconds;

      // Dispatch timeupdate event
      const event = new Event("timeupdate");
      simulatedAudio.dispatchEvent(event);

      // Jika sudah selesai, hentikan simulasi dan trigger ended event
      if (elapsedTime >= totalDuration) {
        this.stopSimulatedProgress();
        const endedEvent = new Event("ended");
        simulatedAudio.dispatchEvent(endedEvent);
      }
    }, updateInterval);

    console.log("▶️ Started simulated progress for Spotify playback");
    return simulatedAudio;
  }

  // Hentikan simulasi progress
  stopSimulatedProgress() {
    if (this.simulatedProgress) {
      clearInterval(this.simulatedProgress);
      this.simulatedProgress = null;
      console.log("⏸️ Stopped simulated progress");
    }
  }

  // Get curated tracks for the app
  getCuratedTracks() {
    // Curated list of artists that fit the app's vibe
    const curatedArtists = [
      "LANY",
      "Taylor Swift",
      "Keshi",
      "NIKI",
      "Clairo",
      "Rex Orange County",
      "Boy Pablo",
      "The 1975",
      "Conan Gray",
      "Phoebe Bridgers",
    ];

    return curatedArtists;
  }
}

// Export for use in main.js
window.SpotifyPlayer = SpotifyPlayer;
