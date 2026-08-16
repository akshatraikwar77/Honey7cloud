/* ==========================================================================
   Honey Cloud — main.js
   Shared UI utilities: toasts, sidebar, scroll reveal, 3D parallax scroll.
   ========================================================================== */

/* ---- Toast ---- */
function showToast(message, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.className = `toast is-visible is-${type}`;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    el.classList.remove('is-visible');
  }, 2800);
}

/* ---- Sidebar (dashboard) ---- */
function toggleSidebar(force) {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar) return;
  const open = typeof force === 'boolean' ? force : !sidebar.classList.contains('is-open');
  sidebar.classList.toggle('is-open', open);
  if (backdrop) backdrop.classList.toggle('is-visible', open);
}

function initSidebarResponsive() {
  const toggle = document.getElementById('sidebarToggle');
  if (!toggle) return;
  const sync = () => { toggle.style.display = window.innerWidth <= 860 ? 'inline-flex' : 'none'; };
  sync();
  window.addEventListener('resize', sync);
}

/* ---- Scroll-reveal engine ---- */
function initScrollReveal() {
  const targets = document.querySelectorAll('.reveal, .tilt-card');
  if (!('IntersectionObserver' in window) || targets.length === 0) {
    targets.forEach(t => t.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('is-visible'), i * 60);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  targets.forEach(t => observer.observe(t));
}

/* ---- 3D parallax scroll (hero scene + tilt cards) ---- */
function initParallaxScroll() {
  const scene = document.getElementById('heroScene');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (scene && !prefersReduced) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      const rotate = Math.min(y * 0.02, 10);
      const translate = Math.min(y * 0.18, 90);
      scene.style.transform = `translateY(${translate * -1}px) rotateX(${rotate}deg) rotateY(${rotate * -0.6}deg)`;
    }, { passive: true });
  }

  if (prefersReduced) return;

  document.querySelectorAll('.tilt-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `rotateY(${px * 10}deg) rotateX(${py * -10}deg) translateZ(6px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'rotateY(0deg) rotateX(0deg)';
    });
  });
}

/* ---- Boot ---- */
document.addEventListener('DOMContentLoaded', () => {
  initScrollReveal();
  initParallaxScroll();
  initSidebarResponsive();
});
