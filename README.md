# 🤖 AgentX — AI Conversation Buddy Starter Kit

> **Build your own AI agent in minutes.** AgentX is a production-ready, open-source starter template for creating intelligent, memory-powered AI chatbots. Customize the personality, memory, and behavior — all from a single config file.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Eldorado5002/aiagent)

---

## ⚡ Quick Start (5 Minutes)

### 1. Use This Template
Click the green **"Use this template"** button at the top of this repo → **Create a new repository** under your account.

### 2. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME
cd YOUR_REPO_NAME
npm install
```

### 3. Get a Free Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **"Create API Key"** — it's completely free
3. Copy the key

### 4. Add Your Key
Rename `.env.example` to `.env.local` and paste your key:
```env
GEMINI_API_KEY=your_api_key_here
```

### 5. Run
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) — your AI agent is live! 🎉

---

## 🎨 Customize Your Agent

**You only need to edit ONE file:** `agent.config.js`

Everything about your agent — its personality, what it remembers, how it behaves, what topics it suggests — is controlled from this single configuration file. You never need to touch the React code or the backend.

### What You Can Customize

| Setting | What It Does |
|---------|-------------|
| `name` | Your agent's name (shown in header) |
| `emoji` | Your agent's avatar emoji |
| `tagline` | Welcome screen headline |
| `description` | Welcome screen subtitle |
| `personality` | The AI's core personality prompt |
| `coreRules` | Rules the AI always follows |
| `depthStages` | How the AI evolves as conversation deepens |
| `memorySchema` | What personal facts the AI extracts & remembers |
| `memoryBatchSize` | How often memory extraction runs (every N messages) |
| `trendingCategories` | The topic categories shown on the home screen |
| `fallbackTrends` | Default topics when API is unavailable |
| `trendCacheDuration` | How long to cache trending topics |
| `visitorGreeting` | How the AI greets visitors on shared links |
| `model` | Which Gemini model to use |

### Example: Change the Personality
```javascript
// agent.config.js
personality: `You are a sarcastic but helpful coding mentor 
who loves anime references and speaks in short, punchy sentences.`,
```

### Example: Change What It Remembers
```javascript
// agent.config.js
memorySchema: [
  { key: "name",       label: "👤 Name",       type: "string", extract: true },
  { key: "tech_stack",  label: "💻 Tech Stack", type: "array",  extract: true },
  { key: "projects",   label: "🚀 Projects",   type: "array",  extract: true },
  { key: "experience", label: "📊 Experience", type: "string", extract: true },
],
```

### Example: Change the Trending Categories
```javascript
// agent.config.js
trendingCategories: [
  { category: "AI",       icon: "🧠" },
  { category: "Web Dev",  icon: "🌐" },
  { category: "Mobile",   icon: "📱" },
  { category: "DevOps",   icon: "⚙️" },
],
```

---

## ✨ Features

### 🧠 Persistent Memory
The AI remembers your name, interests, goals, background, and more — across sessions. Every conversation teaches it something new, and that memory is carried forward into every future chat.

### 📈 Depth-Aware Intelligence
The AI doesn't just answer questions — it **evolves** through conversation stages:

| Stage | Messages | Behavior |
|-------|----------|----------|
| **Intro** | 0–3 | Warm, welcoming. Asks gentle questions to learn about you. |
| **Getting to Know** | 4–9 | Connects topics to your known interests and goals. |
| **Deep Dive** | 10+ | Acts like a brilliant friend. Debates, challenges, offers insights. |

All stage behaviors are fully customizable in `agent.config.js`.

### ⌘ Command Palette
A premium, keyboard-navigable Spotlight search for switching topics:
- 🔍 **Instant search** — filters interests, recent topics, and trends as you type
- ✨ **Personalized Picks** — suggests topics based on stored memory
- 🕐 **Recent Topics** — jump back to previous conversations
- 🔥 **Live Trending** — real-time topics from Gemini (cached for 1 hour)
- ⌨️ **Full keyboard support** — `↑↓` navigate, `Enter` select, `Esc` close

### 🔗 Share Your Agent
Generate a shareable link that lets friends ask your AI buddy questions about you — powered by the memory it's built.

### 🔒 Secure by Default
Your API key never touches the browser. All calls go through a server-side proxy (`/api/chat`), keeping your key hidden even on public deployments.

---

## 🏗️ Architecture

```
┌─────────────────┐      POST /api/chat      ┌──────────────────┐
│   User Browser  │ ──────────────────────▶  │  Vercel API Route │
│   (React App)   │ ◀──────────────────────  │  (route.js)       │
└─────────────────┘      JSON response       └────────┬─────────┘
                                                       │
                                                       │ Gemini API
                                                       │ (server-side only)
                                                       ▼
                                              ┌──────────────────┐
                                              │  Google Gemini    │
                                              │  (configurable)   │
                                              └──────────────────┘
