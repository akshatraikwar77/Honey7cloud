/* ==========================================================================
   Honey Cloud — admin.js
   Client-side-only admin view. The passphrase below is a convenience gate,
   not real security — anyone with dev tools can bypass it. Put this behind
   a real authenticated backend before using it with real user data.
   ========================================================================== */

const ADMIN_PASSPHRASE = 'honeyadmin';

function unlockAdmin() {
  const input = document.getElementById('adminPass').value;
  const errorEl = document.getElementById('adminError');
  if (input !== ADMIN_PASSPHRASE) {
    errorEl.textContent = 'Incorrect passphrase.';
    return;
  }
  document.getElementById('lockScreen').style.display = 'none';
  document.getElementById('adminContent').style.display = 'block';
  renderAdminDashboard();
}

function renderAdminDashboard() {
  const users = hcGetUsers();
  const tbody = document.getElementById('userTableBody');
  const emptyEl = document.getElementById('emptyUsers');
  tbody.innerHTML = '';

  let activeCount = 0;
  let expiredCount = 0;

  if (users.length === 0) {
    emptyEl.style.display = 'block';
  } else {
    emptyEl.style.display = 'none';
    users.forEach(user => {
      const status = hcTrialStatus(user);
      if (status.expired) expiredCount++; else activeCount++;

      const row = document.createElement('tr');
      const signupDate = new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

      row.innerHTML = `
        <td>${escapeAdminHtml(user.name)}</td>
        <td>${escapeAdminHtml(user.email)}</td>
        <td>${signupDate}</td>
        <td class="${status.expired ? 'status-expired' : 'status-active'}">
          ${status.expired ? 'Expired' : `${status.daysLeft} days left`}
        </td>
        <td></td>
      `;
      const actionCell = row.lastElementChild;
      const resetBtn = document.createElement('button');
      resetBtn.className = 'btn btn-ghost btn-sm';
      resetBtn.textContent = 'Reset trial';
      resetBtn.onclick = () => resetUserTrial(user.email);
      actionCell.appendChild(resetBtn);

      tbody.appendChild(row);
    });
  }

  document.getElementById('statUserCount').textContent = users.length;
  document.getElementById('statActiveCount').textContent = activeCount;
  document.getElementById('statExpiredCount').textContent = expiredCount;
}

function resetUserTrial(email) {
  const users = hcGetUsers();
  const user = users.find(u => u.email === email);
  if (!user) return;
  user.createdAt = Date.now();
  hcSaveUsers(users);
  showToast(`Trial reset — ${user.name} now has 60 fresh days`, 'success');
  renderAdminDashboard();
}

function escapeAdminHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('adminPass')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') unlockAdmin();
  });
});
