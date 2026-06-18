(function () {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TOUCH = 'ontouchstart' in window;

  let lenis = null;

  function initLenis() {
    if (REDUCED || typeof Lenis === 'undefined') return;
    lenis = new Lenis({
      duration: 1.2,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    if (typeof ScrollTrigger !== 'undefined') {
      lenis.on('scroll', ScrollTrigger.update);
    }
  }

  function initAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const target = document.querySelector(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        closeMobileMenu();
        if (lenis) lenis.scrollTo(target, { offset: -70 });
        else target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
      });
    });
  }

  function menuIsOpen() {
    return document.getElementById('mobile-menu').classList.contains('is-open');
  }

  function initNav() {
    const nav = document.getElementById('nav');
    let last = 0;
    window.addEventListener('scroll', () => {
      if (menuIsOpen()) return;
      const y = window.scrollY;
      nav.classList.toggle('nav--scrolled', y > 60);
    }, { passive: true });
  }

  function closeMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const burger = document.getElementById('burger');
    menu.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Abrir menú');
    document.body.style.overflow = '';
    if (lenis) lenis.start();
  }

  function initMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const burger = document.getElementById('burger');
    burger.addEventListener('click', () => {
      if (menuIsOpen()) { closeMobileMenu(); return; }
      menu.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Cerrar menú');
      document.body.style.overflow = 'hidden';
      if (lenis) lenis.stop();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && menuIsOpen()) closeMobileMenu();
    });
  }

  function initReveal() {
    const els = document.querySelectorAll('[data-reveal]');
    if (REDUCED) {
      els.forEach(el => el.classList.add('is-visible'));
      return;
    }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const delay = Number(entry.target.dataset.delay || 0);
        setTimeout(() => entry.target.classList.add('is-visible'), delay);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    els.forEach(el => obs.observe(el));
  }

  function initCounters() {
    const els = document.querySelectorAll('[data-count]');
    if (REDUCED) {
      els.forEach(el => { el.textContent = el.dataset.count; });
      return;
    }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = Number(el.dataset.count);
        const start = performance.now();
        const dur = 1100;
        function frame(now) {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = String(Math.round(target * eased));
          if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        obs.unobserve(el);
      });
    }, { threshold: 0.5 });
    els.forEach(el => obs.observe(el));
  }

  function initScrollEffects() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    if (!REDUCED) {
      gsap.to('#steps-line-fill', {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '#steps',
          start: 'top 70%',
          end: 'bottom 55%',
          scrub: 0.6,
        },
      });

      gsap.to('.stats__giant', {
        xPercent: -6,
        ease: 'none',
        scrollTrigger: {
          trigger: '.stats',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      });
    }

    ScrollTrigger.create({
      trigger: '#doc-stack',
      start: 'top 75%',
      once: true,
      onEnter: () => document.getElementById('doc-stack').classList.add('is-fanned'),
    });
  }

  function initTilt() {
    if (TOUCH || REDUCED) return;
    const mockup = document.getElementById('mockup');
    const hero = document.querySelector('.hero');
    if (!mockup || !hero) return;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    hero.addEventListener('mousemove', e => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    hero.addEventListener('mouseleave', () => { tx = 0; ty = 0; });
    function loop() {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      mockup.style.transform = `rotateY(${cx * 5}deg) rotateX(${cy * -4}deg)`;
      requestAnimationFrame(loop);
    }
    loop();
  }

  function initCursor() {
    if (TOUCH || REDUCED) return;
    const cursor = document.getElementById('cursor');
    const dot = document.getElementById('cursor-dot');
    document.body.classList.add('has-cursor');
    let mx = -100, my = -100, cx = -100, cy = -100;
    document.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx - 2.5}px, ${my - 2.5}px)`;
    });
    function loop() {
      cx += (mx - cx) * 0.14;
      cy += (my - cy) * 0.14;
      const half = cursor.offsetWidth / 2;
      cursor.style.transform = `translate(${cx - half}px, ${cy - half}px)`;
      requestAnimationFrame(loop);
    }
    loop();
    document.querySelectorAll('a, button').forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('is-hover'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('is-hover'));
    });
  }

  function initParticles() {
    if (REDUCED) return;
    const canvas = document.getElementById('bg-canvas');
    if (canvas && window.FM.ParticleSystem) {
      new window.FM.ParticleSystem(canvas, { count: 60 });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.FM.ticker.start();
    initLenis();
    initAnchors();
    initNav();
    initMobileMenu();
    initReveal();
    initCounters();
    initScrollEffects();
    initTilt();
    initCursor();
    initParticles();
  });

  window.addEventListener('load', () => window.FM.runLoader());
})();
