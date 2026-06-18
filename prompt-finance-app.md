# Finance App — Claude Code Prompt

## Skills activas
Aplicar en orden: `design-taste-frontend` → `impeccable` → `emil-design-eng` + `design-combination.md`

---

## Stack
React + Recharts + Framer Motion + Tailwind. Persistencia: localStorage. Exportación: SheetJS (xlsx), jsPDF, docx.

---

## Estética
**Gemini/Google Labs futurista.** Paleta: negro `#0a0a0a`, superficies `#111`/`#1a1a1a`, acento azul-cyan Gemini `#1C8AFF` + `#00BCD4`, gradientes multicolor tipo Gemini (`linear-gradient(135deg, #4285F4, #0F9D58, #F4B400, #DB4437)`). Tipografía: Google Sans / Space Grotesk + JetBrains Mono para datos. Bordes `rgba(255,255,255,0.08)`. Glassmorphism sutil en cards. Sin gradientes purple genéricos.

---

## Estructura global

**Header fijo** en todas las secciones:
- Logo arriba izquierda (SVG inline — letras iniciales del nombre de la app con gradiente Gemini)
- Nav: Dashboard · Activos · Estadísticas · Planilla
- Cuadro rendimiento total: `[+X.XX% desde inicio]` · `[$ XXX.XXX ARS total invertido]` — actualizado en tiempo real

**Nav lateral** en desktop, bottom bar en mobile.

---

## Sección 1 — Dashboard

### Fila superior: 2 gráficos lado a lado

**Gráfico torta (Recharts PieChart):**
- Representa % de peso de cada activo en el portfolio
- Ordenado mayor → menor peso (clockwise)
- Colores únicos por activo del palette Gemini multicolor
- Tooltip: nombre empresa + ticker + % + $ ARS
- Animación de entrada: `startAngle` rotando con Framer Motion

**Gráfico barras (Recharts BarChart):**
- Mismos activos, mismo orden que torta
- Eje Y: valor en ARS
- Colores coinciden con torta
- Barras con `radius={[4,4,0,0]}` y animación stagger entrada

### Fila inferior: Lista de activos (lo más importante)

Tabla/lista de activos agregados al portfolio. Cada fila:
```
[Logo empresa] [Nombre empresa] [TICKER] | Precio actual | Rendimiento % | Rendimiento ARS | Variación ↑↓
```

**Rendimiento en tiempo real:**
- Simulado con `setInterval(1000)` — variación aleatoria ±0.05% por segundo sobre precio base
- Precio base hardcodeado por ticker (usuario puede editarlo al agregar)
- Rendimiento % = `((precioActual - precioCompra) / precioCompra) * 100`
- Rendimiento ARS = `(precioActual - precioCompra) * cantidad`
- Números en verde `#00E676` si positivo, rojo `#FF1744` si negativo, con transición de color suave

**Nombres CEDEARs simplificados** (mapeo hardcodeado):
```js
const TICKERS = {
  'AAPL': 'Apple', 'MSFT': 'Microsoft', 'GOOGL': 'Alphabet',
  'AMZN': 'Amazon', 'TSLA': 'Tesla', 'META': 'Meta',
  'NVDA': 'NVIDIA', 'BRK': 'Berkshire', 'JPM': 'JPMorgan',
  // expandir con los más comunes de BALANZ
}
```

**Botón "Agregar activo"** — modal con:
- Campo: Ticker (autocomplete con TICKERS)
- Campo: Precio de compra (ARS)
- Campo: Cantidad
- Campo: Fecha de compra
- Al confirmar: agrega a lista + actualiza gráficos + guarda en localStorage

**Nota BALANZ:** El seguimiento de precio real requiere API de BALANZ (no pública). Implementar con precio simulado + comentario en código indicando dónde conectar endpoint real: `// TODO: reemplazar con GET https://api.balanz.com/v1/quotes/{ticker}`

---

## Sección 2 — Activos

Tabla full-screen de todos los activos:
- Columnas: Empresa · Ticker · Precio compra · Precio actual · Cantidad · Valor total · Rendimiento % · Rendimiento ARS · Fecha compra
- Ordenable por cualquier columna (click header)
- Filtro por búsqueda
- Misma animación en tiempo real que Dashboard
- Botón eliminar activo por fila

---

## Sección 3 — Estadísticas

Toggle selector: `Diario` · `Semanal` · `Mensual`

Gráficos (Recharts):
1. **LineChart** — evolución del valor total del portfolio en el período
2. **AreaChart** — rendimiento acumulado %
3. **BarChart** — rendimiento por activo en el período

Cards resumen:
- Mejor activo del período
- Peor activo del período
- Volatilidad promedio
- Máximo drawdown

Datos generados desde historial de movimientos guardado en localStorage.

---

## Sección 4 — Planilla

Tabla de movimientos:
- Columnas: Fecha · Tipo (Compra/Venta) · Activo · Ticker · Cantidad · Precio unitario · Total ARS
- Ordenable y filtrable

Botones de exportación:
```
[Descargar Excel]  [Descargar PDF]  [Descargar Word]
```

- **Excel:** SheetJS — hoja con todos los movimientos + hoja resumen portfolio
- **PDF:** jsPDF + autoTable — tabla estilizada con header de la app
- **Word:** docx.js — documento con tabla de movimientos

---

## Animaciones (Emil Kowalski rules)
- Todos los números que cambian: `transform: translateY` + `opacity` — nunca animar `color` directamente, usar CSS transition
- Entrada de secciones: Framer Motion `initial={{opacity:0, y:20}}` → `animate={{opacity:1, y:0}}`
- Stagger en listas: delay `i * 0.05s`
- Hover en filas de tabla: `background` transition 150ms `ease-out`
- Cambios de rendimiento positivo/negativo: micro-flash de color 200ms
- Gráficos: animación de entrada con `isAnimationActive={true}`
- Duración máxima animaciones UI: 300ms

---

## Persistencia (localStorage)
```js
// Keys
'gm_assets'      // array de activos agregados
'gm_movements'   // array de movimientos compra/venta
'gm_portfolio_start_value' // valor inicial para calcular rendimiento total
'gm_portfolio_start_date'  // fecha de inicio del portfolio
```

---

## Constraints duros
- Sin `ease-in` en ninguna transición
- Solo animar `transform` y `opacity`
- Glassmorphism: `backdrop-filter: blur(12px)` solo en modals y header
- Todos los números monetarios: `Intl.NumberFormat('es-AR', {style:'currency', currency:'ARS'})`
- Todos los porcentajes: `.toFixed(2) + '%'`
- Responsive: funciona en 375px (mobile) y 1440px (desktop)
- Dark mode only — no toggle
- Logo: SVG inline con gradiente Gemini, no imagen externa
