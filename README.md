# 🎵 Where You Belong

**A real-time music sharing website built with love**

_Where music speaks the words we never said_

---

## 💝 The Story Behind

> _"Sometimes the best conversations happen in silence, with music as our translator"_

**Where You Belong** is more than just a website—it's a digital love letter. Born from the beautiful chaos of playlist descriptions becoming secret messages, this project creates a space where two hearts can connect through music and words in real-time.

When words weren't enough, we had music. When distance felt too far, we had technology. This is where those two worlds meet.

---

## ✨ Features

### 🎵 **Real-time Music Sharing**

- **Today's Comfort Song**: Take turns choosing the perfect song for each other
- **Spotify Integration**: Full Web Playback SDK with search and control
- **Live Synchronization**: Song updates appear instantly on both websites
- **Curated Playlists**: LANY, Taylor Swift, Keshi, and NIKI collections

### 💌 **Heart-to-Heart Messaging**

- **Real-time Letters**: Messages sent from one website appear as letters on the other
- **Instant Delivery**: Powered by Socket.io for live updates
- **Beautiful UI**: Glass morphism design with warm, cozy aesthetics
- **Cross-Platform**: Identical websites for seamless experience

### 🌸 **Thoughtful Design**

- **Introvert-Friendly**: Calm, peaceful interface designed for quiet souls
- **Mobile Responsive**: Beautiful on every device
- **Accessibility**: Carefully crafted for inclusive experience
- **Easter Eggs**: Hidden console messages for the curious

---

## 🛠️ Tech Stack

**Frontend:**

- HTML5 & CSS3
- Tailwind CSS
- Vanilla JavaScript
- Spotify Web Playback SDK

**Backend:**

- Node.js
- Express.js
- Socket.io
- MongoDB & Mongoose

**Authentication:**

- OAuth 2.0 with Spotify

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Spotify Developer Account
- MongoDB Atlas account

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/habstrakT808/For-Ms.-R.git
cd where-you-belong
```

2. **Setup Environment Variables**

```bash
# Copy and fill the environment file
cp .env.example .env

# Spotify Configuration
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI_YOURS=http://127.0.0.1:3001/callback
SPOTIFY_REDIRECT_URI_CRUSH=http://127.0.0.1:3002/callback

# Database
MONGODB_URI=your_mongodb_atlas_connection_string

# Server
PORT=3000
NODE_ENV=development
JWT_SECRET=your_super_secret_key
```

3. **Install Dependencies**

```bash
# Backend
cd backend && npm install

# Frontend Yours
cd ../frontend-yours && npm install

# Frontend Crush
cd ../frontend-crush && npm install
```

4. **Start Development Servers**

```bash
# Terminal 1 - Backend
cd backend && npm start

# Terminal 2 - Frontend Yours
cd frontend-yours && npx http-server -p 3001 -c-1

# Terminal 3 - Frontend Crush
cd frontend-crush && npx http-server -p 3002 -c-1
```

5. **Open in Browser**

- **Backend API**: http://127.0.0.1:3000
- **Your Website**: http://127.0.0.1:3001
- **Crush Website**: http://127.0.0.1:3002

---

## 📁 Project Structure

```
where-you-belong/
├── 📁 backend/                 # Node.js + Express + Socket.io
│   ├── server.js              # Main server file
│   ├── package.json           # Backend dependencies
│   └── routes/                # API routes (future)
├── 📁 frontend-yours/         # Your website
│   ├── index.html             # Main HTML file
│   ├── src/
│   │   ├── js/main.js         # JavaScript logic
│   │   └── css/input.css      # Tailwind CSS
│   ├── dist/css/output.css    # Compiled CSS
│   └── package.json           # Frontend dependencies
├── 📁 frontend-crush/         # Crush's website (identical)
├── .env                       # Environment variables
├── .gitignore                 # Git ignore rules
└── README.md                  # This beautiful file
```

---

## 🔮 Roadmap

### Phase 1: Foundation ✅

- Backend setup with MongoDB Atlas
- Frontend structure with Tailwind CSS
- Spotify Developer Account integration
- Basic real-time messaging

### Phase 2: Core Features ✅

- Socket.io client integration
- Spotify Web Playback SDK
- Real-time song synchronization
- Message persistence and retrieval

### Phase 3: Enhancement 🚧

- User authentication (In Progress)
- Spotify OAuth Flow (Completed)
- Cross-origin support (Completed)
- Mobile responsiveness (In Progress)

### Phase 4: Production 📋

- Performance optimization
- Security hardening
- Deployment automation
- Analytics integration

---

## 🎵 Featured Artists

This project celebrates the music of:

- **LANY** - Dreamy, nostalgic vibes
- **Taylor Swift** - Storytelling through song
- **Keshi** - Soft, soulful melodies
- **NIKI** - Ethereal, emotional depth

_"You Belong With Me" will always be the favorite song of all time_ ✨

---

### 💝 Made with endless love and countless hours of hope

_For someone who deserves all the beautiful songs in the world_

---

_"In a world full of noise, we created a place of peace"_
