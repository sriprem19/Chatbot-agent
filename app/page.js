"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import config from "../agent.config";

/* ═══════════════════════════════════════════════
   AgentX — Main Application Component
   All customization lives in agent.config.js
   ═══════════════════════════════════════════════ */

const FALLBACK_TRENDS = config.fallbackTrends;
const TREND_ICONS = Object.fromEntries(config.trendingCategories.map(c => [c.category, c.icon]));
const MEM_LABELS = Object.fromEntries(config.memorySchema.map(m => [m.key, m.label]));
const DEPTH_STAGES = config.depthStages;
const EXTRACT_KEYS = config.memorySchema.filter(m => m.extract);
const BATCH_SIZE = config.memoryBatchSize || 5;

/* ── Secure API call through our backend ────── */
async function callAPI(messages, systemPrompt) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, systemPrompt }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.text;
}

/* ── LocalStorage helpers ────────────────────── */
function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function lsSet(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

export default function AgentX() {
  /* ── State ─────────────────────────────────── */
  const [screen, setScreen]         = useState("loading");
  const [memory, setMemory]         = useState({});
  const [history, setHistory]       = useState([]);
  const [topic, setTopic]           = useState("");
  const [trends, setTrends]         = useState(FALLBACK_TRENDS);
  const [messages, setMessages]     = useState([]);
  const [busy, setBusy]             = useState(false);
  const [typing, setTyping]         = useState(false);
  const [toast, setToast]           = useState("");
  const [modalOpen, setModalOpen]   = useState(false);
  const [cmdFilter, setCmdFilter]   = useState("");
  const [cmdIndex, setCmdIndex]     = useState(0);
  const [isVisitor, setIsVisitor]   = useState(false);
  const [ownerMem, setOwnerMem]     = useState({});

  const inputRef    = useRef(null);
  const newTopicRef = useRef(null);
  const msgEndRef   = useRef(null);
  const memQueueRef = useRef([]);
  const memoryRef   = useRef(memory);
  const historyRef  = useRef(history);
  const topicRef    = useRef(topic);

  // Keep refs in sync
  useEffect(() => { memoryRef.current  = memory;  }, [memory]);
  useEffect(() => { historyRef.current = history;  }, [history]);
  useEffect(() => { topicRef.current   = topic;    }, [topic]);

  /* ── Persist to localStorage ───────────────── */
  const save = useCallback((mem, hist, t) => {
    lsSet("ax_mem",   mem);
    lsSet("ax_hist",  hist);
    lsSet("ax_topic", t);
  }, []);

  /* ── Toast ─────────────────────────────────── */
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }, []);

  /* ── Auto-scroll on new messages ───────────── */
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  /* ── System prompt builders (depth-aware, config-driven) ── */
  const ownerSys = useCallback((greeting = false) => {
    const mem = Object.keys(memoryRef.current).length
      ? `What you know about this person: ${JSON.stringify(memoryRef.current)}`
      : "You don't know much yet — learn as you go.";

    const userMsgCount = historyRef.current.filter(m => m.role === "user").length;
    let currentStage = DEPTH_STAGES[0];
    for (const s of DEPTH_STAGES) {
      if (userMsgCount >= s.threshold) currentStage = s;
    }
    const depthRules = `Conversation Stage: ${currentStage.name.toUpperCase()} (${userMsgCount} messages)\n` +
      currentStage.rules.map(r => `- ${r}`).join("\n");

    const coreRules = config.coreRules.map(r => `- ${r}`).join("\n");

    return `${config.personality}
Current topic: "${topicRef.current}"
${mem}

${depthRules}

Core Rules:
${coreRules}
${greeting ? "- Open with an exciting hook about the topic." : ""}`;
  }, []);

  const visitorSys = useCallback(() => {
    const name = ownerMem.name || "this person";
    return config.visitorGreeting(name) + `\nYou know everything about them: ${JSON.stringify(ownerMem)}`;
  }, [ownerMem]);

  /* ── Depth calculation ─────────────────────── */
  const getDepth = useCallback((hist) => {
    const userMsgs = hist.filter(m => m.role === "user").length;
    let stage = DEPTH_STAGES[0];
    for (const s of DEPTH_STAGES) {
      if (userMsgs >= s.threshold) stage = s;
    }
    let pct = stage.pct;
    const idx = DEPTH_STAGES.indexOf(stage);
    if (idx < DEPTH_STAGES.length - 1) {
      const next     = DEPTH_STAGES[idx + 1];
      const range    = next.threshold - stage.threshold;
      const progress = Math.min((userMsgs - stage.threshold) / range, 1);
      pct = stage.pct + (next.pct - stage.pct) * progress;
    }
    return { stage, pct, stageIdx: DEPTH_STAGES.indexOf(stage) };
  }, []);

  /* ── Memory extraction (batched) ───────────── */
  const extractMemory = useCallback(async (batch) => {
    const extractableKeys = EXTRACT_KEYS.map(m => {
      const typeHint = m.type === "array" ? " (array)" : "";
      return `${m.key}${typeHint}`;
    }).join(", ");
    const p = `Extract personal facts about the user from these messages.
Messages: "${batch}"
Existing memory: ${JSON.stringify(memoryRef.current)}
Return ONLY a JSON object with new or updated keys: ${extractableKeys}
Return {} if nothing new. No extra text.`;
    try {
      const raw  = await callAPI([{ role: "user", content: p }]);
      const data = JSON.parse(raw.replace(/```json|```/g, "").trim());
      let newMem = { ...memoryRef.current };
      let changed = false;
      for (const [k, v] of Object.entries(data)) {
        if (!v || (Array.isArray(v) && !v.length)) continue;
        if (Array.isArray(v) && Array.isArray(newMem[k])) {
          const merged = [...new Set([...newMem[k], ...v])];
          if (merged.length !== newMem[k].length) { newMem[k] = merged; changed = true; }
        } else if (newMem[k] !== v) { newMem[k] = v; changed = true; }
      }
      if (!newMem.topics_discussed) newMem.topics_discussed = [];
      if (!newMem.topics_discussed.includes(topicRef.current)) {
        newMem.topics_discussed.push(topicRef.current);
        changed = true;
      }
      if (changed) {
        setMemory(newMem);
        lsSet("ax_mem", newMem);
      }
    } catch {}
  }, []);

  /* ── Fetch trending topics ─────────────────── */
  const fetchTrends = useCallback(async () => {
    try {
      const cached = JSON.parse(localStorage.getItem("ax_trends") || "null");
      if (cached && Date.now() - cached.ts < (config.trendCacheDuration || 3600000)) return cached.data;
    } catch {}
    const cats = config.trendingCategories.map(c => `{"category":"${c.category}","topic":"one line"}`).join(",");
    const prompt = `Return ONLY a JSON array of ${config.trendingCategories.length} trending topics from today.\n[${cats}]\nNo extra text. No markdown.`;
    try {
      const raw  = await callAPI([{ role: "user", content: prompt }]);
      const data = JSON.parse(raw.replace(/```json|```/g, "").trim());
      localStorage.setItem("ax_trends", JSON.stringify({ ts: Date.now(), data }));
      return data;
    } catch {
      return FALLBACK_TRENDS;
    }
  }, []);

  /* ── Chat actions ──────────────────────────── */
  const addMsg = useCallback((role, text) => {
    setMessages(prev => [...prev, { role, text }]);
  }, []);

  const startChat = useCallback(async (t) => {
    if (!t?.trim()) return;
    const trimmed = t.trim();
    setTopic(trimmed);
    topicRef.current = trimmed;
    save(memoryRef.current, historyRef.current, trimmed);
    setScreen("chat");
    setTyping(true);

    try {
      const reply = await callAPI(
        [{ role: "user", content: `Start the conversation about "${trimmed}". My name is ${memoryRef.current.name}.` }],
        ownerSys(true)
      );
      setTyping(false);
      addMsg("agent", reply);
      const newHist = [...historyRef.current, { role: "assistant", content: reply }];
      setHistory(newHist);
      save(memoryRef.current, newHist, trimmed);
    } catch (e) {
      setTyping(false);
      addMsg("agent", "Hmm, I couldn't connect right now. Try sending a message and I'll jump in! 🚀");
      console.error("startChat error:", e);
    }
  }, [ownerSys, save, addMsg]);

  const sendMessage = useCallback(async () => {
    const text = inputRef.current?.value?.trim();
    if (!text || busy) return;

    inputRef.current.value = "";
    inputRef.current.style.height = "auto";
    setBusy(true);

    addMsg("user", text);
    const newHist = [...historyRef.current, { role: "user", content: text }];
    setHistory(newHist);
    historyRef.current = newHist;

    setTyping(true);
    try {
      const sys   = isVisitor ? visitorSys() : ownerSys();
      const reply = await callAPI(newHist, sys);
      setTyping(false);
      addMsg("agent", reply);
      let finalHist = [...newHist, { role: "assistant", content: reply }];
      if (finalHist.length > 40) finalHist = finalHist.slice(-40);
      setHistory(finalHist);
      historyRef.current = finalHist;
      save(memoryRef.current, finalHist, topicRef.current);

      // Batched memory extraction — every 5th message
      if (!isVisitor) {
        memQueueRef.current.push(text);
        if (memQueueRef.current.length >= BATCH_SIZE) {
          const batch = memQueueRef.current.splice(0).join(". ");
          setTimeout(() => extractMemory(batch), 3000);
        }
      }
    } catch (e) {
      setTyping(false);
      const isRL = e.message?.includes("quota") || e.message?.includes("429") || e.message?.includes("Rate");
      addMsg("agent", isRL
        ? "⏳ I'm being rate limited — wait a few seconds and try again."
        : "Something went wrong — please try again.");
      console.error("sendMessage error:", e);
    }

    setBusy(false);
    inputRef.current?.focus();
  }, [busy, isVisitor, ownerSys, visitorSys, save, addMsg, extractMemory]);

  const confirmSwitch = useCallback(async (overrideTopic) => {
    const t = (overrideTopic || cmdFilter || "").trim();
    if (!t) return;
    setModalOpen(false);
    setCmdFilter("");
    setCmdIndex(0);
    setTopic(t);
    topicRef.current = t;
    save(memoryRef.current, historyRef.current, t);

    setTyping(true);
    try {
      const reply = await callAPI(
        [...historyRef.current, { role: "user", content: `Let's switch and talk about "${t}" now.` }],
        ownerSys()
      );
      setTyping(false);
      addMsg("agent", reply);
      const newHist = [
        ...historyRef.current,
        { role: "user", content: `Switching topic to: ${t}` },
        { role: "assistant", content: reply },
      ];
      setHistory(newHist);
      historyRef.current = newHist;
      save(memoryRef.current, newHist, t);
    } catch (e) {
      setTyping(false);
      addMsg("agent", `Alright, let's talk about "${t}"! Send me a message to get started.`);
      console.error("confirmSwitch error:", e);
    }
  }, [ownerSys, save, addMsg]);

  /* ── Share ─────────────────────────────────── */
  const shareAgent = useCallback(() => {
    if (!Object.keys(memoryRef.current).length) {
      showToast("Chat a bit first so I have something to share 😄");
      return;
    }
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(memoryRef.current))));
    const url     = `${location.origin}${location.pathname}?shared=${encoded}`;
    navigator.clipboard.writeText(url)
      .then(() => showToast("🔗 Link copied! Send it to your friends."))
      .catch(() => prompt("Copy this link:", url));
  }, [showToast]);

  /* ── Clear ─────────────────────────────────── */
  const clearAll = useCallback(() => {
    if (!confirm("Clear all memory and start fresh?")) return;
    localStorage.clear();
    location.href = location.origin + location.pathname;
  }, []);

  /* ── Init on mount ─────────────────────────── */
  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const shared = params.get("shared");

      // Visitor mode
      if (shared) {
        try {
          const om = JSON.parse(decodeURIComponent(escape(atob(shared))));
          setOwnerMem(om);
          setIsVisitor(true);
          setMemory(om);
          const name = om.name || "Someone";
          setTopic(`${name}'s Agent`);
          topicRef.current = `${name}'s Agent`;
          memoryRef.current = om;
          setScreen("chat");

          setTyping(true);
          try {
            const vSys = `You are ${name}'s personal AI buddy.
You know everything about them: ${JSON.stringify(om)}
A visitor is talking to you. Answer their questions about ${name} warmly and naturally.
If you don't know something, say so honestly. Keep replies 3-4 sentences.
Greet the visitor warmly. Tell them you know all about ${name} and invite them to ask questions.`;
            const greeting = await callAPI(
              [{ role: "user", content: "A visitor just opened this page." }],
              vSys
            );
            setTyping(false);
            addMsg("agent", greeting);
            setHistory([{ role: "assistant", content: greeting }]);
          } catch {
            setTyping(false);
            addMsg("agent", `Hey there! I'm ${name}'s AI buddy. Ask me anything about them! 😊`);
          }
        } catch {}
        return;
      }

      // Regular user — load from localStorage
      const mem  = lsGet("ax_mem", {});
      const hist = lsGet("ax_hist", []);
      const t    = localStorage.getItem("ax_topic") || "";

      setMemory(mem);
      memoryRef.current = mem;
      setHistory(hist);
      historyRef.current = hist;
      setTopic(t);
      topicRef.current = t;

      // Returning user
      if (mem.name && t && hist.length) {
        setScreen("chat");
        const restored = hist.map(m => ({
          role: m.role === "assistant" ? "agent" : "user",
          text: m.content,
        }));
        setMessages(restored);

        // Welcome back greeting
        setTyping(true);
        try {
          const wbSys = `You are AgentX, a curious and warm AI conversation buddy.
Current topic: "${t}"
What you know about this person: ${JSON.stringify(mem)}
Rules:
- Keep replies to 3-5 sentences. Be engaging and natural.
- Ask exactly ONE follow-up question per reply.
- Welcome them back by name, reference what you remember, continue on "${t}".`;
          const reply = await callAPI(
            [...hist, { role: "user", content: "I'm back!" }],
            wbSys
          );
          setTyping(false);
          addMsg("agent", reply);
          const newHist = [...hist, { role: "user", content: "I'm back!" }, { role: "assistant", content: reply }];
          setHistory(newHist);
          historyRef.current = newHist;
          save(mem, newHist, t);
        } catch {
          setTyping(false);
          addMsg("agent", `Welcome back, ${mem.name}! Send me a message to continue. 😊`);
        }

        // Background trends
        fetchTrends().then(tr => setTrends(tr));
        return;
      }

      // Has name but no topic
      if (mem.name) {
        setScreen("topic");
        const tr = await fetchTrends();
        setTrends(tr);
        return;
      }

      // Brand new user
      setScreen("name");
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Submit name ───────────────────────────── */
  const submitName = async (e) => {
    e?.preventDefault();
    const nameInput = document.getElementById("nameInput");
    const name = nameInput?.value?.trim();
    if (!name) return;
    const newMem = { ...memory, name };
    setMemory(newMem);
    memoryRef.current = newMem;
    save(newMem, history, topic);
    setScreen("topic");
    const tr = await fetchTrends();
    setTrends(tr);
  };

  /* ── Derived state ─────────────────────────── */
  const depth    = getDepth(history);
  const memKeys  = Object.keys(memory);
  const showDepth = screen === "chat" && history.length > 0;
  const userInit = (isVisitor ? "V" : (memory.name?.[0] || "U")).toUpperCase();

  /* ── Command palette items ─────────────────── */
  const cmdItems = (() => {
    const items = [];
    const q = cmdFilter.toLowerCase();

    // Personalized picks
    if (Array.isArray(memory.interests)) {
      memory.interests.forEach(i => items.push({ section: "personalized", label: i, icon: "❤️", sub: "Your Interest" }));
    }
    if (Array.isArray(memory.goals)) {
      memory.goals.forEach(g => items.push({ section: "personalized", label: g, icon: "🎯", sub: "Your Goal" }));
    }
    if (memory.background) {
      items.push({ section: "personalized", label: memory.background, icon: "🎓", sub: "Your Background" });
    }

    // Recent topics
    const recent = (Array.isArray(memory.topics_discussed) ? memory.topics_discussed : [])
      .filter(t => t !== topic)
      .reverse();
    recent.forEach(t => items.push({ section: "recent", label: t, icon: "↩", sub: "Recent" }));

    // Trending
    trends.forEach(t => items.push({
      section: "trending",
      label: t.topic,
      icon: TREND_ICONS[t.category] || "🔥",
      sub: t.category
    }));

    // Filter
    const filtered = q ? items.filter(i => i.label.toLowerCase().includes(q)) : items;

    // Add "new chat" option if typing something custom
    if (q && !filtered.some(i => i.label.toLowerCase() === q)) {
      filtered.unshift({ section: "new", label: cmdFilter.trim(), icon: "✨", sub: "Start new chat" });
    }

    return filtered;
  })();

  /* ── Command palette keyboard handler ───────── */
  const handleCmdKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCmdIndex(prev => Math.min(prev + 1, cmdItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCmdIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (cmdItems.length > 0) {
        confirmSwitch(cmdItems[cmdIndex]?.label);
      } else if (cmdFilter.trim()) {
        confirmSwitch(cmdFilter.trim());
      }
    } else if (e.key === "Escape") {
      setModalOpen(false);
      setCmdFilter("");
      setCmdIndex(0);
    }
  };

  /* ── Auto resize textarea ──────────────────── */
  const autoResize = (el) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 110) + "px";
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  /* ═══ RENDER ═══════════════════════════════ */
  if (screen === "loading") return null;

  return (
    <>
      {/* ═══ HEADER ═══ */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">{config.emoji}</div>
          {config.name}
        </div>
        <div className="header-right">
          <div className={`topic-pill${screen === "chat" ? " visible" : ""}`}>
            💬 <strong>{topic}</strong>
          </div>
          <button className="btn-clear" onClick={clearAll}>Clear</button>
        </div>
      </header>

      {/* ═══ VISITOR BANNER ═══ */}
      {isVisitor && (
        <div className="visitor-banner visible">
          👀 You&apos;re visiting <strong>{ownerMem.name || "Someone"}</strong>&apos;s AI Buddy — ask me anything about them!
        </div>
      )}

      {/* ═══ MAIN ═══ */}
      <div className="main">
        <div className="chat-col">

          {/* Screen: Name */}
          <div className={`screen${screen !== "name" ? " hidden" : ""}`}>
            <div>
              <div className="screen-title">Hey there! 👋<br />I&apos;m your <em>{config.tagline}</em></div>
              <div className="screen-sub">{config.description}</div>
            </div>
            <form className="name-wrap" onSubmit={submitName}>
              <input id="nameInput" type="text" placeholder="What's your name?" />
              <button type="submit" className="primary-btn">Let&apos;s Go →</button>
            </form>
          </div>

          {/* Screen: Topic */}
          <div className={`screen${screen !== "topic" ? " hidden" : ""}`}>
            <div>
              <div className="screen-title">What&apos;s on your mind,<br /><em>{memory.name || "friend"}</em>? 🧠</div>
              <div className="screen-sub">Pick a trending topic or type your own below.</div>
            </div>
            <div className="trending-wrap">
              <div className="section-label">🔥 Trending Right Now</div>
              <div className="trend-grid">
                {trends.map((t, i) => (
                  <div key={i} className="trend-card" onClick={() => startChat(t.topic)}>
                    <div className="trend-cat">{t.category}</div>
                    <div className="trend-topic">{t.topic}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="custom-row">
              <input
                id="customTopic"
                type="text"
                placeholder="Or type your own topic…"
                onKeyDown={(e) => { if (e.key === "Enter") startChat(e.target.value); }}
              />
              <button onClick={() => startChat(document.getElementById("customTopic")?.value)}>
                Start →
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="messages" style={{ display: screen === "chat" ? "flex" : "none" }}>
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <div className={`avatar ${m.role === "agent" ? "agent" : "user-avatar"}`}>
                  {m.role === "agent" ? config.emoji : userInit}
                </div>
                <div className="bubble" dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, "<br>") }} />
              </div>
            ))}
            {typing && (
              <div className="msg agent">
                <div className="avatar agent">{config.emoji}</div>
                <div className="bubble">
                  <div className="typing"><span></span><span></span><span></span></div>
                </div>
              </div>
            )}
            <div ref={msgEndRef} />
          </div>

          {/* Input */}
          <div className={`input-area${screen === "chat" ? " visible" : ""}`}>
            <div className="input-row">
              <textarea
                ref={inputRef}
                rows={1}
                placeholder="Message your AI buddy…"
                onKeyDown={handleKey}
                onInput={(e) => autoResize(e.target)}
              />
              <button className="send-btn" disabled={busy} onClick={sendMessage}>➤</button>
            </div>
          </div>
        </div>

        {/* ═══ SIDEBAR ═══ */}
        <aside className="sidebar">
          <div className="sidebar-head">
            <div className="sidebar-head-title"><div className="live-dot"></div> Memory Active</div>
            <div className="sidebar-head-sub">Building your profile as we talk</div>
          </div>

          {showDepth && (
            <div className="depth-indicator visible">
              <div className="depth-label">Depth <span>{depth.stage.name}</span></div>
              <div className="depth-track"><div className="depth-fill" style={{ width: depth.pct + "%" }} /></div>
              <div className="depth-steps">
                {DEPTH_STAGES.map((s, i) => (
                  <span key={i} className={i <= depth.stageIdx ? "active" : ""}>{s.name}</span>
                ))}
              </div>
            </div>
          )}

          <div className="memory-scroll">
            {memKeys.length === 0 ? (
              <div className="memory-empty">Nothing yet.<br />Start chatting and I&apos;ll<br />learn about you ✨</div>
            ) : (
              memKeys.map(k => {
                const val   = Array.isArray(memory[k]) ? memory[k].join(", ") : memory[k];
                const label = MEM_LABELS[k] || `🔹 ${k.replace(/_/g, " ")}`;
                return (
                  <div key={k} className="memory-card">
                    <div className="memory-card-key">{label}</div>
                    <div className="memory-card-val">{val}</div>
                  </div>
                );
              })
            )}
          </div>

          <div className={`sidebar-footer${screen === "chat" ? " visible" : ""}`}>
            <button className="switch-btn" onClick={() => { setModalOpen(true); setCmdFilter(""); setCmdIndex(0); }}>↻ Switch Topic</button>
            {!isVisitor && <button className="share-btn" onClick={shareAgent}>🔗 Share My Agent</button>}
          </div>
        </aside>
      </div>

      {/* ═══ COMMAND PALETTE MODAL ═══ */}
      <div className={`cmd-overlay${modalOpen ? " open" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) { setModalOpen(false); setCmdFilter(""); setCmdIndex(0); } }}>
        <div className="cmd-palette">
          {/* Header */}
          <div className="cmd-header">
            <div className="cmd-search-icon">⌘</div>
            <input
              ref={newTopicRef}
              className="cmd-input"
              type="text"
              placeholder="Search topics or type something new…"
              value={cmdFilter}
              onChange={(e) => { setCmdFilter(e.target.value); setCmdIndex(0); }}
              onKeyDown={handleCmdKey}
              autoFocus
            />
            <kbd className="cmd-esc" onClick={() => { setModalOpen(false); setCmdFilter(""); setCmdIndex(0); }}>ESC</kbd>
          </div>
          {topic && (
            <div className="cmd-current">Currently: <strong>{topic}</strong> · Memory carries forward</div>
          )}

          {/* Results */}
          <div className="cmd-results">
            {cmdItems.length === 0 && (
              <div className="cmd-empty">No matches found. Press <kbd>Enter</kbd> to start a new chat.</div>
            )}

            {/* Group by section */}
            {["new", "personalized", "recent", "trending"].map(section => {
              const sectionItems = cmdItems.filter(i => i.section === section);
              if (!sectionItems.length) return null;
              const sectionLabels = { new: "✨ New Topic", personalized: "✨ For You", recent: "🕐 Recent", trending: "🔥 Trending" };
              return (
                <div key={section} className="cmd-section">
                  <div className="cmd-section-label">{sectionLabels[section]}</div>
                  {sectionItems.map((item) => {
                    const globalIdx = cmdItems.indexOf(item);
                    return (
                      <div
                        key={`${section}-${globalIdx}`}
                        className={`cmd-item${globalIdx === cmdIndex ? " active" : ""}`}
                        onClick={() => confirmSwitch(item.label)}
                        onMouseEnter={() => setCmdIndex(globalIdx)}
                      >
                        <span className="cmd-item-icon">{item.icon}</span>
                        <div className="cmd-item-body">
                          <span className="cmd-item-label">{item.label}</span>
                          <span className="cmd-item-sub">{item.sub}</span>
                        </div>
                        {globalIdx === cmdIndex && <span className="cmd-item-enter">↵</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="cmd-footer">
            <span><kbd>↑↓</kbd> Navigate</span>
            <span><kbd>↵</kbd> Select</span>
            <span><kbd>Esc</kbd> Close</span>
          </div>
        </div>
      </div>

      {/* ═══ TOAST ═══ */}
      <div className={`toast${toast ? " show" : ""}`}>{toast}</div>
    </>
  );
}
