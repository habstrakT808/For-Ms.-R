// ===== ENHANCED MAIN JAVASCRIPT =====

document.addEventListener("DOMContentLoaded", function () {
  // ===== NAVIGATION & BASIC FUNCTIONALITY =====

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener("click", function () {
      mobileMenu.classList.toggle("hidden");
    });
  }

  // Smooth scroll function
  window.scrollToSection = function (sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      // Close mobile menu if open
      if (mobileMenu) {
        mobileMenu.classList.add("hidden");
      }
    }
  };

  // Enhanced navigation scroll effects
  const nav = document.querySelector("nav");
  const navLinks = document.querySelectorAll(".nav-link");

  window.addEventListener("scroll", function () {
    const scrollY = window.scrollY;

    // Navigation background effect
    if (scrollY > 100) {
      nav.classList.add("bg-white/90", "shadow-lg");
      nav.classList.remove("bg-white/20");
    } else {
      nav.classList.add("bg-white/20");
      nav.classList.remove("bg-white/90", "shadow-lg");
    }

    // Active navigation highlighting
    const sections = ["home", "music", "letters", "sanctuary", "bottles"];
    sections.forEach((sectionId) => {
      const section = document.getElementById(sectionId);
      const navLink = document.querySelector(`a[href="#${sectionId}"]`);

      if (section && navLink) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= 100 && rect.bottom >= 100) {
          navLinks.forEach((link) => link.classList.remove("active"));
          navLink.classList.add("active");
        }
      }
    });
  });

  // Smooth scroll for all navigation links
  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href").substring(1);
      scrollToSection(targetId);
    });
  });

  // ===== MUSIC PLAYER FUNCTIONALITY =====

  let isPlaying = false;
  let currentProgress = 33; // Start at 33% (2:34 of 3:42)

  const playBtn = document.getElementById("play-btn");
  const playIcon = document.getElementById("play-icon");
  const progressBar = document.getElementById("progress-bar");
  const progress = document.getElementById("progress");

  // Play/Pause functionality
  if (playBtn) {
    playBtn.addEventListener("click", function () {
      isPlaying = !isPlaying;
      if (isPlaying) {
        playIcon.textContent = "⏸";
        startProgressAnimation();
        showMusicNotification("Now Playing: You Belong With Me - Taylor Swift");
      } else {
        playIcon.textContent = "▶";
        stopProgressAnimation();
      }
    });
  }

  // Progress bar click functionality
  if (progressBar) {
    progressBar.addEventListener("click", function (e) {
      const rect = this.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = (clickX / rect.width) * 100;
      currentProgress = Math.max(0, Math.min(100, percentage));
      updateProgress();
    });
  }

  let progressInterval;

  function startProgressAnimation() {
    progressInterval = setInterval(() => {
      if (currentProgress < 100) {
        currentProgress += 0.5; // Slow progress
        updateProgress();
      } else {
        // Song ended
        isPlaying = false;
        playIcon.textContent = "▶";
        currentProgress = 0;
        updateProgress();
        clearInterval(progressInterval);
        showMusicNotification("Song ended ✨");
      }
    }, 1000);
  }

  function stopProgressAnimation() {
    clearInterval(progressInterval);
  }

  function updateProgress() {
    if (progress) {
      progress.style.width = currentProgress + "%";
    }
  }

  function showMusicNotification(message) {
    // Create notification element
    const notification = document.createElement("div");
    notification.className =
      "fixed top-20 right-4 bg-gradient-to-r from-warm-400 to-cream-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300";
    notification.innerHTML = `
            <div class="flex items-center space-x-2">
                <span>🎵</span>
                <span class="text-sm font-medium">${message}</span>
            </div>
        `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.classList.remove("translate-x-full");
    }, 100);

    // Animate out and remove
    setTimeout(() => {
      notification.classList.add("translate-x-full");
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  // ===== DAILY SANCTUARY FUNCTIONALITY =====

  // Mood tracking
  const moodBtns = document.querySelectorAll(".mood-btn");
  moodBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      // Remove active class from all buttons
      moodBtns.forEach((b) => {
        b.classList.remove("bg-sage-400", "text-white");
        b.classList.add("bg-cream-100", "text-cream-800");
      });

      // Add active class to clicked button
      this.classList.remove("bg-cream-100", "text-cream-800");
      this.classList.add("bg-sage-400", "text-white");

      // Show encouraging message
      const mood = this.textContent.trim();
      showSanctuaryMessage(getMoodResponse(mood));
    });
  });

  function getMoodResponse(mood) {
    const responses = {
      "😊 Peaceful":
        "I'm so glad you're feeling peaceful today. Your calm energy is beautiful. 🌸",
      "😔 Overwhelmed":
        "It's okay to feel overwhelmed sometimes. Take it one breath at a time. You're stronger than you know. 💝",
      "💭 Thoughtful":
        "Your thoughtful nature is one of the things I admire most about you. Deep thinkers change the world. ✨",
      "✨ Hopeful":
        "Hope looks beautiful on you. Keep that light shining - the world needs your optimism. 🌟",
    };
    return (
      responses[mood] ||
      "Thank you for sharing how you feel. You're not alone. 💕"
    );
  }

  function showSanctuaryMessage(message) {
    const notification = document.createElement("div");
    notification.className =
      "fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-gradient-to-r from-sage-400 to-warm-400 text-white p-4 rounded-lg shadow-lg z-50 transform translate-y-full transition-transform duration-300";
    notification.innerHTML = `
            <div class="flex items-start space-x-3">
                <span class="text-xl">🤗</span>
                <div class="flex-1">
                    <p class="text-sm font-medium">${message}</p>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="text-white/80 hover:text-white">×</button>
            </div>
        `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.remove("translate-y-full");
    }, 100);

    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.classList.add("translate-y-full");
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }
    }, 5000);
  }

  // Daily comfort notes
  const comfortNotes = [
    "You don't have to be anything other than yourself. Your quiet strength, your love for music, your gentle heart - they're all perfect exactly as they are.",
    "Your introvert energy isn't something to fix - it's a superpower. You recharge in solitude and think deeply about the world.",
    "The way you communicate through music shows how beautifully your mind works. Not everyone needs words to say everything.",
    "You belong in spaces that understand your pace, your need for quiet, and your preference for depth over small talk.",
    "Your favorite songs aren't just music - they're pieces of your soul that you've shared with the world.",
    "Being selective with your energy and friendships isn't antisocial - it's self-care and wisdom.",
    "You have this beautiful way of making ordinary moments feel special, just by being genuinely present.",
    "Your heart is both gentle and strong - soft enough to feel deeply, strong enough to keep loving.",
    "The world needs more people like you - thoughtful, genuine, and unafraid to feel everything deeply.",
    "You belong with people who see your quiet moments as comfortable, not awkward.",
  ];

  window.getNewNote = function () {
    const noteElement = document.getElementById("daily-note");
    if (noteElement) {
      const randomNote =
        comfortNotes[Math.floor(Math.random() * comfortNotes.length)];
      noteElement.style.opacity = "0";
      setTimeout(() => {
        noteElement.textContent = `"${randomNote}"`;
        noteElement.style.opacity = "1";
      }, 300);
    }
  };

  // Breathing exercise
  let breathingActive = false;

  window.startBreathing = function () {
    if (breathingActive) return;

    breathingActive = true;
    const circle = document.getElementById("breathing-circle");
    const instruction = document.getElementById("breathing-instruction");
    const button = circle.parentElement.querySelector("button");

    button.textContent = "Breathing...";
    button.disabled = true;

    const breathingSteps = [
      { text: "Breathe in slowly...", duration: 4000, scale: "scale-125" },
      { text: "Hold your breath...", duration: 7000, scale: "scale-125" },
      { text: "Breathe out slowly...", duration: 8000, scale: "scale-75" },
      { text: "Rest...", duration: 2000, scale: "scale-100" },
    ];

    let currentStep = 0;
    let cycles = 0;
    const totalCycles = 3;

    function nextStep() {
      if (cycles >= totalCycles) {
        // Breathing exercise complete
        circle.className = circle.className.replace(/scale-\d+/, "scale-100");
        instruction.textContent =
          "Breathing exercise complete ✨ How do you feel?";
        button.textContent = "Start Again";
        button.disabled = false;
        breathingActive = false;
        showSanctuaryMessage(
          "Great job! Taking time to breathe is a gift to yourself. 🌸"
        );
        return;
      }

      const step = breathingSteps[currentStep];
      instruction.textContent = step.text;

      // Remove previous scale classes and add new one
      circle.className =
        circle.className.replace(/scale-\d+/, "") + " " + step.scale;

      setTimeout(() => {
        currentStep++;
        if (currentStep >= breathingSteps.length) {
          currentStep = 0;
          cycles++;
        }
        nextStep();
      }, step.duration);
    }

    nextStep();
  };

  // ===== MESSAGE IN A BOTTLE FUNCTIONALITY =====

  const bottleForm = document.getElementById("bottle-form");
  const messageText = document.getElementById("message-text");
  const charCount = document.getElementById("char-count");
  const messageCounter = document.getElementById("message-counter");

  // Character counter
  if (messageText && charCount) {
    messageText.addEventListener("input", function () {
      const count = this.value.length;
      charCount.textContent = `${count}/500`;

      if (count > 450) {
        charCount.classList.add("text-warm-600");
      } else {
        charCount.classList.remove("text-warm-600");
      }
    });
  }

  // Load message count from localStorage
  let messageCount = parseInt(localStorage.getItem("messageCount") || "0");
  if (messageCounter) {
    messageCounter.textContent = messageCount;
  }

  // Handle form submission
  if (bottleForm) {
    bottleForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const message = messageText.value.trim();
      const signature =
        document.getElementById("message-signature").value.trim() ||
        "Anonymous";

      if (!message) {
        showBottleNotification("Please write a message first! 💌", "error");
        return;
      }

      // Save message to localStorage
      const messages = JSON.parse(
        localStorage.getItem("bottleMessages") || "[]"
      );
      messages.push({
        message: message,
        signature: signature,
        timestamp: new Date().toISOString(),
        id: Date.now(),
      });
      localStorage.setItem("bottleMessages", JSON.stringify(messages));

      // Update counter
      messageCount++;
      localStorage.setItem("messageCount", messageCount.toString());
      messageCounter.textContent = messageCount;

      // Clear form
      messageText.value = "";
      document.getElementById("message-signature").value = "";
      charCount.textContent = "0/500";

      // Show success animation
      showBottleAnimation();
      showBottleNotification(
        "Your message has been sent to the universe! 🫧✨",
        "success"
      );
    });
  }

  function showBottleAnimation() {
    // Create floating bottle animation
    const bottle = document.createElement("div");
    bottle.className =
      "fixed bottom-4 left-1/2 transform -translate-x-1/2 text-4xl z-50 pointer-events-none";
    bottle.textContent = "💌";
    bottle.style.animation = "bottleFloat 3s ease-out forwards";

    // Add keyframe animation
    const style = document.createElement("style");
    style.textContent = `
            @keyframes bottleFloat {
                0% { transform: translate(-50%, 0px) scale(1); opacity: 1; }
                50% { transform: translate(-50%, -100px) scale(1.2); opacity: 0.8; }
                100% { transform: translate(-50%, -200px) scale(0.5); opacity: 0; }
            }
        `;
    document.head.appendChild(style);

    document.body.appendChild(bottle);

    setTimeout(() => {
      if (document.body.contains(bottle)) {
        document.body.removeChild(bottle);
      }
      document.head.removeChild(style);
    }, 3000);
  }

  function showBottleNotification(message, type = "success") {
    const bgColor =
      type === "success"
        ? "from-sage-400 to-warm-400"
        : "from-red-400 to-orange-400";
    const notification = document.createElement("div");
    notification.className = `fixed top-20 left-4 right-4 md:left-1/2 md:transform md:-translate-x-1/2 md:w-96 bg-gradient-to-r ${bgColor} text-white p-4 rounded-lg shadow-lg z-50 transform -translate-y-full transition-transform duration-300`;
    notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <span class="text-xl">${type === "success" ? "🎉" : "⚠️"}</span>
                <p class="flex-1 text-sm font-medium">${message}</p>
                <button onclick="this.parentElement.parentElement.remove()" class="text-white/80 hover:text-white">×</button>
            </div>
        `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.remove("-translate-y-full");
    }, 100);

    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.classList.add("-translate-y-full");
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }
    }, 4000);
  }

  // ===== ENHANCED PARTICLE INTERACTIONS =====

  // Enhanced particle mouse interaction
  document.addEventListener("mousemove", function (e) {
    const particles = document.querySelectorAll(".animate-twinkle");
    const musicNotes = document.querySelectorAll(".animate-float");

    particles.forEach((particle, index) => {
      const speed = (index + 1) * 0.005;
      const x = (e.clientX - window.innerWidth / 2) * speed;
      const y = (e.clientY - window.innerHeight / 2) * speed;
      particle.style.transform = `translate(${x}px, ${y}px)`;
    });

    musicNotes.forEach((note, index) => {
      const speed = (index + 1) * 0.002;
      const x = (e.clientX - window.innerWidth / 2) * speed;
      const y = (e.clientY - window.innerHeight / 2) * speed;
      note.style.transform = `translate(${x}px, ${y}px)`;
    });
  });

  // ===== INTERSECTION OBSERVER FOR ANIMATIONS =====

  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("animate-slide-up");
        entry.target.style.opacity = "1";
      }
    });
  }, observerOptions);

  // Observe sections for scroll animations
  const sections = document.querySelectorAll("section > div");
  sections.forEach((section) => {
    section.style.opacity = "0";
    observer.observe(section);
  });

  // ===== CONSOLE WELCOME MESSAGES =====

  console.log(
    "%c🎵 Welcome to Where You Belong!",
    "color: #f4a855; font-size: 20px; font-weight: bold;"
  );
  console.log(
    "%c✨ This place was made especially for someone special...",
    "color: #d4a574; font-size: 14px;"
  );
  console.log(
    "%c🌸 Every detail here was crafted with love and hope",
    "color: #8b7355; font-size: 12px;"
  );

  // ===== INITIALIZATION =====

  // Set initial states
  updateProgress();

  // Add subtle entrance animations to key elements
  setTimeout(() => {
    const heroElements = document.querySelectorAll(
      "#home .animate-fade-in, #home .animate-slide-up"
    );
    heroElements.forEach((el, index) => {
      el.style.animationDelay = `${index * 0.2}s`;
    });
  }, 100);

  // Add periodic sparkle effects
  setInterval(() => {
    addSparkleEffect();
  }, 5000);

  function addSparkleEffect() {
    const sparkle = document.createElement("div");
    sparkle.className = "fixed pointer-events-none z-10";
    sparkle.style.left = Math.random() * window.innerWidth + "px";
    sparkle.style.top = Math.random() * window.innerHeight + "px";
    sparkle.textContent = "✨";
    sparkle.style.animation = "sparkle 2s ease-out forwards";

    const style = document.createElement("style");
    style.textContent = `
            @keyframes sparkle {
                0% { opacity: 0; transform: scale(0) rotate(0deg); }
                50% { opacity: 1; transform: scale(1) rotate(180deg); }
                100% { opacity: 0; transform: scale(0) rotate(360deg); }
            }
        `;
    document.head.appendChild(style);

    document.body.appendChild(sparkle);

    setTimeout(() => {
      if (document.body.contains(sparkle)) {
        document.body.removeChild(sparkle);
      }
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    }, 2000);
  }

  // Show welcome message after page loads
  setTimeout(() => {
    showSanctuaryMessage(
      "Welcome to your quiet corner. Take your time, breathe, and feel at home. 🏠💕"
    );
  }, 2000);
});

// ===== GLOBAL UTILITY FUNCTIONS =====

// Function to get user's saved messages (for future features)
window.getUserMessages = function () {
  return JSON.parse(localStorage.getItem("bottleMessages") || "[]");
};

// Function to clear all messages (for testing)
window.clearAllMessages = function () {
  localStorage.removeItem("bottleMessages");
  localStorage.removeItem("messageCount");
  document.getElementById("message-counter").textContent = "0";
  console.log("All messages cleared! 🧹");
};

// Function to export messages (for backup)
window.exportMessages = function () {
  const messages = getUserMessages();
  const dataStr = JSON.stringify(messages, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "my-bottle-messages.json";
  link.click();
  URL.revokeObjectURL(url);
};
