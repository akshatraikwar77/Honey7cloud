/* ==========================================================================
   Honey Cloud — chat.js
   Single input, auto-detected intent: image / video-frame / code / text.
   ========================================================================== */

// Honey Cloud talks to Gemini through a local key-rotator proxy instead of
// calling Google directly, so the real API key never ships to the browser.
// Run the proxy from https://github.com/jwadow/gemini-api-key-rotator-proxy-server
// (it holds your actual Gemini key(s) server-side) and point PROXY_BASE_URL at it.
// For local dev this is usually http://127.0.0.1:8000; in production, host the
// proxy somewhere and use its https URL here instead.
const PROXY_BASE_URL = "http://127.0.0.1:8000";
const GEMINI_MODEL = "gemini-2.0-flash-exp";
const GEMINI_ENDPOINT = `${PROXY_BASE_URL}/v1beta/models/${GEMINI_MODEL}:generateContent`;

let hcSearchActive = false;
let hcHistory = [];          // [{id, title, messages: [{role, text, imageUrl}]}]
let hcActiveChatId = null;

/* ---- Intent detection ---- */
function detectIntent(prompt) {
  const p = prompt.toLowerCase();
  if (/\b(photo|image|picture|art|illustration|drawing|paint(ing)?|logo|icon)\b/.test(p)) return 'image';
  if (/\b(video|animation|animate|clip|film)\b/.test(p)) return 'video';
  if (/\b(website|webpage|landing page|code|script|function|component|html|css|javascript|python|snippet)\b/.test(p)) return 'code';
  return 'text';
}

