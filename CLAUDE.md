# CLAUDE.md — Plan Maestro: Landing Finance Mind

> Plan de diseño y construcción de la landing page de **Finance Mind**.
> Estado: **APROBADO Y CONSTRUIDO** (junio 2026) — la landing vive en `/landing` (HTML + CSS + JS vanilla).
> La app existente en `/finance-app` no se toca. Servir la landing con preview_start "landing" (puerto 4173).

---

## 1. Brief del proyecto

**Qué es:** Landing page de marketing para Finance Mind, la app de portfolio tracking de CEDEARs que ya existe en `/finance-app` (React + Recharts, dark, estética Gemini). La landing presenta el producto, demuestra su valor en vivo y empuja un único objetivo: que el visitante abra la app.

**Para quién:** Inversores minoristas argentinos (25–45) que operan CEDEARs en brokers como BALANZ y hoy trackean su cartera en Excel o en la cabeza. Saben de mercado, detectan el humo a kilómetros, valoran datos duros y velocidad.

**Emoción en 3 segundos:** **Precisión + control.** El visitante tiene que sentir que está mirando un instrumento de precisión financiera — no un folleto. La landing debe *comportarse* como la app: números que laten, verde/rojo en vivo, data por todos lados.

**Elemento inolvidable (layout anchor):** Un **ticker marquee full-bleed de CEDEARs en vivo** cruzando la pantalla con precios simulados que varían en tiempo real (verde/rojo), igual que en la app — la landing demuestra el producto antes de explicarlo. Más el mockup del dashboard reconstruido en HTML/CSS puro flotando en el hero con tilt 3D y números que cambian cada segundo.

**Objetivo de conversión:** CTA único "Abrir Finance Mind" → app. CTA secundario: scroll a la demo.

---

## 2. Dirección estética

**Elegida: Tech Neo-Futurista** (ejecutada al 100%, sin mezclas).

**Por qué esta y no otra:**
- Es la dirección que ya define al producto: la app usa dark `#0a0a0a`, acento azul-cyan Gemini, glassmorphism sutil y JetBrains Mono para datos. Una landing Dark Luxury o Editorial rompería la continuidad marca→producto; el usuario haría clic en "Abrir la app" y sentiría que cambió de empresa.
- El research lo confirma: en 2026 el dark mode con acentos vivos y glow sutil es casi un requisito para productos data-heavy/fintech (Mercury, Stripe, Cash App — Site of the Day en Awwwards), y la tipografía oversized con datos tabulares es el patrón dominante en fintech SaaS.
- Emoción target (precisión/control/asombro) ↔ Tech Neo-Futurista es el match exacto de la tabla de direcciones.

