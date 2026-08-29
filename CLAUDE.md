# CLAUDE.md — Finance Mind: Guía de Diseño y Desarrollo

> Fuente de verdad para toda sesión de Claude Code en este proyecto.
> Última actualización: agosto 2026 — pivote a analista diario (§12–15).

---

## 1. Visión del proyecto

**Finance Mind** es un **analista diario automático** de activos globales (acciones, crypto, ETFs, forex, índices, commodities) con identidad visual **"AI futurista multicolor"** — claramente inspirada en el lenguaje visual de Google Gemini pero con código 100% original.

> **PIVOTE (agosto 2026).** El producto dejó de ser un tracker de portfolio. Ahora el usuario carga
> su lista de activos (importándola de TradingView o a mano) y **una vez por día un bot le explica
> qué pasó con cada uno y por qué**: noticias que movieron el precio, lectura técnica, patrones
> detectados, y si las señales son de corto o de largo plazo.
>
> Las cotizaciones, los logos, los porcentajes de variación y el P&L **se conservan íntegros** —
> cambia su propósito: antes eran el producto, ahora son el contexto que alimenta el análisis.

### Qué pregunta responde cada cosa

| Pieza | Antes respondía | Ahora responde |
|-------|-----------------|----------------|
| Dashboard | "¿Cuánto gané?" | "¿Qué necesito saber hoy?" |
| Cotización y % variación | Rendimiento de mi plata | Disparador del análisis — el bot explica el movimiento |
| Watchlist | Lista de seguimiento | Universo que el bot analiza |
| Logos | Decoración | Se conservan igual, identidad visual del feed |
| Cantidades de posición | P&L en pesos | Peso de relevancia. **Nunca salen del navegador.** |

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
├── api/                   ← NUEVO. Vercel Functions (runtime Node)
│   ├── quote.js           ← Proxy Yahoo (migrado de netlify/functions, casi 1:1)
│   ├── search.js          ← Proxy Yahoo search
│   ├── sync.js            ← La app sube su lista de símbolos
│   ├── report.js          ← La app baja sus informes
│   ├── recover.js         ← Canje del código de recuperación (con rate limit)
│   └── cron/
│       ├── daily.js       ← Disparo diario. Procesa un lote y encadena el siguiente
│       └── outcomes.js    ← Evaluación del track record a 7 y 30 días
├── lib/                   ← NUEVO. Lógica compartida, sin dependencias de Vercel
│   ├── db.js              ← Acceso a Neon (devices, assets, reports, outcomes)
│   ├── candles.js         ← Velas diarias 1 año desde Yahoo
│   ├── indicators.js      ← RSI, MACD, SMA/EMA, ATR, Bollinger, volumen relativo
│   ├── patterns.js        ← Cruces, divergencias, breakouts, doble techo/piso
│   ├── news.js            ← Yahoo news + Google News RSS + Finnhub, dedupe
│   ├── analyst.js         ← Prompt + llamada al LLM + validación de esquema
│   └── schema.sql         ← Esquema Postgres
├── netlify/functions/     ← LEGACY tras migrar a Vercel (no borrar aún)
├── worker.js              ← LEGACY, Cloudflare (no borrar aún)
├── finance-app/           ← App v1 (legacy, no tocar)
└── app/                   ← App v1 vanilla (legacy, no tocar)
```

### Servidores de desarrollo

| Nombre | Comando | Puerto | Uso |
|--------|---------|--------|-----|
| `landing` | preview_start "landing" | 4173 | Landing page |
| `app-v2` | preview_start "app-v2" / `node app-v2/server.js` | 4175 | App principal |

### Deploy

**Destino: Vercel (plan Hobby).** Es la mejor opción de las tres evaluadas para este bot:

| | Netlify free | Cloudflare Workers free | **Vercel Hobby** |
|---|---|---|---|
| Duración de función | 10s (30s scheduled) | I/O no cuenta como CPU | **300s (fluid compute)** |
| Subrequests por invocación | Sin tope duro | **50 — se topea con 10 activos** | **Sin tope** |
| Cron | 30s tope | Flexible, gratis | **Solo 1 vez por día** |
| Invocaciones | 300 créditos/mes, corta | 100k/día | **1M/mes · 4 CPU-hours** |
| Runtime | Node (AWS Lambda) | workerd (no-Node) | **Node (AWS Lambda)** |

Las dos ventajas que deciden: **300s por invocación sin límite de subrequests** elimina el riesgo
rojo de Cloudflare (§14.2), y el **runtime Node sobre AWS Lambda** es el mismo entorno donde el
proxy de Yahoo ya funciona hoy en Netlify — el flujo cookie+crumb porta casi 1:1 (§14.1).

La contra: **el cron de Hobby corre una sola vez por día**, y el timing solo se garantiza dentro
de la hora. Cualquier expresión más frecuente (`0 * * * *`, `*/30 * * * *`) **hace fallar el
deploy**. Se resuelve con auto-encadenamiento (§12.3), no con más crons.

| Recurso | Plan | Techo gratuito |
|---------|------|----------------|
| Vercel Functions | Hobby | 1M invocaciones/mes · 300s · 4 CPU-hours |
| Vercel Cron | Hobby | **1 disparo por día**, timing garantizado solo dentro de la hora |
| Neon Postgres (marketplace) | Free | 0.5 GB por proyecto, sin pausa por inactividad |
| Gemini 2.5 Flash | Free (AI Studio) | 1.500 req/día · **15 req/min** · sin tarjeta |

**Costo total del proyecto: $0.** Base de datos: **Neon**, no Supabase — Supabase pausa los
proyectos free tras ~1 semana de inactividad, y un bot que corre por cron no puede depender de
una base dormida.

⚠️ **Ver §14.15 — Hobby prohíbe uso comercial.** Afecta directamente al paywall.

Netlify y el Worker de Cloudflare quedan como están hasta que la migración esté verificada.
No borrar `netlify/functions/` ni `worker.js`.

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
- **Cotizaciones**: Yahoo Finance via Vercel Functions proxy + dolarapi.com para CCL.

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

- **Search**: `/api/search?q=query` → Vercel Function → Yahoo Search API
- **Quote**: `/api/quote?symbols=X,Y,Z` → Vercel Function → Yahoo `/v8/finance/chart/SYMBOL`
- **Velas**: `/v8/finance/chart/SYMBOL?interval=1d&range=1y` → insumo de los indicadores
- **Cache**: quotes 60s en memoria, search 5min en sessionStorage
- **Local proxy**: `node app-v2/server.js` (puerto 4175) para desarrollo

### Fuentes del bot (todas gratuitas, ninguna pide tarjeta)

| Dato | Fuente | Key | Estado |
|------|--------|-----|--------|
| Velas diarias 1 año | Yahoo `/v8/finance/chart` | No | Endpoint ya en uso |
| Noticias por ticker | Yahoo `/v1/finance/search?newsCount=20` | No | **Ya construido** — hoy va con `newsCount=0`, solo hay que subirlo |
| Noticias respaldo | Google News RSS por ticker | No | Nuevo |
| Noticias de empresa | Finnhub `/company-news` | Sí, gratis (60/min) | Nuevo |
| Redacción del informe | Gemini 2.5 Flash | Sí, gratis sin tarjeta | Nuevo |

**Regla de privacidad:** al LLM solo se le mandan tickers, precios y titulares **públicos**.
Nunca cantidades, montos ni nada del usuario — en el tier gratuito de Gemini, Google puede usar
los datos para entrenar.

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

## 10. Modelo de negocio — DESACTIVADO, NO BORRAR

Mientras dure la versión de prueba, la app es **gratis y sin límite**. El paywall se apaga con
un flag, no se borra.

```js
// app-v2/scripts/auth.js
export const MONETIZACION_ACTIVA = false;   // ← único interruptor
```

Con el flag en `false`: no se muestra el badge de trial, no aparece el paywall, `isPaid()`
devuelve siempre `true`. **Todo el código sigue en el repo, intacto y funcional:**

- **Trial**: 30 días desde primer uso (`fm2_trial_start` en localStorage)
- **Activación**: código en Ajustes → `fm2_paid` en localStorage
- **Paywall**: overlay glassmorphism al expirar
- **Badge**: días restantes (verde > 7d, amarillo 3–7d, rojo < 3d)
- **Cobro**: `netlify/functions/mp-webhook.js` + `validate-code.js` (Mercado Pago)

**PROHIBIDO borrar `auth.js`, `paywall.js`, `mp-webhook.js` o `validate-code.js`.** Poner el
flag en `true` reactiva todo sin reconstruir nada.

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
- [ ] Cotizaciones Yahoo Finance actualizándose cada 60s
- [ ] Import de watchlist de TradingView (`.txt`) con mapeo de símbolos
- [ ] Sync de la lista al backend + código de recuperación
- [ ] Informe diario generado por cron, visible al abrir la app
- [ ] Cada causa del informe con fuente, URL y fecha
- [ ] Exportación CSV/Excel/PDF
- [ ] Navegación por hash

---

## 12. Arquitectura del bot

### 12.1 Regla de oro: el modelo no calcula nada

**RSI, MACD, medias, ATR, soportes, resistencias y patrones se calculan en código determinista
en el backend y se le entregan al modelo como hechos cerrados. El modelo solo interpreta y
redacta.**

Innegociable, por tres razones:

1. Un modelo Flash gratuito **inventa números** si lo dejás calcular.
2. Hay dinero de por medio: los indicadores tienen que ser auditables, no opiniones.
3. Desacopla el motor. El día que haya presupuesto para un modelo mayor, **el pipeline no cambia** — se reemplaza una sola función en `analyst.js`.

### 12.2 El informe es por SÍMBOLO, no por usuario

Si 50 usuarios siguen NVDA, NVDA se analiza **una vez**. Lo personal es únicamente qué símbolos
ve cada uno y con qué peso. Esto es lo que hace que el sistema escale dentro del tier gratuito:
el costo crece con el universo de activos, no con la cantidad de usuarios.

### 12.3 Pipeline diario

El cron de Hobby dispara **una sola vez**. La función se auto-encadena hasta terminar el universo:

```
vercel.json → { "crons": [{ "path": "/api/cron/daily", "schedule": "0 9 * * *" }] }
                                                        (06:00 ART, ±1h)
  │
  ▼