/* ---- Composer ---- */
function handleComposerKey(e) {
  const el = e.target;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function toggleSearch() {
  hcSearchActive = !hcSearchActive;
  document.getElementById('searchToggle').classList.toggle('is-active', hcSearchActive);
}

function newChat() {
  hcActiveChatId = 'chat_' + Date.now();
  hcHistory.unshift({ id: hcActiveChatId, title: 'New chat', messages: [] });
  renderHistoryList();
  renderActiveChat();
  toggleSidebar(false);
}

function ensureActiveChat() {
  if (!hcActiveChatId) newChat();
  return hcHistory.find(c => c.id === hcActiveChatId);
}

/* ---- Sending ---- */
async function sendMessage() {
  const input = document.getElementById('promptInput');
  const prompt = input.value.trim();
  if (!prompt) return;

  const user = hcCurrentUser ? hcCurrentUser() : null;
  if (user && hcTrialStatus(user).expired) {
    showToast('Your 60-day trial has ended. Please contact the admin for access.', 'error');
    return;
  }

  const chat = ensureActiveChat();
  if (chat.messages.length === 0) chat.title = prompt.slice(0, 42);
  chat.messages.push({ role: 'user', text: prompt });
  input.value = '';
  input.style.height = 'auto';
  renderActiveChat();
  renderHistoryList();

  const intent = detectIntent(prompt);
  chat.messages.push({ role: 'ai', text: '', pending: true, intent });
  renderActiveChat();

  try {
    if (intent === 'image') {
      const url = buildPollinationsUrl(prompt);
      chat.messages[chat.messages.length - 1] = { role: 'ai', text: `Here's your image for: "${prompt}"`, imageUrl: url };
    } else if (intent === 'video') {
      const frameUrl = buildPollinationsUrl(prompt + ', cinematic film still');
      chat.messages[chat.messages.length - 1] = {
        role: 'ai',
        text: `Video generation isn't wired to a live model yet — here's a representative frame while that's connected:`,
        imageUrl: frameUrl
      };
    } else if (intent === 'code') {
      const reply = await callGemini(prompt, true);
      chat.messages[chat.messages.length - 1] = { role: 'ai', text: reply, isCode: true };
    } else {
      let context = '';
      if (hcSearchActive) context = await fetchWebContext(prompt);
      const reply = await callGemini(context ? `${context}\n\nUser question: ${prompt}` : prompt, false);
      chat.messages[chat.messages.length - 1] = { role: 'ai', text: reply };
    }
  } catch (err) {
    chat.messages[chat.messages.length - 1] = {
      role: 'ai',
      text: `Something went wrong reaching the model: ${err.message}`
    };
  }
  renderActiveChat();
}

/* ---- Gemini text call, routed through the local key-rotator proxy ---- */
async function callGemini(prompt, wantCode) {
  const systemNote = wantCode
    ? 'Respond with a single fenced code block containing complete, runnable code for the request.'
    : 'Respond conversationally and concisely.';

  let res;
  try {
    res = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemNote}\n\n${prompt}` }] }]
      })
    });
  } catch (networkErr) {
    throw new Error(`Can't reach the proxy at ${PROXY_BASE_URL}. Is gemini-api-key-rotator-proxy-server running?`);
  }
  if (!res.ok) throw new Error(`Proxy/Gemini error ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response returned.';
}

/* ---- Free image generation via Pollinations.ai ---- */
function buildPollinationsUrl(prompt) {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=768&height=512&nologo=true`;
}

/* ---- Optional live web search grounding ---- */
async function fetchWebContext(query) {
  try {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
    if (!res.ok) return '';
    const data = await res.json();
    const snippets = [];
    if (data.AbstractText) snippets.push(data.AbstractText);
    (data.RelatedTopics || []).slice(0, 3).forEach(t => { if (t.Text) snippets.push(t.Text); });
    if (snippets.length === 0) return '';
    return `Live web context:\n${snippets.join('\n')}`;
  } catch {
    return '';
  }
}

/* ---- Rendering ---- */
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderActiveChat() {
  const chat = hcHistory.find(c => c.id === hcActiveChatId);
  const inner = document.getElementById('chatInner');
  const empty = document.getElementById('chatEmpty');
  if (!chat || chat.messages.length === 0) {
    if (empty) empty.style.display = 'flex';
    inner.querySelectorAll('.msg').forEach(m => m.remove());
    return;
  }
  if (empty) empty.style.display = 'none';
  inner.querySelectorAll('.msg').forEach(m => m.remove());

  chat.messages.forEach(msg => {
    const wrap = document.createElement('div');
    wrap.className = `msg is-${msg.role}`;
    const avatar = document.createElement('div');
    avatar.className = 'msg__avatar';
    avatar.textContent = msg.role === 'user' ? 'Y' : 'H';
    const body = document.createElement('div');
    body.className = 'msg__body';

    if (msg.pending) {
      body.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
    } else if (msg.isCode) {
      body.innerHTML = `<p>${escapeHtml(msg.text.split('```')[0]).trim() || 'Here is the code:'}</p><pre><code>${escapeHtml(extractCode(msg.text))}</code></pre>`;
    } else {
      body.innerHTML = `<p>${escapeHtml(msg.text)}</p>`;
      if (msg.imageUrl) {
        const img = document.createElement('img');
        img.src = msg.imageUrl;
        img.alt = 'Generated result';
        img.className = 'msg__image';
        img.onclick = () => { sessionStorage.setItem('hc_editor_image', msg.imageUrl); window.location.href = 'editor.html'; };
        img.style.cursor = 'pointer';
        img.title = 'Click to open in editor';
        body.appendChild(img);
      }
    }

    wrap.appendChild(avatar);
    wrap.appendChild(body);
    inner.appendChild(wrap);
  });

  document.getElementById('chatScroll').scrollTop = document.getElementById('chatScroll').scrollHeight;
}

function extractCode(text) {
  const match = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  return match ? match[1] : text;
}

function renderHistoryList() {
  const list = document.getElementById('historyList');
  if (!list) return;
  list.innerHTML = '';
  hcHistory.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'sidebar__item' + (chat.id === hcActiveChatId ? ' is-active' : '');
    item.textContent = chat.title || 'New chat';
    item.onclick = () => { hcActiveChatId = chat.id; renderHistoryList(); renderActiveChat(); toggleSidebar(false); };
    list.appendChild(item);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('chatInner')) newChat();
});
