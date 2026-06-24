# CLAUDE.md — Finance Mind: Guía de Diseño y Desarrollo

> Fuente de verdad para toda sesión de Claude Code en este proyecto.
> Última actualización: junio 2026.

---

## 1. Visión del proyecto

**Finance Mind** es un portfolio tracker multi-activo global (acciones, crypto, ETFs, forex, índices, commodities) con identidad visual **"AI futurista multicolor"** — claramente inspirada en el lenguaje visual de Google Gemini pero con código 100% original.

### Principios de diseño

- **Inteligencia visible**: el sitio debe transmitir que hay una mente detrás de los datos — movimiento fluido, gradientes vivos, microinteracciones que respiran.
- **Minimalismo vibrante**: mucho espacio negro/vacío + acentos de color en movimiento. Nunca recargado, nunca plano.
- **Precisión instrumental**: tipografía monoespaciada para datos, números que laten, verde/rojo real. El usuario siente que mira un instrumento financiero de precisión, no un folleto.
- **Sofisticación tecnológica**: glassmorphism, glows sutiles, partículas discretas. Cada detalle debe sentirse intencional y pulido.

### Estructura del proyecto

```
proyecto-finance-mind/
├── landing/               ← Landing page de marketing (HTML + CSS + JS vanilla, puerto 4173)
├── app-v2/                ← App principal v2 (HTML + CSS + JS vanilla, puerto 4175)
│   ├── index.html         ← SPA principal
│   ├── styles/
│   │   ├── tokens.css     ← Design tokens (paleta, tipo, easing, sombras, gradientes)
│   │   ├── app.css        ← Layout y componentes
│   │   └── animations.css ← Keyframes, transiciones, shimmer, sparkle
│   ├── scripts/
│   │   ├── app.js         ← Entry point, init, router
│   │   ├── state.js       ← Store reactivo (localStorage + subscribe/emit)
│   │   ├── api.js         ← Yahoo Finance proxy, cache, rate limiting
│   │   ├── dolar.js       ← Cotización dólar CCL en vivo (dolarapi.com)
│   │   ├── search.js      ← Buscador universal
│   │   ├── portfolio.js   ← CRUD portfolio, cálculos
│   │   ├── auth.js        ← Trial 30 días + paywall
│   │   ├── router.js      ← Hash-based SPA routing
│   │   └── ui/            ← Módulos de cada vista
│   └── icons/             ← PWA icons
├── netlify/functions/     ← Proxy serverless Yahoo Finance (search + quote)
├── finance-app/           ← App v1 (legacy, no tocar)
└── app/                   ← App v1 vanilla (legacy, no tocar)
```

### Servidores de desarrollo

| Nombre | Comando | Puerto | Uso |
|--------|---------|--------|-----|
| `landing` | preview_start "landing" | 4173 | Landing page |
| `app-v2` | preview_start "app-v2" / `node app-v2/server.js` | 4175 | App principal |

### Deploy