**Referencias tomadas (Fase 0.2):**
- [Awwwards — Fintech Design](https://www.awwwards.com/inspiration/fintech-design-basis) — dark + acentos vibrantes, producto mostrado en vivo, no ilustraciones.
- [DesignRevision — Fintech SaaS Landing Pages 2026](https://designrevision.com/blog/fintech-saas-landing-pages) — mostrar el producto real, social proof cuantificado, tipografía maximalista en hero.
- [Tubik — UI Design Trends 2026](https://blog.tubikstudio.com/ui-design-trends-2026/) — dark mode con glow sutil para interfaces de uso prolongado.
- [Figma — Web Design Trends 2026](https://www.figma.com/resource-library/web-design-trends/) — tipografía cinética/oversized como storytelling.
- [Webstacks — Fintech Websites](https://www.webstacks.com/blog/fintech-websites) — fuentes tabulares para columnas de cifras alineadas.

---

## 3. Paleta definitiva (heredada de la app — coherencia marca→producto)

| Token | HEX | Rol | Psicología aplicada |
|---|---|---|---|
| `--color-bg` | `#0a0a0a` | Fondo base | Negro profundo: foco total en los datos, lectura prolongada sin fatiga |
| `--color-bg-alt` | `#111111` | Secciones alternas | Ritmo visual entre secciones sin romper el dark |
| `--color-surface` | `#1a1a1a` | Cards, mockups | Capa elevada, jerarquía de profundidad |
| `--color-accent` | `#1C8AFF` | Acento primario, CTAs, links | Azul Gemini: confianza + tecnología — el color que el fintech usa para señalizar estabilidad |
| `--color-accent-2` | `#00BCD4` | Acento secundario, glows | Cyan: precisión instrumental, frialdad de dato |
| `--color-green` | `#00E676` | Rendimiento positivo | Verde señal: ganancia, crecimiento — gatillo emocional del inversor |
| `--color-red` | `#FF1744` | Rendimiento negativo | Rojo señal: pérdida — credibilidad (un tracker que solo muestra verde miente) |
| `--color-border` | `rgba(255,255,255,0.08)` | Bordes | Separación sutil sin pelear con los datos |
| `--color-text-1/2/3` | `#f5f5f5` / `#a0a0a0` / `#555` | Jerarquía de texto | Contraste AA garantizado en text-1 y text-2 |
| `--gradient-gemini` | `linear-gradient(135deg, #4285F4, #0F9D58, #F4B400, #DB4437)` | Momentos de marca (logo, headline hero, borde header) | Firma visual única de Finance Mind — multicolor, jamás purple→blue |

Sombras siempre con color del acento: `0 8px 32px rgba(28,138,255,0.15)`. Nada de gris plano.

---

## 4. Tipografías (Google Fonts CDN, con preconnect)

| Rol | Fuente | Pesos | Por qué |
|---|---|---|---|
| Display + body | **Space Grotesk** | 300/400/500/700 | La fuente de la app — identidad ya establecida. Geométrica con carácter, headlines con `letter-spacing: -.03em` |
| Datos / labels / ticker | **JetBrains Mono** | 400/500/700 | Tabular: las cifras alinean perfecto en columnas. Refuerza el lenguaje "terminal financiera" |

Escala fluida con `clamp()`: `--text-hero: clamp(2.8rem, 8vw, 7rem)`. Prohibido Inter/Roboto/Arial en cualquier parte.

---

## 5. Arquitectura de secciones (Layout Map — Regla #0)

Validación: 8 layouts distintos, ninguno repetido en secciones consecutivas. Padding vertical alternado denso (~48–64px) / espaciado (~120–140px).

| # | Sección | Layout específico | Cómo rompe la linealidad | Padding |
|---|---|---|---|---|
| 0 | **Loader** | Contador 0→100% estilo terminal: logo Finance Mind + cifra mono + barra con gradiente Gemini | Intro screen obligatoria, reveal del hero en cascada | — |
| 1 | **Hero** | **Split asimétrico 60/40**: texto izquierda (tag mono + H1 oversized con palabra en gradiente Gemini + sub + 2 CTAs), derecha mockup del dashboard en HTML/CSS con tilt 3D y números latiendo | Fondo: orbs aurora Gemini + canvas de partículas conectadas (constelación de datos). El mockup sangra fuera de la grilla por la derecha | 140px |
| 2 | **Ticker marquee** ⚓ | **Full-bleed breakout** (`100vw`): marquee infinito de CEDEARs (AAPL, NVDA, MSFT…) con precio ARS y variación % verde/roja actualizándose en vivo | Elemento anchor — la landing ES el producto. Doble fila, direcciones opuestas | 48px |
| 3 | **Features** | **Bento Grid** (`grid-template-areas`, celda 2×2 + 1×2 + 1×1s): cada card con micro-demo viva — mini pie chart SVG animado, sparkline, contador, badge export | Densidad controlada, celdas de tamaños distintos, hover lift + glow azul | 120px |
| 4 | **Stats** | **Data Immersive**: "+XX,X%" gigante de fondo (15vw, opacity 0.04) + 4 contadores animados en primer plano (count-up con ScrollTrigger) | El número ES el fondo. Sin cards iguales en fila | 64px |
| 5 | **Cómo funciona** | **Z-Pattern numerado** (3 pasos alternando lados, línea conectora vertical con gradiente que se dibuja al scroll) | Alterna izquierda/derecha, números 01/02/03 oversized en mono | 120px |
| 6 | **Exportación** | **Asimétrico 65/35 con offset**: texto a la derecha (35), pila de 3 documentos mock (Excel/PDF/Word) superpuestos en abanico a la izquierda (65), desfasados verticalmente | Los documentos se despliegan en abanico al entrar en viewport | 96px |
| 7 | **Privacidad** | **Full-bleed con texto superpuesto**: fondo de grid de celdas tipo planilla apagándose, headline centrado superpuesto "Tus datos nunca salen de tu navegador" | Única sección centrada — el contraste con todo lo anterior es el efecto | 120px |
| 8 | **Testimonios** | **Sticky sidebar + scroll de cards**: columna izquierda fija (título + rating), derecha 3 cards glass que scrollean | Sin carrusel. Cards con borde que se enciende al pasar | 96px |
| 9 | **CTA final** | **Full-bleed dramático a sangre**: headline gigante (clamp hasta 9rem) con gradiente Gemini animado, orbs intensificados, un solo botón | Sin box, sin borde — tipografía como diseño | 140px |
| 10 | **Footer** | Magazine 3 columnas: logo+claim / nav / legal+stack | Libre | 64px |

---

## 6. Copywriting completo (es-AR rioplatense, cero lorem ipsum)

### Loader
`FINANCE MIND` · `Cargando mercado… {n}%`

### Hero
- **Tag (mono):** `PORTFOLIO TRACKER · CEDEARS · TIEMPO REAL`
- **H1:** "Tus CEDEARs, **en vivo**. Tu estrategia, bajo control." *(«en vivo» con gradiente Gemini animado)*
- **Sub:** "Finance Mind sigue cada activo de tu cartera al segundo: rendimiento, peso, evolución y exportación profesional. Sin registros, sin servidores, sin humo — todo corre en tu navegador."
- **CTA primario:** `Abrir Finance Mind →`
- **CTA secundario:** `Ver cómo funciona ↓`
- **Microcopy bajo CTA (mono):** `Gratis · Sin cuenta · Tus datos quedan en tu dispositivo`

### Ticker marquee
Tickers con datos simulados: `AAPL Apple $24.350 ▲ +1,24%` · `NVDA NVIDIA $31.820 ▲ +2,67%` · `TSLA Tesla $18.940 ▼ -0,83%` · `MSFT Microsoft $28.115 ▲ +0,45%` · `GOOGL Alphabet $9.870 ▼ -0,21%` · `META Meta $22.480 ▲ +1,02%` · `AMZN Amazon $15.230 ▲ +0,67%` · `JPM JPMorgan $12.940 ▲ +0,12%`

### Features (Bento)
- **Tag de sección:** `EL PRODUCTO`
- **H2:** "Todo lo que tu Excel no puede hacer"
- **Card 1 (2×2) — Dashboard en vivo:** "Tu cartera, latiendo. Torta de pesos, barras de valor y cada activo actualizándose segundo a segundo. Verde cuando ganás, rojo cuando no — sin maquillaje." *(micro-demo: mini pie chart SVG animado + fila de activo con número vivo)*
- **Card 2 (1×2) — Estadísticas que importan:** "Volatilidad, máximo drawdown, mejor y peor activo del período. Diario, semanal o mensual — vos elegís la lupa." *(micro-demo: sparkline SVG dibujándose)*
- **Card 3 (1×1) — Carga en segundos:** "Ticker, precio de compra, cantidad, fecha. Cuatro campos y tu activo ya está trackeado."
- **Card 4 (1×1) — Exportación pro:** "Excel, PDF o Word con un clic. Tu planilla, lista para el contador." *(badges .xlsx .pdf .docx)*
- **Card 5 (1×1) — CEDEARs nativos:** "Apple, NVIDIA, Tesla y los tickers más operados de BALANZ, mapeados de fábrica."

### Stats (Data Immersive — fondo gigante: `+24,7%`)
- **Tag:** `EN NÚMEROS`
- `1 seg` — frecuencia de actualización de precios
- `3` — formatos de exportación profesional
- `9+` — CEDEARs soportados de fábrica
- `0` — datos enviados a servidores. Cero.

### Cómo funciona (Z-Pattern)
- **Tag:** `EL FLUJO` / **H2:** "De cero a portfolio en tres pasos"
- **01 — Cargá tus activos.** "Buscá el ticker, poné precio de compra y cantidad. El autocomplete hace el resto."
- **02 — Mirá el mercado moverse.** "Dashboard en tiempo real: rendimiento en %, en pesos y el peso de cada activo en tu cartera."
- **03 — Exportá y listo.** "Bajá tu planilla en Excel, PDF o Word. Historial completo de movimientos, formateado como corresponde."

### Exportación (65/35)
- **Tag:** `LA PLANILLA` / **H2:** "Tu cartera también existe fuera de la app"
- **Body:** "Cada compra y cada venta queda registrada en la planilla de movimientos. Cuando la necesités — para tu contador, para tu registro, para vos — la exportás en el formato que quieras. Excel con hoja resumen, PDF estilizado o Word editable."
- **CTA terciario:** `Probar la exportación →`

### Privacidad (Full-bleed)
- **H2:** "Tus datos nunca salen de tu navegador"
- **Body:** "Finance Mind no tiene cuentas, no tiene servidores y no tiene curiosidad. Tu portfolio vive en el localStorage de tu dispositivo: nadie más lo ve, nadie más lo toca. Cerrás la pestaña y sigue ahí. Lo borrás vos, cuando quieras."

### Testimonios (sticky + cards) — *testimonios ilustrativos, redactados como reales*
- **Tag:** `QUIENES YA LO USAN` / **H2 (columna fija):** "Inversores que dejaron el Excel"
- "Llevaba mi cartera en una planilla con fórmulas rotas desde 2022. Esto la reemplazó en una tarde." — **Martín G., inversor minorista, CABA**
- "Lo que más valoro: abro la app y en dos segundos sé si voy ganando o perdiendo. Sin login, sin esperas." — **Carolina R., analista contable, Rosario**
- "La exportación a Excel me ahorra armar el resumen para mi contador todos los meses." — **Federico L., desarrollador, Córdoba**

### CTA final (Full-bleed)
- **H2 gigante:** "Empezá a trackear **hoy**."
- **Sub:** "Gratis. Sin registro. Sin vueltas."
- **CTA:** `Abrir Finance Mind →`

### Footer
- Claim: "Finance Mind — precisión para tu portfolio."
- Nav: Producto · Cómo funciona · Privacidad
- Legal: "Los precios mostrados en esta página son simulados con fines demostrativos. Finance Mind no es asesoramiento financiero." · `© 2026 Finance Mind`

---

## 7. SEO (on-page)

**Keywords:**

| Keyword | Tipo | Intención | Prioridad |
|---|---|---|---|
| portfolio tracker CEDEARs | Primaria | Transaccional | Alta |
| seguimiento de cartera CEDEARs | Secundaria | Comercial | Alta |
| app para trackear inversiones Argentina | Secundaria | Comercial | Media |
| exportar portfolio a Excel | Soporte | Transaccional | Media |
| rendimiento CEDEARs en tiempo real | Soporte | Informacional | Media |

**Meta tags:**
- `<title>` (58 ch): `Finance Mind — Portfolio Tracker de CEDEARs en Tiempo Real`
- `<meta description>` (155 ch): `Seguí tus CEDEARs en tiempo real: rendimiento, estadísticas y exportación a Excel, PDF y Word. Gratis, sin registro y 100% privado. Abrí Finance Mind.`
- Open Graph completo (og:title, og:description, og:image 1200×630 — placeholder SVG→PNG documentado), canonical, `lang="es-AR"`.
- **JSON-LD:** `SoftwareApplication` (applicationCategory: FinanceApplication, offers price 0, operatingSystem: Web).
- Un solo H1 (hero). H2 por sección con keywords secundarias naturales. HTML semántico: `header / nav / main / section / footer`, ARIA labels y roles.

---

## 8. Plan de assets

**Cero imágenes externas — todo SVG inline y HTML/CSS.** Sin requests de imagen = sin layout shift, peso mínimo, calidad infinita en retina.

| Asset | Técnica | Notas |
|---|---|---|
| Logo Finance Mind | SVG inline, monograma "FM" con gradiente Gemini | Mismo lenguaje que el logo de la app |
| Mockup dashboard (hero) | HTML/CSS puro: header mini, pie chart en `conic-gradient`, barras CSS, 3 filas de activos con números JS en vivo | Es el "screenshot" del producto, pero vivo |
| Mini-charts del Bento | SVG inline (pie, sparkline con `stroke-dashoffset`) | Animados con ScrollTrigger |
| Documentos export (sección 6) | Cards HTML/CSS con ícono SVG por formato | Verde Excel `#1D6F42`, rojo PDF, azul Word — colores de marca de cada formato |
| Fondo hero | Canvas partículas + orbs CSS blur | `prefers-reduced-motion`: orbs estáticos, canvas off |
| og:image | Placeholder: generar a futuro screenshot 1200×630 del hero | Comentado en el HTML con prompt sugerido |
| Favicon | SVG data-URI con el monograma | — |

---

## 9. Stack y estructura de archivos

GSAP 3.12.5 + ScrollTrigger (cdnjs) · Lenis 1.0.42 (jsdelivr) · Vanilla JS para ticker/contadores/partículas.

```
landing/
├── index.html
├── styles/
│   ├── tokens.css        ← design tokens (paleta, tipo, easing, sombras)
│   ├── main.css          ← layout de las 10 secciones + componentes
│   └── animations.css    ← keyframes, reveals, loader, marquee
└── scripts/
    ├── main.js           ← init, Lenis, nav inteligente, reveals
    ├── loader.js         ← contador + reveal hero
    ├── ticker.js         ← simulador de precios (marquee + mockup hero)
    └── particles.js      ← canvas constelación
```

**Easing:** `--ease-smooth: cubic-bezier(0.22,1,0.36,1)` (el de la app) + `--ease-expo: cubic-bezier(0.87,0,0.13,1)` para fills de botón. Prohibido `transition: all .3s ease`.

---

## 10. Checklist de ejecución

1. [ ] `landing/` + `tokens.css` (paleta, tipografía, spacing 8px, easing, sombras con color)
2. [ ] `index.html`: head SEO completo (meta, OG, JSON-LD, preconnect fonts, favicon SVG)
3. [ ] Loader terminal (contador + barra Gemini) con reveal en cascada del hero
4. [ ] Hero split 60/40: copy + mockup dashboard vivo + orbs + canvas partículas
5. [ ] Ticker marquee full-bleed con simulador de precios compartido
6. [ ] Bento Grid de features con micro-demos SVG
7. [ ] Stats Data Immersive con count-up por ScrollTrigger
8. [ ] Z-Pattern "Cómo funciona" con línea conectora dibujándose
9. [ ] Exportación 65/35 con abanico de documentos
10. [ ] Privacidad full-bleed + Testimonios sticky + CTA final dramático + Footer
11. [ ] Microinteracciones: botón fill desde abajo, links underline animado, cards lift + glow azul, cursor custom desktop, nav inteligente
12. [ ] `prefers-reduced-motion` global
13. [ ] Responsive 375px: hamburger, ticker simplificado, bento 1 col, sin overflow-x
14. [ ] QA: checklist de entrega web-designer-elite completo + verificación en preview (375/768/1440)

---

## Reglas heredadas (no negociables)

- Anti-layout lineal: ninguna sección consecutiva repite patrón (validado en §5)
- Solo animar `transform`/`opacity` · CDNs solo cdnjs/jsdelivr · spacing escala 8px
- Sin Inter/Roboto/Arial · sin gradiente purple→blue · sombras siempre con color de acento
- Contraste WCAG AA, focus visibles, ARIA, HTML semántico · sin `console.log` en producción

---

## 11. Base de Datos de CEDEARs — Plan y Especificación

> Estado: **EN CONSTRUCCIÓN** (junio 2026)
> Ubicación: `/landing/db/`

### Objetivo

Base de datos JSON local con los **342+ CEDEARs habilitados en BYMA** (que son los mismos que ofrece Balanz). Datos estáticos (ticker, nombre, ratio, sector) + estructura para datos dinámicos (precio, variación) actualizables vía API pública gratuita.

### Fuente de datos oficial

| Recurso | URL | Auth | Delay | Uso |
|---------|-----|------|-------|-----|
| Open BYMA Data | `open.bymadata.com.ar` | No | 20 min | Cotizaciones gratuitas |
| PyOBD (Python) | `pip install pyobd` → `BymaData().get_cedears()` | No | 20 min | Wrapper para consumir Open BYMA Data |
| BYMA PDF oficial | `byma.com.ar` → Productos → CEDEARs | No | Estático | Lista oficial de tickers + ratios |
| BYMA API pagada | `api-mgr.byma.com.ar` | Sí | Real-time | Snapshot/Delayed/EndOfDay (requiere `client_id`+`client_secret`) |

### Estructura de archivos

```
landing/db/
├── cedears-db.json        ← DB completa: 342+ registros (ticker, nombre, ratio, mercado, sector, país)
├── update-cedears.js      ← Script Node.js: fetch Open BYMA Data → actualiza precios en el JSON
└── README-db.md           ← Instrucciones de uso y actualización
```

### Schema de cada registro

```json
{
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "ratio": "20:1",
  "market": "NASDAQ",
  "sector": "Technology",
  "country": "US"
}
```

Campos dinámicos (agregados por `update-cedears.js`): `lastPrice`, `change`, `changePercent`, `volume`, `lastUpdate`.

### Script de actualización

`update-cedears.js` consume `open.bymadata.com.ar` (endpoint CEDEARs, sin auth), parsea el JSON y actualiza `cedears-db.json` con precios frescos. Se corre con `node landing/db/update-cedears.js`.

### Categorías de CEDEARs incluidos

- **Acciones US** (~300): AAPL, NVDA, TSLA, MSFT, GOOGL, AMZN, META, JPM, etc.
- **Acciones BR/otros** (~20): PBR, VALE, ABEV, BABA, etc.
- **ETFs** (~25): SPY, QQQ, EEM, IWM, ACWI, XLE, SMH, ARKK, etc.
- **Nuevos 2025-2026**: HOOD (29:1), CRWV (27:1), SMH (50:1), SPXL (25:1), URA (5:1), CIBR (10:1), XLU (15:1)

---

## 12. App Portfolio Tracker — Especificación

> Estado: **CONSTRUIDA** (junio 2026)
> Ubicación: `/app/` (HTML + CSS + JS vanilla + Chart.js)
> La landing linkea a `/app/` desde todos los CTAs "Abrir Finance Mind".

### Objetivo

App de portfolio tracking de CEDEARs que consume la base de datos de `/landing/db/cedears-db.json`. El usuario carga sus activos, ve gráficos de torta y barras generados automáticamente, y exporta en CSV/Excel/PDF.

### Arquitectura

```
app/
├── index.html          ← App completa (SPA vanilla)
├── styles/
│   ├── tokens.css      ← Mismos design tokens que la landing
│   └── app.css         ← Layout de la app, tabla, forms, charts
└── scripts/
    └── app.js          ← Lógica: portfolio CRUD, charts (Chart.js), export, autocomplete
```

### Funcionalidades

1. **Resumen del portfolio**: 4 cards (valor ARS, valor USD, P&L, cantidad de activos)
2. **Gráfico de torta (doughnut)**: distribución porcentual por activo — se genera automáticamente al agregar posiciones
3. **Gráfico de barras**: valor por activo con colores por P&L — horizontal si >6 activos
4. **Formulario de carga**: autocomplete desde la DB de 422 CEDEARs, precio de compra, cantidad, fecha
5. **Tabla de tenencias**: ticker, nombre, cantidad, precio compra/actual, valor ARS/USD, peso %, P&L, variación diaria, botón eliminar
6. **Dólar CCL configurable**: input para que el usuario ponga su tipo de cambio — se persiste en localStorage
7. **Exportación**: CSV (UTF-8 con BOM), Excel (XML SpreadsheetML), PDF (HTML con window.print)
8. **Persistencia**: portfolio en localStorage (`fm_portfolio`), CCL en localStorage (`fm_ccl`)
9. **Precios actualizados**: lee `cedears-db.json` que se actualiza con `node landing/db/update-cedears.js`

### Stack

- HTML semántico + CSS variables (mismo design system que landing)
- Chart.js 4.4.7 desde cdnjs.cloudflare.com
- Vanilla JS (IIFE, sin framework)
- Datos en localStorage (sin servidor, sin auth, privacidad total)

### Estilo visual

Hereda 100% de la landing: dark `#0a0a0a`, Space Grotesk, JetBrains Mono, acento `#1C8AFF`, sombras con color, glassmorphism en header, responsive 480/768/1024.

### Reglas

- Sin Inter/Roboto/Arial — solo Space Grotesk + JetBrains Mono
- Colores solo via CSS variables — nunca hex hardcodeado
- Spacing escala 8px — sin valores inventados
- `prefers-reduced-motion` implementado
- Sin `console.log` en producción