/api/cron/daily?offset=0          ← máx 300s, watchdog a 240s
  │
  ├─ 1. Neon → símbolos pendientes de hoy, lote de 25
  ├─ 2. Por cada símbolo, en serie (respeta los 15 req/min de Gemini):
  │      ├─ candles.js    → velas 1d/1y desde Yahoo
  │      ├─ indicators.js → RSI(14), MACD, SMA20/50/200, EMA, ATR, Bollinger, vol. relativo
  │      ├─ patterns.js   → golden/death cross, divergencias RSI, breakout, doble techo/piso, gaps
  │      ├─ news.js       → Yahoo + Google News RSS + Finnhub · dedupe · ventana 72h
  │      ├─ analyst.js    → Gemini Flash con responseSchema → JSON validado
  │      └─ Neon ← informe · marcar símbolo como procesado
  │
  └─ 3. ¿Quedan pendientes?  →  fetch('/api/cron/daily?offset=25')  SIN await
                                 (fire-and-forget) y devolver 200
```

**Por qué encadenar y no hacer más crons:** Hobby rechaza el deploy si el cron corre más de una
vez por día. El encadenamiento no tiene ese límite — son invocaciones HTTP normales, y hay 1M
por mes.

**Números:** ~10s por símbolo (domina la llamada al LLM) → **25 símbolos por invocación** con
margen. El ritmo resultante es ~6 req/min, cómodo bajo el tope de 15 req/min de Gemini. El techo
real del sistema pasa a ser **1.500 informes/día de Gemini**, no la infraestructura.

**Requisitos no negociables del encadenamiento:**
- **Idempotencia.** Si una invocación muere a los 300s, la siguiente retoma sin duplicar. El
  estado vive en Neon, nunca en memoria.
- **Watchdog a 240s.** Si se acerca el límite, corta el lote y encadena aunque no lo haya
  terminado.
- **Tope de encadenamientos** (ej. 20) para que un bug no genere un bucle infinito de invocaciones.
- **Secreto en el endpoint.** `/api/cron/*` es una URL pública: validar `CRON_SECRET` en el header
  (Vercel lo inyecta) o cualquiera puede disparar el bot y agotar la cuota de Gemini.

### 12.4 Esquema del informe

Salida JSON validada. **Nunca prosa libre.**

```json
{
  "symbol": "NVDA", "date": "2026-08-29",
  "movimiento": { "pct": -4.2, "vs_sector": -2.1, "volumen_relativo": 2.3 },
  "que_paso": "Resumen de una línea",
  "por_que": [{ "causa": "...", "peso": "alto|medio|bajo",
                "fuentes": [{ "titulo": "...", "medio": "...", "url": "...", "fecha": "..." }] }],
  "lectura_tecnica": {
    "indicadores": { "rsi14": 38.2, "macd": "cruce bajista", "sma50": 124.1, "atr": 4.8 },
    "patrones": [{ "nombre": "Death cross", "detectado": true, "confiabilidad": "media" }],
    "soporte": 118.40, "resistencia": 131.20
  },
  "horizonte": {
    "corto_plazo": { "sesgo": "bajista", "confianza": "media", "razon": "...", "ventana": "1-2 semanas" },
    "largo_plazo": { "sesgo": "alcista", "confianza": "alta", "razon": "...", "ventana": "6-12 meses" }
  },
  "señales_contradictorias": ["El técnico dice X pero la noticia dice Y"],
  "que_invalidaria_esto": ["Cierre por encima de 131.20 con volumen"],
  "confianza_global": "media",
  "datos_faltantes": ["Sin cobertura en las últimas 72h"]
}
```

**Cuatro reglas obligatorias en el prompt:**

1. **Corto y largo plazo separados y explícitos.** Es donde casi todo análisis miente por omisión.
2. **Toda causa lleva fuente del set entregado, con URL y fecha.** Si no está en el set, no puede citarla.
3. **`señales_contradictorias` es obligatorio.** Un análisis que solo confirma una dirección está mintiendo.
4. **`que_invalidaria_esto` es obligatorio.** Obliga a que la tesis sea falsable.

**Permiso explícito de decir "no sé".** El prompt debe autorizar `"que_paso": "Sin movimiento ni
noticias relevantes"` como respuesta válida y deseable. Sin ese permiso, el modelo inventa
causalidad. Un informe que admite que no pasó nada vale más que uno inventado.

### 12.5 Track record

Cada informe guarda el sesgo declarado. Un cron semanal compara a 7 y 30 días contra el precio
real y marca acierto/error en la tabla `outcomes`. La app muestra: *"acertó 61% de sus llamadas
de corto plazo en 90 días (n=140)"*. Es lo que separa una app que opina de una en la que se
puede confiar.

---

## 13. Identidad: código de recuperación

Sin registro, sin email, sin contraseña.

- Al primer uso el navegador genera un `device_id` (UUID v4) → localStorage `fm2_device`.
- El Worker le asocia un **código de recuperación de 12 caracteres** (`FMND-7K3Q-XR91`).
- Ese código se muestra en Ajustes. Pegándolo en otro dispositivo, se recupera la lista.

**Seguridad mínima obligatoria** (ver §14.7): 12 caracteres, rate limit por IP en el endpoint de
canje, y **en el servidor no se guarda nada sensible** — solo tickers. Cantidades y montos viven
únicamente en el navegador y nunca se sincronizan.

---

## 14. Pre-mortem: qué puede salir mal

> Ordenado por riesgo real. Los tres primeros pueden hundir el proyecto y hay que atacarlos
> **antes** de escribir el resto.

### 14.1 🟡 Yahoo Finance desde Vercel — riesgo bajo, pero verificar igual

**Degradado de 🔴 a 🟡 al elegir Vercel.** Netlify Functions y Vercel Functions corren ambas sobre
**AWS Lambda con runtime Node**. El flujo cookie+crumb de `netlify/functions/quote.js`
(`redirect: 'manual'` + lectura de `set-cookie`) funciona hoy en producción y porta casi 1:1 —
no hay cambio de runtime como sí lo habría hacia el `workerd` de Cloudflare.

Lo que queda por verificar: que Yahoo no rate-limitee el rango de IPs de Vercel distinto al de
Netlify. Es plausible pero improbable.

**Estado del deploy verificado el 29/08/2026:** existen dos deploys en paralelo —
`.github/workflows/deploy.yml` empuja a Cloudflare Workers en cada push, y `netlify.toml` sigue
activo. `https://finance-mind.netlify.app/api/quote` devuelve `marketCap`, `preMarketPrice` y
`marketState`, campos que **solo produce la función de Netlify**. Ese dominio lo sirve Netlify.
**Ninguno de los dos se borra hasta que Vercel esté verificado.**

**Mitigación:** fase 00 — portar `quote.js` a `/api/quote.js` y pegarle en la URL de Vercel.
Si falla, fallback a Stooq (CSV, gratis, sin key).

### 14.2 🟠 El cron de Hobby corre una sola vez por día

Vercel Hobby **rechaza el deploy** si el cron corre más seguido que una vez al día
(`*/30 * * * *` → *"Hobby accounts are limited to daily cron jobs"*). Además el timing solo se
garantiza **dentro de la hora**: un cron a las 09:00 puede dispararse a las 09:47.

Esto no rompe nada, pero obliga al auto-encadenamiento de §12.3. Los riesgos que introduce ese
patrón son otros:

| Riesgo del encadenamiento | Mitigación |
|---|---|
| Una invocación muere a los 300s y pierde el lote | Estado en Neon, trabajo **idempotente**, watchdog a 240s |
| Bug genera bucle infinito de invocaciones | **Tope duro de encadenamientos** (ej. 20) |
| `/api/cron/*` es URL pública — cualquiera dispara el bot y agota Gemini | Validar `CRON_SECRET` en el header |
| El informe no está listo cuando el usuario abre la app | La UI muestra "generando…", no una pantalla vacía |

**La buena noticia:** Vercel elimina el riesgo rojo que tenía Cloudflare. **No hay tope de
subrequests** y cada invocación dura 300s en vez de 10ms de CPU, así que un solo disparo procesa
25 símbolos donde Cloudflare procesaba 8.

### 14.3 🔴 El informe puede ser genérico e inútil

Riesgo número uno del **producto**, no de la infraestructura. *"NVDA cayó por toma de ganancias
y sentimiento del sector"* es ruido con formato de análisis. Si el bot escribe eso todos los
días, la app no sirve para nada.

**Mitigación:** el permiso explícito de decir "no sé" (§12.4), la exigencia de citar fuentes del
set entregado, y validar la calidad con **un activo real antes de construir la UI**. Si el
informe no convence en el prototipo, se ajusta el prompt ahí y no después de tres fases.

### 14.4 🟠 Alucinación de causalidad

El modelo va a decir "cayó por la noticia X" cuando la noticia es de hace tres días o no tiene
relación. Es el modo de falla más peligroso porque *suena bien*.

**Mitigación:** ventana estricta de 72h en `news.js`; el modelo solo puede citar del set que se
le entrega; `peso` obligatorio por causa; y `datos_faltantes` como escape.

### 14.5 🟠 Los patrones técnicos tienen valor predictivo pobre

Death cross, doble techo y compañía fallan seguido, y está bien documentado. Riesgo: dar falsa
confianza con plata de por medio.

**Mitigación:** cada patrón sale con `confiabilidad` explícita, nunca como certeza, y el **track
record (§12.5) lo mide de verdad**. Si el bot acierta 45%, el usuario lo va a ver.

### 14.6 🟠 Símbolos que no mapean

`BCBA:GGAL`, CEDEARs, cripto de exchanges raros, índices con prefijo. Va a haber cola larga.

**Mitigación:** validar cada símbolo importado contra Yahoo search **en el momento del import**,
y mostrarle al usuario qué no se pudo mapear con opción de corregir a mano. Nunca fallar en
silencio.

### 14.7 🟠 El código de recuperación se puede enumerar

Si alguien puede probar códigos a fuerza bruta, lee listas ajenas.

**Mitigación:** 12 caracteres, rate limit por IP en el canje, y **no guardar nada sensible en el
servidor** — solo tickers. Aun con el código comprometido, lo que se filtra es una lista de
símbolos.

### 14.8 🟡 Gemini: 15 requests por minuto

El límite por minuto es más restrictivo que el diario. Se resuelve solo con el batching de
§14.2 (8 símbolos cada 5 min), pero hay que respetarlo explícitamente.

### 14.9 🟡 El JSON del modelo no valida

Flash rompe esquemas. **Mitigación:** usar `responseSchema` nativo de Gemini, un retry con
reparación, y si falla dos veces guardar un **informe degradado** con solo los datos
deterministas (indicadores + noticias, sin interpretación). Nunca dejar al usuario sin nada.

### 14.10 🟡 "El día" no significa lo mismo para todos los activos

Cripto opera 24/7; BYMA, US y Europa cierran a horas distintas. El "% del día" puede referirse
a sesiones diferentes. **Mitigación:** definir la ventana por `quoteType` y exchange, y decirlo
en el informe.

### 14.11 🟡 20 informes por día no los lee nadie

**Mitigación:** el feed prioriza. *"3 activos necesitan tu atención hoy"* arriba, el resto
colapsado.

### 14.12 🟡 Dependemos de dos servicios gratuitos que pueden cambiar términos

Gemini free tier y Yahoo no oficial. **Mitigación:** `analyst.js` expone una única función
intercambiable, y las fuentes de datos van detrás de una capa fina. Cambiar de proveedor debe
ser una tarea de horas, no de semanas.

### 14.13 🟡 No perder los datos que el usuario ya tiene

Hay transacciones en localStorage de la versión actual. **Mitigación:** seguir el patrón que ya
existe en `state.js` (`loadAndMigrate` + backup con sufijo, nunca borrar el original).

### 14.14 ⚪ Marco legal

En Argentina la CNV regula el asesoramiento financiero. Decir "va a la baja" puede rozar
asesoramiento no registrado.

**Mitigación:** disclaimer **visible en cada informe**, no en gris al pie. Lenguaje descriptivo,
nunca imperativo: *"el RSI está en zona de sobreventa"*, jamás *"comprá"* o *"vendé"*.

### 14.15 ⚪ Vercel Hobby prohíbe el uso comercial

Hobby es **solo para uso personal y no comercial**. Vercel define comercial de forma amplia: no
hace falta estar facturando — **anunciar la venta de un producto ya alcanza**. Una landing con
sección de precios de un SaaS que pensás cobrar es comercial desde el día uno.

Esto toca de lleno lo que estamos preservando en §10:

- `landing/` tiene sección de pricing (commit `b4a7ed3`)
- `netlify/functions/mp-webhook.js` es una integración de cobro con Mercado Pago
- `auth.js` tiene trial de 30 días y código de activación

**Mientras `MONETIZACION_ACTIVA = false`** y la sección de pricing esté oculta, la app es una
herramienta personal gratuita y Hobby es el plan correcto.

**El día que pongas el flag en `true`, hace falta Pro ($20/mes).** No es opcional ni es un
tecnicismo: la aplicación del término es inconsistente, pero la política es real y Vercel manda
avisos. Que quede escrito acá para que la decisión sea consciente y no una sorpresa.

**Acción concreta en la fase 1:** el mismo flag que apaga el paywall debe **ocultar la sección de
pricing de la landing**. Hoy son dos cosas separadas.

---

## 15. Fases

| # | Fase | Entrega | Riesgo |
|---|------|---------|--------|
| **00** | **Spike de Yahoo desde Vercel** | Portar `quote.js` a `/api/quote.js`, desplegar y traer una cotización real desde la URL de Vercel. **Bloquea todo lo demás.** | §14.1 |
| **0** | Prototipo del analista | Pipeline completo para UN activo, corrido a mano. Valida §14.3 antes de construir nada. | §14.3 |
| **1** | Vercel + Neon + sync | Sitio en Vercel, esquema Postgres, `/api/sync`, código de recuperación. Flag que apaga paywall **y** pricing de la landing. | §14.7, §14.15 |
| **2** | Conectores | Vista "Conectar": drop del `.txt`, pegar tickers, buscador. Mapeo de símbolos. | §14.6 |
| **3** | Motor determinista | `indicators.js` + `patterns.js`, testeados contra valores conocidos | — |
| **4** | Noticias | `news.js`: 3 fuentes, dedupe, ventana 72h | §14.4 |
| **5** | Bot + cron encadenado | Cron diario, encadenamiento idempotente, `CRON_SECRET`, tope de saltos, informe degradado | §14.2, §14.9 |
| **6** | UI del informe | Feed priorizado + detalle por activo. Dashboard reenfocado. | §14.11 |
| **7** | Rigor | Disclaimer visible, trazabilidad, track record | §14.5, §14.14 |

**Las fases 00 y 0 van primero y no son negociables.** Atacan los dos riesgos que pueden hundir
el proyecto, y juntas son poco trabajo comparadas con lo que evitan.

### Estado — 29/08/2026

**Fase 00: código listo, falta el deploy.**

| Archivo | Qué es |
|---------|--------|
| `lib/yahoo.js` | Lógica de Yahoo extraída y compartida: `getQuotes`, `search`, `getCandles` |
| `api/quote.js` · `api/search.js` | Puertos de las funciones de Netlify. **La app no necesita ningún cambio** — mismas rutas |
| `api/diag.js` | Endpoint de verificación de la fase 00 |
| `vercel.json` · `package.json` · `.vercelignore` | Config. CommonJS a propósito (sin `"type": "module"`) para no romper Netlify durante la migración |

**Verificado localmente (Node 24):** los tres caminos de Yahoo responden — v7 con cookie+crumb,
chart como fallback, y velas 1y para `AAPL` (251), `BTC-USD` (365), `GGAL.BA` (251, ARS) y
`^GSPC` (251). Los handlers cumplen el contrato de Vercel: casos felices, 400 por parámetro
faltante, CORS y `Cache-Control` correctos.

**Falta:** confirmar que Yahoo responde desde las **IPs de Vercel**, que es la pregunta real de
§14.1 y solo se contesta con un deploy. `GET /api/diag?symbol=AAPL` devuelve el veredicto:

| Veredicto | Significado |
|-----------|-------------|
| `OK_COMPLETO` | v7 + chart + velas funcionan. Migración limpia. |
| `OK_PARA_EL_BOT` | Las velas funcionan pero el crumb no. El bot va; la app pierde `marketCap` y pre/post market. |
| `BLOQUEADO` | Yahoo rechaza a Vercel. Fallback a Stooq. |

**Dato que ya cambió el diseño:** `BTC-USD` devuelve 365 velas contra 251 de las acciones — el
riesgo §14.10 confirmado con datos. La ventana temporal debe definirse por tipo de activo.