- **Hosting**: Netlify (https://finance-mind.netlify.app/)
- **Landing**: `/` → `landing/index.html`
- **App v2**: `/app-v2/` → `app-v2/index.html`
- **Proxy Yahoo**: Netlify Functions (`/api/search`, `/api/quote`)
- **Push = deploy**: `git push` a `main` despliega automáticamente

---

## 2. Paleta de colores

### Filosofía cromática

Gradiente multicolor inspirado en Gemini: azul eléctrico → verde → amarillo → rojo. Nunca colores planos en elementos hero — siempre degradados diagonales o radiales con movimiento.

### Tokens de color (CSS custom properties)

```css
:root {
  /* ── Fondos ── */
  --color-bg:         #0a0a0a;     /* Negro profundo — fondo base */
  --color-bg-alt:     #111111;     /* Secciones alternas */
  --color-surface:    #1a1a1a;     /* Cards, paneles elevados */
  --color-surface-hi: #222222;     /* Hover de surface */

  /* ── Acentos ── */
  --color-accent:     #1C8AFF;     /* Azul Gemini — CTAs, links, foco */
  --color-accent-2:   #00BCD4;     /* Cyan — glows, acentos secundarios */
  --color-green:      #00E676;     /* Rendimiento positivo */
  --color-red:        #FF1744;     /* Rendimiento negativo */
  --color-yellow:     #F4B400;     /* Warnings, trial badge */

  /* ── Bordes ── */
  --color-border:     rgba(255,255,255,0.08);
  --color-border-hi:  rgba(255,255,255,0.16);

  /* ── Texto (jerarquía 3 niveles) ── */
  --color-text-1:     #f5f5f5;     /* Texto principal — contraste AA */
  --color-text-2:     #a0a0a0;     /* Texto secundario — contraste AA */
  --color-text-3:     #555555;     /* Texto terciario — labels discretos */

  /* ── Gradientes Gemini (la firma visual) ── */
  --gradient-gemini:   linear-gradient(135deg, #4285F4, #0F9D58, #F4B400, #DB4437);
  --gradient-primary:  linear-gradient(135deg, #4285F4 0%, #0F9D58 35%, #F4B400 65%, #DB4437 100%);
  --gradient-accent:   linear-gradient(135deg, #1C8AFF 0%, #00BCD4 50%, #0F9D58 100%);
  --gradient-shimmer:  linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
  --gradient-glow:     radial-gradient(circle, rgba(28,138,255,0.15) 0%, transparent 70%);

  /* ── Sombras (siempre con color del acento, nunca gris plano) ── */
  --shadow-sm:   0 2px 8px rgba(28,138,255,0.08);
  --shadow-md:   0 4px 16px rgba(28,138,255,0.12);
  --shadow-lg:   0 8px 32px rgba(28,138,255,0.15);
  --shadow-glow: 0 0 20px rgba(28,138,255,0.25);
}
```

### Reglas de uso

- **Fondos**: `--color-bg` para base, `--color-surface` para cards. Nunca `#000000` puro.
- **Gradientes animados**: los gradientes hero deben poder animarse con `background-position` shift o `hue-rotate` sutil para dar sensación de "vivo".
- **Verde/rojo**: exclusivamente para P&L y variación de precios. Verde = ganancia, rojo = pérdida. Un tracker que solo muestra verde miente.
- **Sombras**: siempre con color del acento (`rgba(28,138,255,...)`) — nunca gris plano (`rgba(0,0,0,...)`).
- **Colores hardcodeados**: PROHIBIDO. Siempre usar `var(--color-*)`. Nunca hex directos en CSS de componentes.

---

## 3. Tipografía

### Fuentes (Google Fonts CDN con preconnect)

| Rol | Fuente | Pesos | Por qué |
|-----|--------|-------|---------|
| Display + body | **Space Grotesk** | 300/400/500/700 | Geométrica con carácter, identidad establecida de la app |
| Datos / labels / ticker / precios | **JetBrains Mono** | 400/500/700 | Tabular: cifras alinean perfecto en columnas. Lenguaje "terminal financiera" |

### Carga obligatoria

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
```

### Escala tipográfica fluida

```css
--text-xs:   clamp(0.65rem, 0.6rem + 0.2vw, 0.75rem);
--text-sm:   clamp(0.78rem, 0.7rem + 0.3vw, 0.85rem);
--text-base: clamp(0.88rem, 0.82rem + 0.3vw, 1rem);
--text-lg:   clamp(1.1rem, 1rem + 0.5vw, 1.3rem);
--text-xl:   clamp(1.4rem, 1.2rem + 0.8vw, 1.8rem);
--text-2xl:  clamp(1.8rem, 1.5rem + 1.2vw, 2.4rem);
--text-hero: clamp(2.8rem, 2rem + 3vw, 5rem);
```

### Reglas tipográficas

- Headlines: `letter-spacing: -0.03em` o más negativo para tensión visual.
- Mono labels: `text-transform: uppercase; letter-spacing: 0.08em–0.1em`.
- **Texto con gradiente** para títulos hero: `background-clip: text; -webkit-text-fill-color: transparent; background-image: var(--gradient-gemini)`.
- **PROHIBIDO**: Inter, Roboto, Arial, `system-ui`, `font-family: sans-serif` sin especificar fuente.

---

## 4. Componentes e interacciones

### 4.1 Indicador "thinking" / sparkle

Orbe o estrella de 4 puntas que pulsa y rota suavemente con gradiente animado. Simula "IA procesando".

```css
@keyframes sparkle-rotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes sparkle-pulse {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50%      { opacity: 1; transform: scale(1.15); }
}
.sparkle {
  background: var(--gradient-gemini);
  animation: sparkle-rotate 4s linear infinite, sparkle-pulse 2s ease-in-out infinite;
}
```

### 4.2 Botones pill

- `border-radius: 999px` (full pill).
- Estado default: fondo `var(--color-accent)`, texto blanco.
- Hover: gradiente animado que se revela + glow sutil (`box-shadow: var(--shadow-glow)`).
- Fill-from-bottom en hover para CTAs primarios.
- Transición: `cubic-bezier(0.22,1,0.36,1)` — nunca `ease` genérico.

```css
.btn.primary {
  background: var(--color-accent);
  border-radius: 999px;
  transition: all 300ms cubic-bezier(0.22,1,0.36,1);
}
.btn.primary:hover {
  background: var(--gradient-accent);
  box-shadow: var(--shadow-glow);
  transform: translateY(-1px);
}
```

### 4.3 Inputs con borde gradiente en foco

```css
.input-field:focus {
  border-color: transparent;
  background-image: linear-gradient(var(--color-surface), var(--color-surface)),
                    var(--gradient-gemini);
  background-origin: border-box;
  background-clip: padding-box, border-box;
  box-shadow: 0 0 12px rgba(66,133,244,0.2);
}
```

### 4.4 Efecto shimmer (loading placeholder)

Brillo que recorre la superficie en loop para estados de carga.

```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg,
    var(--color-surface) 25%,
    var(--color-surface-hi) 50%,
    var(--color-surface) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
```

### 4.5 Cards glassmorphism

```css
.glass-card {
  background: rgba(26,26,26,0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg);
  transition: border-color 300ms cubic-bezier(0.22,1,0.36,1),
              transform 300ms cubic-bezier(0.22,1,0.36,1);
}
.glass-card:hover {
  border-color: var(--color-border-hi);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
```

### 4.6 Transiciones entre estados

- Contenido aparece con `fade + scale-up`: `opacity: 0; transform: scale(0.97)` → `opacity: 1; transform: scale(1)`.
- Duración: 200–400ms con `ease-in-out` o `cubic-bezier(0.22,1,0.36,1)`.
- **NUNCA** apariciones instantáneas (`display: none/block` sin transición).

### 4.7 Partículas de fondo (opcional, hero)

Canvas con puntos conectados tipo constelación — muy discreto, `opacity: 0.3`, no compite con contenido. Solo en hero o full-bleed sections.

```js
// particles.js — constelación de datos, 60fps, requestAnimationFrame
// Respetar prefers-reduced-motion: si activo, no renderizar canvas
```

---

## 5. Animaciones

### Técnicas permitidas (por orden de prioridad)

1. **CSS puro** (`@keyframes`, `transitions`) — primera opción siempre.
2. **GSAP 3.12+** + ScrollTrigger (cdnjs.cloudflare.com) — para scroll-triggered y secuencias complejas. Ya en uso en la landing.
3. **Lenis** (cdn.jsdelivr.net) — smooth scroll. Ya en uso en la landing.
4. **Chart.js 4.4.7** (cdn.jsdelivr.net) — gráficos con animación de entrada built-in.

### Easing tokens

```css
--ease-smooth: cubic-bezier(0.22, 1, 0.36, 1);    /* Default para todo */
--ease-expo:   cubic-bezier(0.87, 0, 0.13, 1);     /* Fills de botón, reveals */
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);  /* Micro-bounces puntuales */
```

### Reglas de animación

- **Solo animar** `transform` y `opacity`. NUNCA `top`, `left`, `width`, `height`, `margin`, `padding`.
- **PROHIBIDO**: `transition: all 0.3s ease` — siempre especificar propiedades y usar cubic-bezier personalizado.
- **PROHIBIDO**: `animation: fadeIn 0.5s ease` como única animación del sitio.
- **Hover states**: nunca solo cambiar `opacity` o `brightness`. Usar fill/morph, glow, translateY, scale.
- **`prefers-reduced-motion`**: OBLIGATORIO. Toda animación debe desactivarse o reducirse.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 6. Estructura técnica

### Stack

- **HTML semántico** + **CSS variables** + **Vanilla JS ES modules** (sin framework, sin build step).
- **Chart.js 4.4.7** para gráficos (via `cdn.jsdelivr.net`).
- **CDNs permitidos**: solo `cdnjs.cloudflare.com` y `cdn.jsdelivr.net`. Ningún otro.
- **Datos**: localStorage (sin servidor, sin auth para el portfolio).
- **Cotizaciones**: Yahoo Finance via Netlify Functions proxy + dolarapi.com para CCL.

### Mobile-first, responsive

| Breakpoint | Target |
|------------|--------|
| `< 480px` | Mobile (1 columna, sidebar oculto, hamburger) |
| `480–768px` | Tablet portrait |
| `768–1024px` | Tablet landscape |
| `> 1024px` | Desktop (sidebar visible, grids multi-columna) |

### Spacing (escala 8px — OBLIGATORIA)

```css
--s0: 4px;   --s1: 8px;   --s2: 16px;  --s3: 24px;
--s4: 32px;  --s5: 48px;  --s6: 64px;  --s7: 80px;  --s8: 96px;
```

**PROHIBIDO**: valores inventados (`padding: 37px 22px`, `gap: 6px`, `margin: 90px`). Todo spacing debe usar `var(--s*)`.

### Border radius tokens

```css
--r-sm: 8px;   --r-md: 12px;  --r-lg: 16px;  --r-xl: 24px;  --r-full: 999px;
```

### Organización CSS

| Archivo | Contenido |
|---------|-----------|
| `tokens.css` | Variables: colores, gradientes, tipografía, spacing, easing, sombras, radii |
| `app.css` | Layout, componentes, estados |
| `animations.css` | @keyframes, shimmer, sparkle, reveals, reducción de movimiento |

---

## 7. Tono de copywriting

- **Idioma**: español rioplatense (vos, te, contanos). Nunca español neutro ni formal.
- **Frases**: cortas, seguras, con foco en "precisión" y "control".
- **Tono**: optimista y directo — nunca corporativo rígido ni marketinero hueco.
- **Datos**: siempre concretos. "1 seg de actualización", no "actualización rápida".
- **Ejemplo**: "Tus CEDEARs, en vivo. Tu estrategia, bajo control." — no "La mejor plataforma para gestionar sus inversiones de manera eficiente."

---

## 8. Restricciones explícitas

### NUNCA hacer

| Categoría | Prohibición | Por qué |
|-----------|-------------|---------|
| **Marca** | NO usar el logotipo de Google ni de Gemini | Propiedad intelectual |
| **Marca** | NO nombrar "Gemini" en texto visible del producto | Marca registrada |
| **Código** | NO copiar código de repositorios de Google | Copyright. Solo inspirarse en la SENSACIÓN visual |
| **Tipografía** | NO usar Inter, Roboto, Arial, system-ui | Genéricas, sin carácter — regla global |
| **Colores** | NO hardcodear hex en CSS de componentes | Siempre `var(--color-*)` |
| **Colores** | NO usar gradiente `#7c3aed → #3b82f6` (purple→blue genérico) | El gradiente más generado por IA |
| **Sombras** | NO usar sombras grises planas | Siempre con color del acento |
| **Spacing** | NO usar valores fuera de la escala 8px | Consistencia visual |
| **Animación** | NO animar `top`, `left`, `width`, `height` | Performance — solo `transform` y `opacity` |
| **Animación** | NO usar `transition: all 0.3s ease` | Genérico, sin intención |
| **Layout** | NO repetir el mismo patrón en secciones consecutivas | Monotonía visual |
| **CDN** | NO usar CDNs no verificados | Solo cdnjs.cloudflare.com y cdn.jsdelivr.net |
| **JS** | NO dejar `console.log` en producción | Código limpio |
| **Assets** | NO usar imágenes externas para UI — todo SVG inline o HTML/CSS | Peso mínimo, sin layout shift |

### SIEMPRE hacer

- Importar fuentes con `preconnect`
- `prefers-reduced-motion` implementado en cada archivo de animación
- Contraste WCAG AA en `--color-text-1` y `--color-text-2`
- ARIA labels y roles en elementos interactivos
- HTML semántico: `header / nav / main / section / footer`
- Focus visible en todos los elementos interactivos
- Variables CSS para todo color, spacing, radius, sombra

---

## 9. Datos y APIs

### Yahoo Finance (cotizaciones globales)

- **Search**: `/api/search?q=query` → Netlify Function → Yahoo Search API
- **Quote**: `/api/quote?symbols=X,Y,Z` → Netlify Function → Yahoo `/v8/finance/chart/SYMBOL`
- **Cache**: quotes 60s en memoria, search 5min en sessionStorage
- **Local proxy**: `node app-v2/server.js` (puerto 4175) para desarrollo

### Dólar CCL (cotización argentina)

- **Fuente**: `https://dolarapi.com/v1/dolares/contadoconliqui` (API pública, sin auth)
- **Refresh**: cada 5 minutos automático
- **Módulo**: `app-v2/scripts/dolar.js`
- El valor se usa para TODAS las conversiones ARS↔USD del portfolio

### Instrumentos soportados

| Tipo | Símbolo Yahoo | Ejemplo |
|------|---------------|---------|
| Acciones US | `AAPL`, `NVDA` | Directo |
| Acciones globales | `SAP.DE`, `7203.T` | Con sufijo de exchange |
| CEDEARs BYMA | `AAPL.BA` | Sufijo `.BA` |
| Crypto | `BTC-USD`, `ETH-USD` | Sufijo `-USD` |
| Forex | `EURUSD=X` | Sufijo `=X` |
| ETFs | `SPY`, `QQQ` | Directo |
| Índices | `^GSPC`, `^IXIC` | Prefijo `^` |
| Commodities | `GC=F`, `CL=F` | Sufijo `=F` |

---

## 10. Modelo de negocio

- **Trial**: 30 días gratis desde primer uso (`fm2_trial_start` en localStorage)
- **Activación**: código ingresado en Ajustes → `fm2_paid` en localStorage
- **Paywall**: overlay glassmorphism cuando el trial expira, bloquea la app
- **Badge**: header muestra días restantes (verde > 7d, amarillo 3–7d, rojo < 3d)

---

## 11. Checklist de entrega

### Fundación visual
- [ ] Paleta y gradientes definidos como variables reutilizables en `tokens.css`
- [ ] Tipografía Space Grotesk + JetBrains Mono cargada vía CDN con preconnect
- [ ] Gradiente Gemini animado aplicado en al menos 1 elemento hero
- [ ] Sombras con color del acento en todas las cards

### Componentes interactivos
- [ ] Al menos 1 componente con animación "thinking/sparkle" (orbe rotando con gradiente)
- [ ] Botones pill con hover: gradiente + glow + translateY
- [ ] Inputs con borde gradiente animado en focus
- [ ] Cards con glassmorphism, hover lift + glow
- [ ] Efecto shimmer en estados de carga / skeleton

### Animaciones
- [ ] Transiciones suaves (200–400ms, cubic-bezier personalizado) en todo hover/click
- [ ] Contenido aparece con fade + scale-up, nunca instantáneo
- [ ] `prefers-reduced-motion` respetado globalmente
- [ ] Solo `transform` y `opacity` animados — nunca propiedades layout

### Técnico
- [ ] Responsive verificado en 375px, 768px, 1024px, 1440px
- [ ] Spacing 100% en escala 8px
- [ ] Colores 100% via CSS variables
- [ ] Sin `console.log` en producción
- [ ] ARIA labels en elementos interactivos
- [ ] Sin assets ni nombres de marca de Google/Gemini

### Funcional
- [ ] Dólar CCL en vivo desde dolarapi.com
- [ ] Portfolio CRUD con persistencia localStorage
- [ ] Cotizaciones Yahoo Finance actualizándose cada 60s
- [ ] Exportación CSV/Excel/PDF
- [ ] Navegación por hash (#/dashboard, #/mercados, #/watchlist, #/ajustes)
- [ ] Trial badge + paywall funcional
