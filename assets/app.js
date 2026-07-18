/**
 * Coin & Collectable Catalog — Landing Page JS
 * Mobile nav, smooth scroll, intersection observer animations
 */

// ---- Mobile Navigation ----
function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('.nav-menu');

  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', !expanded);
    menu.classList.toggle('active');
  });

  // Close menu on link click
  menu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      toggle.setAttribute('aria-expanded', 'false');
      menu.classList.remove('active');
    });
  });

  // Close menu on outside click
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !menu.contains(e.target)) {
      toggle.setAttribute('aria-expanded', 'false');
      menu.classList.remove('active');
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('active')) {
      toggle.setAttribute('aria-expanded', 'false');
      menu.classList.remove('active');
      toggle.focus();
    }
  });
}

// ---- Smooth Scroll ----
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();

      const headerHeight = document.querySelector('.header').offsetHeight;
      const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });

      // Update URL without scroll
      history.pushState(null, '', targetId);
    });
  });
}

// ---- Intersection Observer Animations ----
function initScrollAnimations() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Elements to animate
  const animatedElements = document.querySelectorAll(
    '.feature-card, .screenshot, .platform-card, .section-header, .hero-content, .hero-visual'
  );

  animatedElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });

  // Add visible class styles dynamically
  const style = document.createElement('style');
  style.textContent = `
    .feature-card.visible,
    .screenshot.visible,
    .platform-card.visible,
    .section-header.visible,
    .hero-content.visible,
    .hero-visual.visible {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
  `;
  document.head.appendChild(style);
}

// ---- Header Scroll Effect ----
function initHeaderScroll() {
  const header = document.querySelector('.header');
  if (!header) return;

  let lastScroll = 0;
  const threshold = 100;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > threshold) {
      header.style.background = 'rgba(11, 15, 20, 0.98)';
      header.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)';
    } else {
      header.style.background = 'rgba(11, 15, 20, 0.9)';
      header.style.boxShadow = 'none';
    }

    lastScroll = currentScroll;
  }, { passive: true });
}

// ---- Parallax Hero Visual ----
function initParallax() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const phoneMockup = document.querySelector('.phone-mockup');
  if (!phoneMockup) return;

  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const scrolled = window.pageYOffset;
        const hero = document.querySelector('.hero');
        if (!hero) return;

        const heroHeight = hero.offsetHeight;
        const progress = Math.min(scrolled / heroHeight, 1);

        // Subtle parallax on phone mockup
        const translateY = progress * 30;
        const rotate = -2 + (progress * 1); // -2deg to -1deg

        phoneMockup.style.transform = `
          perspective(1000px)
          rotateY(5deg)
          rotate(${rotate}deg)
          translateY(${translateY}px)
        `;

        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// ---- Active Nav Link on Scroll ----
function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
  if (!sections.length || !navLinks.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, {
    rootMargin: '-50% 0px -50% 0px',
    threshold: 0.1
  });

  sections.forEach(section => observer.observe(section));

  // Style for active nav link
  const style = document.createElement('style');
  style.textContent = `
    .nav-link.active {
      color: var(--color-primary) !important;
    }
    .nav-link.active::after {
      width: 100% !important;
    }
  `;
  document.head.appendChild(style);
}

// ---- Initialize All ----
document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initSmoothScroll();
  initScrollAnimations();
  initHeaderScroll();
  initParallax();
  initActiveNav();
});

// ---- Service Worker Registration ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW registration failed:', err));
  });
}