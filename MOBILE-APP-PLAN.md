# Plan: Finance Mind — App Mobile & Landing Mobile

> Plan paso a paso para convertir el portfolio tracker y la landing en una experiencia mobile nativa-like, usando el mismo código con mejoras en media queries.
> Fecha: julio 2026.

---

## Diagnóstico actual

### Lo que ya funciona en mobile
- Bottom nav con 5 tabs (Inicio, Cartera, Mercado, Actividad, Watchlist)
- Sidebar se oculta y se transforma en drawer (translateX)
- Header se reduce a 56px con search icon y botón "+"
- Cards de holdings reemplazan la tabla desktop
- Responsive breakpoints existentes: 1100px, 900px, 768px, 480px
- `viewport-fit=cover` y `safe-area-inset-bottom` en bottom nav
- Meta tags PWA (`apple-mobile-web-app-capable`, `theme-color`)
- Fuentes y tokens CSS compartidos desktop/mobile

### Problemas detectados en mobile
1. **Colores inconsistentes**: el sidebar mobile usa `background: var(--color-bg)` (#000000) pero el header usa `rgba(0,0,0,0.85)` con backdrop-filter cuando hace scroll. La bottom-nav usa `rgba(10,10,10,0.96)`. Hay que unificar fondos.
2. **Padding/spacing excesivos**: `.content` en mobile usa `padding: var(--s2)` (16px) — poco espacio para datos financieros densos.
3. **Tipografía no optimizada para mobile**: los `clamp()` están pensados para desktop, en 375px algunos textos quedan muy chicos o muy grandes.
4. **Cards de mercado en grid 1fr**: las cards de mercado en mobile se apilan sin aprovechar el ancho.
5. **Gráficos**: Chart.js no tiene tamaño mínimo en mobile, pueden quedar aplastados.
6. **Touch targets**: algunos botones no alcanzan 44x44px mínimo para touch.
7. **Export overlay**: funciona pero puede mejorar el tamaño de los targets en mobile.
8. **Settings grid**: las cards de ajustes se apilan sin padding adecuado.
9. **Empty states**: las ilustraciones SVG no escalan bien en pantallas chicas.
10. **No hay pull-to-refresh** ni gestos nativos.
11. **Sin splash screen** PWA definido.
12. **Search overlay**: funciona pero el input queda pegado arriba sin padding.

---

## Plan paso a paso

### FASE 1: Unificar colores mobile = desktop (Prioridad ALTA)

**Objetivo**: que el mobile se vea idéntico al desktop en paleta de colores.

**Archivos a tocar**: `app-v2/styles/tokens.css`, `app-v2/styles/app.css`

- [ ] **1.1** Unificar fondo del bottom-nav: cambiar `rgba(10,10,10,0.96)` → `rgba(0,0,0,0.92)` con backdrop-filter
- [ ] **1.2** Unificar header scrolled mobile: mismo tratamiento que desktop
- [ ] **1.3** Sidebar mobile: cambiar `background: var(--color-bg)` → mismo que desktop (`var(--color-bg-alt)`)
- [ ] **1.4** Verificar que `--color-surface` y `--color-surface-2` se usen igual en cards mobile
- [ ] **1.5** Summary cards en mobile: asegurar que los bordes laterales de color (verde, azul, amarillo) se vean iguales
- [ ] **1.6** Eliminar cualquier override de color específico de media queries mobile

---

### FASE 2: Dashboard mobile — nivel app bancaria premium (Prioridad ALTA)

**Objetivo**: que el dashboard mobile se sienta como Revolut/N26 — un hero balance protagonista, métricas compactas, y una lista de holdings limpia y escaneable.

**Archivos a tocar**: `app-v2/styles/app.css`, `app-v2/scripts/ui/dashboard.js`

- [ ] **2.1** **Hero balance**: la card "Valor ARS" ocupa todo el ancho en mobile, valor grande centrado (~2rem mono), label uppercase discreto, glow radial sutil del acento de fondo. Es lo primero que ve el usuario al abrir la app.
- [ ] **2.2** **Stat chips**: Valor USD, P&L Total y Activos como 3 chips compactos en fila debajo del hero, con sus barras de color laterales.
- [ ] **2.3** **Holdings como lista de trading app**: rediseñar `.holding-card` mobile — una fila compacta: logo + símbolo/nombre a la izquierda, valor + pill de P&L% coloreada a la derecha. Nada de 6 filas verticales por activo.
- [ ] **2.4** **Tap para expandir**: tocar una holding card despliega los detalles (precio, cantidad, día, eliminar) con animación suave — patrón accordion.
- [ ] **2.5** **Charts**: doughnut con legend abajo (no a la derecha) en mobile, altura mínima 220px, padding interno reducido.
- [ ] **2.6** **Entrada animada**: las cards del dashboard aparecen con stagger sutil (fade + translateY) al cargar la vista.
- [ ] **2.7** Page head compacto: label + h1 con menos margen, jerarquía clara.

---

### FASE 3: Cartera / Activos mobile — detalle por activo premium (Prioridad ALTA)

**Objetivo**: la vista Cartera como una lista de posiciones profesional — cada activo es una card tocable con jerarquía clara: qué tengo, cuánto vale, cuánto gano.

**Archivos a tocar**: `app-v2/styles/app.css`, `app-v2/scripts/ui/assets.js`

- [ ] **3.1** **Asset rows como cards**: en mobile cada `.asset-row` se ve como card independiente (fondo surface-2, borde redondeado, separación) — no filas de tabla apretadas.
- [ ] **3.2** **Jerarquía en 2 niveles**: colapsada muestra logo + símbolo/nombre + P&L coloreado con flecha ▲▼; expandida (tap) revela tipo, invertido, precio compra con animación de altura suave.
- [ ] **3.3** **P&L como pill**: la ganancia/pérdida con fondo tenue verde/rojo (`rgba` del color al 10%), no solo texto coloreado — se escanea de un vistazo.
- [ ] **3.4** **Botón "Exportar"** icon-only en < 480px (solo el ícono de descarga, 44x44px touch target).
- [ ] **3.5** **Empty state**: ilustración centrada con `max-width` proporcional en mobile, CTA "+ Agregar primer activo" visible sin scroll.
- [ ] **3.6** **Consistencia con dashboard**: mismas holding cards del punto 2.3/2.4 — un solo lenguaje visual en toda la app.

---

### FASE 4: Layout mobile — Mercados (Prioridad MEDIA)

**Archivos a tocar**: `app-v2/styles/app.css`, `app-v2/scripts/ui/markets.js`

- [ ] **4.1** Category grid: en mobile < 480px usar grid `1fr 1fr` para los chips de categoría
- [ ] **4.2** Market cards: asegurar que el logo, nombre y precio sean legibles
- [ ] **4.3** Agregar scroll horizontal por categoría como alternativa al grid vertical

---

### FASE 5: Layout mobile — Watchlist (Prioridad MEDIA)

**Archivos a tocar**: `app-v2/styles/app.css`

- [ ] **5.1** Watchlist cards mobile: mismo tratamiento que holdings cards
- [ ] **5.2** Botón "Agregar": reducir a icon-only en mobile chico
- [ ] **5.3** Empty state: centrar ilustración en mobile

---

### FASE 6: Layout mobile — Actividad / Movimientos (Prioridad MEDIA)

**Archivos a tocar**: `app-v2/styles/app.css`

- [ ] **6.1** Movement rows: stack vertical en mobile (símbolo + fecha arriba, monto abajo)
- [ ] **6.2** Botones "Borrar historial" + "Exportar CSV": stack vertical en mobile < 480px
- [ ] **6.3** Movement list: reducir gap entre rows

---

### FASE 7: Layout mobile — Ajustes (Prioridad BAJA)

**Archivos a tocar**: `app-v2/styles/app.css`

- [ ] **7.1** Settings grid: 1 columna en mobile (ya debería ser así, verificar)
- [ ] **7.2** Settings card padding: adecuado para touch
- [ ] **7.3** Dólar panel rows: touch targets de 48px mínimo

---

### FASE 8: Interacciones touch (Prioridad ALTA)

**Archivos a tocar**: `app-v2/styles/app.css`, `app-v2/scripts/app.js`

- [ ] **8.1** Touch targets mínimos 44x44px en todos los botones y links clickeables
- [ ] **8.2** Desactivar hover effects en touch devices (`@media (hover: hover)`)
- [ ] **8.3** Active states (`:active`) con feedback visual inmediato para touch
- [ ] **8.4** Scroll smooth nativo sin Lenis en mobile (mejor rendimiento)
- [ ] **8.5** Tap delay: agregar `touch-action: manipulation` global

---

### FASE 9: Header y navegación mobile (Prioridad ALTA)

**Archivos a tocar**: `app-v2/styles/app.css`, `app-v2/index.html`

- [ ] **9.1** Header mobile: logo + search icon + "+" button, bien espaciados
- [ ] **9.2** Bottom nav: active indicator (dot o barra) debajo del ítem activo — ya existe, verificar
- [ ] **9.3** Bottom nav: haptic-feel con scale animation en tap
- [ ] **9.4** Safe areas: verificar que `env(safe-area-inset-bottom)` funcione en iPhone con notch
- [ ] **9.5** Search overlay mobile: full-screen con input grande y resultados scrolleables

---

### FASE 10: PWA — Instalable como app (Prioridad ALTA)

**Archivos a tocar**: `app-v2/manifest.json` (crear), `app-v2/index.html`, `app-v2/sw.js` (crear)

- [ ] **10.1** Crear `manifest.json` con:
  - `name`: "Finance Mind"
  - `short_name`: "Finance Mind"
  - `start_url`: "/app-v2/"
  - `display`: "standalone"
  - `background_color`: "#000000"
  - `theme_color`: "#0a0a0f"
  - `icons`: array con 192px y 512px
  - `orientation`: "portrait"
- [ ] **10.2** Crear iconos PNG 192x192 y 512x512 (convertir el SVG actual)
- [ ] **10.3** Link al manifest en `<head>`
- [ ] **10.4** Service Worker básico para cache de assets estáticos (HTML, CSS, JS, fuentes)
- [ ] **10.5** Splash screen: meta tags para iOS (`apple-touch-startup-image`)
- [ ] **10.6** Verificar que `apple-mobile-web-app-capable` y `apple-mobile-web-app-status-bar-style` estén correctos

---

### FASE 11: Performance mobile (Prioridad MEDIA)

**Archivos a tocar**: varios

- [ ] **11.1** Lazy load de Chart.js: solo cargar cuando se ve la sección de gráficos
- [ ] **11.2** Lazy load de XLSX y jsPDF: ya implementado, verificar
- [ ] **11.3** `will-change: transform` solo en elementos que realmente animan
- [ ] **11.4** Reducir animaciones en mobile con `prefers-reduced-motion` y detección de dispositivos lentos
- [ ] **11.5** Font display swap: ya implementado, verificar `display=swap`
- [ ] **11.6** Preconnect a APIs externas (dolarapi.com, Yahoo proxy)

---

### FASE 12: Landing page mobile (Prioridad MEDIA)

**Archivos a tocar**: `landing/styles/main.css`, `landing/index.html`

- [ ] **12.1** Verificar que el burger menu funcione correctamente
- [ ] **12.2** Hero: texto y CTA bien centrados en mobile
- [ ] **12.3** Bento grid: ya responsive, verificar visual
- [ ] **12.4** Steps/pasos: verificar que el timeline se vea bien en mobile
- [ ] **12.5** Doc stack animation: verificar que no rompa en mobile
- [ ] **12.6** Footer: verificar que los links se vean bien en 1 columna
- [ ] **12.7** CTA flotante: considerar agregar un CTA sticky en la bottom de la landing mobile
- [ ] **12.8** Ticker marquee: verificar velocidad y legibilidad en mobile

---

### FASE 13: Cosas que NO tocar / que se quedan como están

- **Routing hash-based**: funciona perfecto en PWA, no cambiar
- **localStorage como storage**: sin servidor, se queda
- **Yahoo Finance proxy via Cloudflare**: se queda
- **Dolar API**: se queda
- **Paleta de colores base**: se queda (solo unificar mobile)
- **Tipografía Space Grotesk + JetBrains Mono**: se queda
- **Vanilla JS sin framework**: se queda
- **Trial/paywall sistema**: se queda
- **SVG icons inline**: se queda
- **3 archivos CSS separados** (tokens, app, animations): se queda
- **Estructura de carpetas**: se queda
- **Export overlay fullscreen**: se queda, solo mejorar touch
- **Bottom nav con 5 tabs**: se queda
- **Search overlay**: se queda, solo mejorar mobile

---

### FASE 14: Cosas que SACAR / eliminar en mobile

- [ ] **14.1** Sidebar drawer en mobile: ELIMINAR. El bottom nav es suficiente. El sidebar solo se usa en desktop ≥768px. Sacar el menu-toggle hamburger del header mobile.
- [ ] **14.2** `Ctrl+K` shortcut label en search trigger mobile: ya se oculta, confirmar
- [ ] **14.3** Hover tooltips: no funcionan en touch, asegurar que no dependan de hover
- [ ] **14.4** Scrollbar custom: no se ve en mobile, ignorar

---

### FASE 15: Cosas que AGREGAR para mobile

- [ ] **15.1** Pull-to-refresh visual indicator (CSS-only con overscroll-behavior)
- [ ] **15.2** Splash screen PWA
- [ ] **15.3** Offline indicator: banner sutil cuando no hay conexión
- [ ] **15.4** App install prompt: botón en settings para instalar como PWA
- [ ] **15.5** Vibration API: feedback háptico sutil en acciones clave (agregar activo, exportar)
- [ ] **15.6** iOS standalone: ocultar bottom browser bar, status bar translúcida

---

## Orden de ejecución recomendado

| Prioridad | Fases | Impacto |
|-----------|-------|---------|
| **1ero** | Fase 1 (colores) + Fase 8 (touch) | Fix visual inmediato |
| **2do** | Fase 2 (dashboard) + Fase 3 (cartera) + Fase 9 (nav) | Las 2 vistas principales |
| **3ero** | Fase 10 (PWA manifest + SW) | Instalable como app |
| **4to** | Fase 4 + 5 + 6 + 7 (vistas secundarias) | Completar todas las vistas |
| **5to** | Fase 14 (sacar) + Fase 15 (agregar) | Polish final |
| **6to** | Fase 11 (performance) + Fase 12 (landing) | Optimización |
| **7mo** | Fase 13 (no tocar) | Solo verificar |

---

## Notas técnicas

- Todo se hace con **CSS media queries** y **JS condicional** — sin framework, sin build step
- El breakpoint principal es `768px` (mobile vs desktop)
- El breakpoint secundario es `480px` (mobile chico)
- Usar `@media (hover: hover)` para separar hover de touch
- Usar `@media (pointer: coarse)` para detectar touch devices
- Testear en: iPhone SE (375x667), iPhone 14 (390x844), Samsung Galaxy S21 (360x800)
- El deploy sigue siendo Cloudflare Workers, push a main = deploy
