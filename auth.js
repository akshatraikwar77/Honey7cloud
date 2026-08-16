/* ==========================================================================
   Honey Cloud — auth.js
   Demo-grade account system backed by localStorage. There is no server,
   so this protects nothing sensitive — swap in real auth before handling
   real user data or payments.
   ========================================================================== */

const HC_USERS_KEY = 'hc_users';
const HC_SESSION_KEY = 'hc_session';
const TRIAL_LENGTH_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

function hcGetUsers() {
  try { return JSON.parse(localStorage.getItem(HC_USERS_KEY)) || []; }
  catch { return []; }
}
function hcSaveUsers(users) {
  localStorage.setItem(HC_USERS_KEY, JSON.stringify(users));
}
function hcEncode(pass) {
  // Obfuscation only — NOT cryptographic security. Fine for a local demo, not for production.
  return btoa(unescape(encodeURIComponent(pass)));
}
function hcCurrentSession() {
  return localStorage.getItem(HC_SESSION_KEY);
}
function hcCurrentUser() {
  const email = hcCurrentSession();
  if (!email) return null;
  return hcGetUsers().find(u => u.email === email) || null;
}

function handleSignup() {
  const name = document.getElementById('suName').value.trim();
  const email = document.getElementById('suEmail').value.trim().toLowerCase();
  const pass = document.getElementById('suPass').value;
  const errorEl = document.getElementById('suError');
  errorEl.textContent = '';

  if (!name || !email || pass.length < 8) {
    errorEl.textContent = 'Please fill every field — password needs 8+ characters.';
    return;
  }
  const users = hcGetUsers();
  if (users.some(u => u.email === email)) {
    errorEl.textContent = 'An account with that email already exists.';
    return;
  }
  const user = {
    name, email,
    passHash: hcEncode(pass),
    createdAt: Date.now(),
    isAdmin: users.length === 0 // first account is the seed admin, purely for demo convenience
  };
  users.push(user);
  hcSaveUsers(users);
  localStorage.setItem(HC_SESSION_KEY, email);
  showToast(`Welcome, ${name.split(' ')[0]} — your 60-day trial has started`, 'success');
  setTimeout(() => { window.location.href = 'dashboard.html'; }, 700);
}

function handleSignin() {
  const email = document.getElementById('siEmail').value.trim().toLowerCase();
  const pass = document.getElementById('siPass').value;
  const errorEl = document.getElementById('siError');
  errorEl.textContent = '';

  const user = hcGetUsers().find(u => u.email === email);
  if (!user || user.passHash !== hcEncode(pass)) {
    errorEl.textContent = 'Incorrect email or password.';
    return;
  }
  localStorage.setItem(HC_SESSION_KEY, email);
  showToast(`Welcome back, ${user.name.split(' ')[0]}`, 'success');
  setTimeout(() => { window.location.href = 'dashboard.html'; }, 500);
}

function handleLogout() {
  localStorage.removeItem(HC_SESSION_KEY);
  window.location.href = 'login.html';
}

/* Trial math: returns { daysLeft, expired, expiresAt } */
function hcTrialStatus(user) {
  const expiresAt = user.createdAt + TRIAL_LENGTH_MS;
  const msLeft = expiresAt - Date.now();
  return {
    expired: msLeft <= 0,
    daysLeft: Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000))),
    expiresAt
  };
}

/* Gate a page: redirect to login if not signed in. Call at top of protected pages. */
function hcRequireAuth() {
  const user = hcCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

/* Populate the sidebar user chip + trial pill on the dashboard */
function hcRenderAccountChrome() {
  const user = hcRequireAuth();
  if (!user) return;

  const avatar = document.getElementById('userAvatar');
  const nameLabel = document.getElementById('userNameLabel');
  if (avatar) avatar.textContent = user.name.trim().charAt(0).toUpperCase();
  if (nameLabel) nameLabel.textContent = user.name;

  const trialPill = document.getElementById('trialPill');
  if (trialPill) {
    const status = hcTrialStatus(user);
    if (status.expired) {
      trialPill.innerHTML = 'Your 60-day trial has ended. Please contact the admin for access.';
      trialPill.style.color = '#fb7185';
      const sendBtn = document.getElementById('sendBtn');
      const promptInput = document.getElementById('promptInput');
      if (sendBtn) sendBtn.disabled = true;
      if (promptInput) promptInput.disabled = true;
    } else {
      trialPill.innerHTML = `<strong>${status.daysLeft} days</strong> left in your free trial`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop();
  if (page === 'dashboard.html' || page === 'editor.html') {
    hcRenderAccountChrome();
  }
});
