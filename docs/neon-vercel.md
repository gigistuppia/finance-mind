# Neon + Vercel + CommonJS — guía de la fase 1

> Investigado y verificado en agosto 2026. Insumo directo de la fase 1
> (`lib/db.js`, `lib/schema.sql`, `/api/sync`, `/api/report`).

---

## 1. El hallazgo que desbloquea todo

**`@neondatabase/serverless` funciona con `require()`.** Verificado leyendo el
`package.json` publicado de la versión 1.1.0 en el registry de npm:

```json
"exports": { "import": "./index.mjs", "require": "./index.js" },
"engines": { "node": ">=19.0.0" }
```

Es un paquete dual. **Nuestra decisión de no declarar `"type": "module"`** —tomada para no
romper `netlify/functions/*.js` durante la migración— **no bloquea nada.**

`package.json` declara `"node": ">=20"`, que Vercel mapea a Node 24.x. Compatible.

---

## 2. Alta

```bash
vercel install neon --name finance-mind-db --plan free -e production -e preview -e development
npm i @neondatabase/serverless
```

⚠️ Genera `.env.local` con credenciales reales. **Verificar que esté en `.gitignore` antes.**

**Región: AWS us-east-1**, para acompañar el `iad1` que verificamos en la fase 00. Poner la
base en Europa hace que cada query del pipeline pague el cruce del Atlántico, multiplicado
por la cantidad de símbolos.

### Variables inyectadas

| Variable | Tipo | Uso |
|---|---|---|
| `DATABASE_URL` | **Pooled** (PgBouncer) | **Las funciones de `/api/`** |
| `DATABASE_URL_UNPOOLED` | Direct | **Migraciones**, `pg_dump`, sesiones con estado |
| `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | Sueltas | Armar strings a medida |
| `POSTGRES_*` | Legacy | No usar. Los nombres exactos no están documentados |

El pooler está en **transaction mode**: no persiste `SET`/`RESET` entre transacciones, ni
`LISTEN`/`NOTIFY`, ni tablas temporales de sesión. El error más común es un `SET search_path`
que se evapora — se evita calificando el esquema (`public.reports`).

---

## 3. Límites del free tier (y cuál nos aprieta de verdad)

| Recurso | Límite |
|---|---|
| **Storage** | **0.5 GB por proyecto** ← **este es nuestro techo real** |
| Cómputo | 100 CU-hours/mes (≈400 h a 0.25 CU) |
| Scale to zero | **5 min de inactividad, no se puede desactivar en Free** |
| Branches | 10 por proyecto |

**El autosuspend NO rompe el cron.** Reactivar un compute suspendido tarda unos cientos de
milisegundos según la documentación oficial; los benchmarks informales llegan a ~1 s con
handshake incluido. **Es latencia, no error**: el cliente espera, no recibe un rechazo. Sobre
un pipeline de ~10 s por símbolo, es ruido.

Consumo estimado del cron: si el ciclo completo dura ~20 min y la base se suspende 5 min
después, son ~25 min/día a 0.25 CU ≈ **3,2 CU-hours al mes contra 100 disponibles**. Sobra.

**Lo que sí hay que vigilar es el storage.** Un informe JSON por símbolo por día se acumula.
**Poner retención desde el día uno** (borrar informes de más de 90 días).

---

## 4. Cliente: driver HTTP, no TCP

`pg` funciona en Vercel (runtime Node sobre Lambda, APIs completas de Node — lo que no soporta
TCP es el runtime Edge, que no usamos). Pero para nuestro caso conviene el driver HTTP:

| | `neon()` HTTP | `pg` / `Pool` TCP |
|---|---|---|
| Handshake | Ninguno: un `fetch` por query | TCP + TLS + auth por conexión |
| Estado entre invocaciones | No hace falta | Hay que gestionar el pool |
| Transacciones interactivas | No | Sí |
| Fugas de conexión | Imposibles por construcción | El riesgo real |

Nuestro pipeline hace escrituras discretas e independientes por símbolo: es exactamente el
caso de HTTP.

```js
const { neon } = require('@neondatabase/serverless');