```

---

## 📁 Project Structure

```
your-agent/
├── agent.config.js            ← ⭐ THE ONLY FILE YOU EDIT
├── .env.example               ← Copy to .env.local, add your API key
├── app/
│   ├── api/chat/route.js      ← Secure Gemini proxy (don't touch)
│   ├── globals.css            ← Design system (don't touch)
│   ├── layout.js              ← Root layout with fonts
│   └── page.js                ← Full React app (don't touch)
├── .gitignore
├── next.config.js
├── package.json
└── README.md
```

---

## ☁️ Deploy to Vercel

### One-Click Deploy
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. Add environment variable: `GEMINI_API_KEY` = `your_key`
4. Click **Deploy** — done!

### CLI Deploy
```bash
npx vercel
```
Then add `GEMINI_API_KEY` in your Vercel dashboard: **Settings → Environment Variables**

---

## 🔧 API Rate Limits (Free Tier)

| Limit | Value |
|-------|-------|
| Requests per minute | 15 RPM |
| Requests per day | 1,500 RPD |
| Tokens per minute | 1,000,000 TPM |

### Built-in Optimizations
| Optimization | How It Helps |
|---|---|
| **Server-side retry** | Auto-retries 429 errors (5s → 10s backoff) |
| **Batched memory extraction** | Extracts every N messages (configurable) |
| **Cached trending topics** | Fetches once per hour, caches in localStorage |
| **Secure backend proxy** | Prevents bots from stealing your API quota |

---

## 🧩 How Memory Works

1. User sends messages → queued in a batch
2. Every Nth message (default: 5, configurable), the batch is sent to Gemini
3. Gemini extracts facts based on your `memorySchema` config
4. Facts are merged into the existing memory (arrays are deduplicated)
5. Memory persists in `localStorage` across sessions

### Default Memory Keys
| Key | Icon | Type |
|-----|------|------|
| `name` | 👤 | string |
| `age` | 🎂 | string |
| `location` | 📍 | string |
| `background` | 🎓 | string |
| `interests` | ❤️ | array |
| `goals` | 🎯 | array |
| `current_situation` | 📌 | string |
| `personality` | ✨ | string |
| `topics_discussed` | 💬 | array (auto-tracked) |

All keys are fully customizable in `agent.config.js`.

---

## 🎨 Design System

| Token | Color | Usage |
|-------|-------|-------|
| `--bg` | `#0c0c11` | Page background |
| `--surface` | `#13131a` | Header, sidebar |
| `--accent` | `#7c6fff` | Primary purple |
| `--green` | `#34d399` | Live indicator |
| `--text` | `#e2e2ea` | Primary text |

**Fonts:** Inter (body) + Space Grotesk (headings) from Google Fonts

---

## 📊 API Budget per Session

For a typical 10-message session on the free tier:

| Action | API Calls |
|--------|-----------|
| Trending topics (cached) | 0–1 |
| Welcome back greeting | 1 |
| 10 chat messages | 10 |
| Memory extraction (batched) | 2 |
| **Total** | **13–14** ✅ |

Well within the 15 RPM limit for a single user.

---

## 🗺️ Roadmap

- [ ] Database backend (Firebase/Supabase) for cross-device memory sync
- [ ] User authentication
- [ ] Voice input (speech-to-text)
- [ ] Multi-model support (GPT, Claude)
- [ ] Conversation export (PDF/Markdown)
- [ ] Theme customization (light mode, custom colors)
- [ ] Mobile PWA with offline support

---

## 🛡️ Security

| Risk | Mitigation |
|------|-----------|
| API key exposure | Server-side only (`.env.local`, never in browser) |
| Key in Git | `.gitignore` blocks `.env.local` |
| Unauthorized usage | Key never sent to frontend |
| Rate limit abuse | Server-side retry with exponential backoff |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

Open source under the [MIT License](LICENSE).

---

## 🙏 Built With

- **[Google Gemini](https://ai.google.dev/)** — AI intelligence
- **[Next.js 15](https://nextjs.org/)** — React framework with API routes
- **[Vercel](https://vercel.com/)** — Deployment platform
- **[Inter](https://fonts.google.com/specimen/Inter) & [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk)** — Typography

---

<p align="center">
  Built with 💜 by <a href="https://github.com/Eldorado5002">Eldorado5002</a>
</p>
