window.FM = window.FM || {};

(function () {
  class ParticleSystem {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.o = {
        count: opts.count || 60,
        colors: opts.colors || ['28, 138, 255', '0, 188, 212'],
        maxSize: opts.maxSize || 2.2,
        speed: opts.speed || 0.4,
        linkDist: opts.linkDist || 130,
      };
      this.mouse = { x: null, y: null, r: 110 };
      this.pts = [];
      this._init();
    }

    _init() {
      this._resize();
      window.addEventListener('resize', () => this._resize());
      window.addEventListener('mousemove', e => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
      });
      const count = window.innerWidth < 768 ? Math.round(this.o.count * 0.45) : this.o.count;
      for (let i = 0; i < count; i++) this.pts.push(this._make());
      this._loop();
    }

    _resize() {
      this.canvas.width = this.canvas.offsetWidth;
      this.canvas.height = this.canvas.offsetHeight;
    }

    _make() {
      return {
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * this.o.speed,
        vy: (Math.random() - 0.5) * this.o.speed,
        r: Math.random() * this.o.maxSize + 0.5,
        a: Math.random() * 0.45 + 0.15,
        c: this.o.colors[Math.floor(Math.random() * this.o.colors.length)],
      };
    }

    _loop() {
      const { ctx, canvas } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      this.pts.forEach(p => {
        if (this.mouse.x !== null) {
          const dx = p.x - this.mouse.x, dy = p.y - this.mouse.y;
          const d = Math.hypot(dx, dy);
          if (d < this.mouse.r && d > 0) {
            const f = (this.mouse.r - d) / this.mouse.r;
            p.vx += (dx / d) * f * 0.5;
            p.vy += (dy / d) * f * 0.5;
          }
        }
        p.vx *= 0.98; p.vy *= 0.98;
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.c},${p.a})`;
        ctx.fill();
      });

      for (let i = 0; i < this.pts.length; i++) {
        for (let j = i + 1; j < this.pts.length; j++) {
          const dx = this.pts[i].x - this.pts[j].x;
          const dy = this.pts[i].y - this.pts[j].y;
          const d = Math.hypot(dx, dy);
          if (d < this.o.linkDist) {
            const a = (1 - d / this.o.linkDist) * 0.18;
            ctx.beginPath();
            ctx.moveTo(this.pts[i].x, this.pts[i].y);
            ctx.lineTo(this.pts[j].x, this.pts[j].y);
            ctx.strokeStyle = `rgba(${this.pts[i].c},${a})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(() => this._loop());
    }
  }

  window.FM.ParticleSystem = ParticleSystem;
})();