// El cliente HTTP es stateless: crearlo a nivel módulo es gratis y no abre
// ningún socket. Se reusa mientras la instancia viva.
const sql = neon(process.env.DATABASE_URL);

const [row] = await sql`SELECT * FROM reports WHERE symbol = ${sym}`;
```

⚠️ **Rompimiento en la v1.0.0**: `sql` solo se puede llamar **como template tag**. Llamarlo
como función (`sql('SELECT ...')`) era vector de inyección SQL y ya no se puede. Para
parámetros dinámicos hay `sql.query(texto, params)`; para interpolar identificadores
confiables, `sql.unsafe()`. Los ejemplos de blogs de 2024 usan la forma vieja y fallan.

---

## 5. Idempotencia — requisito del encadenamiento (§12.3)

`ON CONFLICT` **exige un índice único o constraint** sobre las columnas del conflicto. Sin eso
tira `there is no unique or exclusion constraint matching...`.

**Un informe por símbolo por día** es la clave natural del sistema (§12.2):

```sql
CONSTRAINT reports_symbol_date_uk UNIQUE (symbol, report_date)
```

Refinamiento importante: **un reintento degradado no debe pisar un informe bueno.**

```sql
INSERT INTO reports (symbol, report_date, payload, degraded)
VALUES ($1, $2, $3, $4)
ON CONFLICT (symbol, report_date) DO UPDATE
  SET payload = EXCLUDED.payload, degraded = EXCLUDED.degraded, updated_at = now()
  WHERE reports.degraded = TRUE OR EXCLUDED.degraded = FALSE;
```

**El tope de encadenamientos, atómico.** Contar saltos en memoria no sirve: cada invocación es
un proceso distinto. Se hace en la base, en una sola sentencia, sin lectura previa ni race:

```sql
INSERT INTO cron_runs (run_date, hops)
VALUES (CURRENT_DATE, 1)
ON CONFLICT (run_date) DO UPDATE SET hops = cron_runs.hops + 1
WHERE cron_runs.hops < 20
RETURNING hops;
```

Si devuelve cero filas, ya se llegó al tope: cortar sin encadenar.

---

## 6. Migraciones sin build step

**Camino elegido:** escribir `lib/schema.sql` **idempotente** (`CREATE TABLE IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`) y aplicarlo con:

```bash
psql "$DATABASE_URL_UNPOOLED" -f lib/schema.sql
```

**Usar la UNPOOLED**: el pooler está en transaction mode y las migraciones necesitan sesión.

Alternativa sin instalar nada: el SQL Editor del dashboard de Neon acepta múltiples statements
de una sola vez. Vercel también expone Query/Schema para Neon desde su propio dashboard
(requiere permisos de Owner).

**Descartado:** un endpoint `/api/migrate` protegido por secreto. Es superficie de ataque nueva
a cambio de cero conveniencia, teniendo `psql` y el SQL Editor disponibles.

---

## 7. Trampas

1. **`SET search_path` no persiste** por el pooler. Calificar esquemas completos.
2. **Timeout en la primera conexión del día.** Poner `connectionTimeoutMillis: 10000` si
   alguna vez se usa `pg`; con el driver HTTP no aplica.
3. **Retry con backoff igual**, aunque el autosuspend sea solo latencia.
4. **`.env.local` en git.** `vercel install` lo genera con credenciales reales.
5. **`ON CONFLICT` sin constraint única** → error en runtime, no en deploy.
6. **Roles NOLOGIN en las URLs de preview** de la integración Vercel-Neon: hay reportes de
   usuarios, sin confirmar si sigue vigente. Si las previews no conectan, mirar ahí primero.
7. **Storage, no cómputo.** 0.5 GB es el techo. Retención desde el día uno.
