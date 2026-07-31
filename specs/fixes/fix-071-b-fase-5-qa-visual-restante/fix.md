# Fix: Fase 5 QA visual restante — skeletons, capturas, regla 3-2-1
> id: fix-071-b-fase-5-qa-visual-restante
> refs: ASG-b-001
> status: in_progress
> created: 2026-07-31

## Root Cause
[Heredado de ASG-b-001, a confirmar]: las iteraciones 19-21 de la Fase 5 del audit
(`indices/FLOWS-QA-AUDIT.md`) requerían navegador real (Playwright) y quedaron
bloqueadas a mitad de sesión porque el clasificador de seguridad quedó temporalmente
no disponible. El audit original solo capturó evidencia real (Playwright) de Dashboard
y Base Alumnos B — el resto de las ~26 páginas nunca se verificó con navegador, solo
por lectura de código. Tres cosas quedaron sin confirmar con evidencia real:

1. Que los skeletons de carga (`<app-skeleton-block>`) aparecen de verdad en estados de
   red lenta, no solo que el código los referencia.
2. Cómo se ve realmente el resto de las páginas sin capturas.
3. Que la regla 3-2-1 de marca (`var(--ds-brand)` máx 3 elementos/viewport) se respeta
   fuera del Dashboard.

Ampliación de la reunión con el cliente (2026-07-28): en Instructores y Alumnos se
reportó que algunas vistas siguen usando el hero azul antiguo en vez del
`app-section-hero` canónico — se absorbe acá por ser el mismo tipo de hallazgo de
consistencia visual.

## ACs Afectados
Ninguno — fix autónomo de QA visual, no corrige un AC de una spec puntual. Referencia:
`indices/FLOWS-QA-AUDIT.md` Fase 5 (iteraciones 19-21) y `indices/UI-HOMOGENEITY-AUDIT.md`
(patrón "hero en `bento-banner` vs `bento-hero`").

## ⚠️ Bloqueo de entorno (2026-07-31) — CONFIRMADO, no es falta de esfuerzo

Esta sesión corre en el entorno remoto de Claude Code (Cowork/web), **no** en el Claude Code CLI
local del owner. Se investigó a fondo, con dos rondas:

**Ronda 1 — sin `mcp__playwright__*` ni credenciales.** `ToolSearch` confirmó que no hay ningún
tool `mcp__playwright__*` cargable acá (la nota de la propia Asignación ya avisaba: "Reservada
para Benjamín porque requiere el entorno de navegador local"). Tampoco había `.env` con
credenciales para los usuarios de prueba de `indices/FLOWS-QA-AUDIT.md`.

**Ronda 2 — el usuario pidió reintentar ("prueba ahora desde aquí").** Se montó un driver de
Playwright manual (el paquete está instalado globalmente en el entorno + Chromium preinstalado
en `/opt/pw-browsers`), se hizo `npm ci` (`node_modules` no estaba instalado) y se levantó
`ng serve` real en `localhost:4200`. **La pantalla de login del propio proyecto muestra un panel
de "Credenciales de prueba" en desarrollo** (`admin@test.com` / `secretaria@test.com` /
`secretaria2@test.com` / `instructor@test.com` / `alumno@test.com`, contraseña `Test123456`) —
así que el problema de credenciales quedó resuelto solo. Captura: `login-light.png`.

Pero al enviar el login, la llamada a Supabase Auth falla:

```
REQFAIL https://skvekggejikzxhzsjmkz.supabase.co/auth/v1/token?grant_type=password
net::ERR_TUNNEL_CONNECTION_FAILED
```

Diagnóstico vía el status endpoint del proxy de egreso del entorno
(`http://127.0.0.1:45845/__agentproxy/status`, documentado en `/root/.ccr/README.md`):

```json
{
  "kind": "connect_rejected",
  "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
  "host": "skvekggejikzxhzsjmkz.supabase.co:443"
}
```

**Es un 403 de política de egreso a nivel de organización**, no un timeout ni un problema de
configuración del lado del driver — el propio README del proxy es explícito: *"403/407... Do not
retry or route around it — report the blocked host."* Este entorno remoto tiene bloqueado el
dominio del Supabase de desarrollo del proyecto. Ninguna página que dependa de datos reales
(prácticamente todo el panel autenticado, y probablemente también `/inscripcion` público, que
también llama a Supabase) es alcanzable acá, sin importar credenciales ni Playwright.

Sin poder llegar al backend real, **no puedo producir capturas con datos reales, throttling de
red con la app funcionando, ni confirmar visualmente el reclamo del cliente** ("hero azul antiguo
en Instructores y Alumnos"). Lo de abajo es lo que sí alcancé a verificar sin esa pieza — no
reemplaza el QA visual real, es la mejor evidencia disponible en este entorno.

## Cambio

**Sin cambios de código.** Investigación + corrección de documentación (`indices/`), exenta del
Spec Gate.

- **Archivo:** `indices/UI-HOMOGENEITY-AUDIT.md`
  **Qué cambia:** la sección "Tier C — Hero envuelto en `<div class="bento-banner">`" (fechada
  2026-06-14, pre spec-0015) listaba 19 rutas de Instructores/Alumnos con el hero mal ubicado.
  Re-barrido por código (`grep` de `app-section-hero` + `class="bento-hero"`/`density="slim"`)
  de las 19 rutas + `admin/alumno-detalle`: **ninguna tiene ya el bug** — todas aplican el hero
  como celda directa del grid, con el patrón "full + KPIs" (`instructor/alumnos`,
  `alumno/dashboard`, etc.) o "slim" (`admin/instructores`, `secretaria/instructores`,
  `admin/alumno-detalle`), ambos válidos desde spec 0015. Marcado `✅ Resuelto` con nota
  explicando que es verificación de código, no de render — no se tocó ningún `.component.ts`.

## ✅ Sesión 2 (2026-07-31, CLI local) — bloqueo levantado, QA visual real ejecutado

El bloqueo de arriba era **exclusivo del entorno remoto**. Esta sesión corre en el CLI local del
owner: Playwright MCP disponible, `ng serve` en `:4200`, y el Supabase de desarrollo responde
`200` sin proxy de por medio. Sesión ya autenticada como `PEPITO ADMI` con datos reales
(15 alumnos activos, $0.45M ingresos mes). **No se reintentó "rutear alrededor" del 403: es otra
máquina, otra red.**

### Hallazgo 1 — El reclamo del cliente ("hero azul antiguo") ES REAL. Está en los PORTALES.

> ⚠️ **Corrección de esta misma sesión.** La primera pasada leyó "Instructores y Alumnos" como los
> módulos del admin (`/app/admin/instructores`, `/app/admin/alumnos`), los verificó, no encontró
> azul y escribió "no se reproduce". **Estaba mal.** El owner corrigió: el cliente hablaba de los
> **portales** (`/app/instructor/**`, `/app/alumno/**`). Se re-verificó ahí y el reclamo se
> reproduce de inmediato. La conclusión anterior queda anulada — se deja escrita a propósito, como
> recordatorio de que "Instructores/Alumnos" es ambiguo en este dominio y hay que desambiguarlo
> antes de auditar.

**Reproducido** con login real (`instructor@test.com`, `alumno@test.com`). Capturas:
`evidencia/portal-instructor-dashboard-dark.png`, `evidencia/portal-alumno-dashboard-dark.png`.

El hero de los portales es un **bloque azul sólido** que ocupa ~196–250px. Medición:

```
host:  block min-h-0 bento-hero          ← clase canónica, hijo directo del grid
pinta: .surface-hero.hero-card
       background-image: none            ← el gradiente canónico NUNCA se aplica
       background-color: color(srgb 0.175686 0.592941 0.778039)
```

**Causa raíz — es deliberada, no un bug de CSS.** `section-hero.component.ts:86-92`:

```scss
/* ── Solid brand-dark hero ──────────────────────────────
   hero-card sobreescribe solo el background con brand oscuro sólido
   (~sky-700). Sin gradiente: más limpio, más "app", menos "landing". */
.hero-card { background: color-mix(in srgb, var(--ds-brand) 80%, black); }
```

Aritmética confirmada: `#38bdf8` = srgb(0.2196, 0.7412, 0.9725); × 0.8 = **(0.1757, 0.5929, 0.7780)**
— idéntico al valor medido. Idéntico en claro y oscuro (no es un bug de dark mode).

**Por qué el admin no se ve así — y este es el hallazgo de fondo:**

| Zona | Páginas con `app-section-hero` | Con `density="slim"` |
|---|---|---|
| Admin + Secretaría | 26 | **26** ✅ |
| Portal Instructor | 10 | **0** ❌ |
| Portal Alumno | 6 | **0** ❌ |

El rollout del hero slim (**spec 0015**) cubrió admin y secretaría y **nunca llegó a los portales**.
No hay un "hero viejo" separado: es el mismo `SectionHeroComponent`, en su densidad `full`, que en
los portales sigue mostrando el bloque azul sólido. Por eso un barrido por código que buscaba
`app-section-hero` + hijo-directo-del-grid da verde en las 16 páginas: **estructuralmente están
bien; lo que difiere es la densidad.**

→ El fix es **migrar los 16 componentes de portal a `density="slim"`**, no tocar CSS. Merece su
propio track (toca 16 archivos de producción y cambia la identidad visual de 2 portales completos).

### Hallazgo 2 — Regla 3-2-1 VIOLADA en `admin/instructores`. Es estructural, no cosmético.

Presupuesto: **3 por viewport (2 interactivos + 1 decorativo)**. Medición real (dedup de cadenas
`app-icon > lucide-icon > svg`, solo elementos visibles en viewport, área `<main>`):

| Ruta | Total | Interactivos | Decorativos | Estado |
|---|---|---|---|---|
| `admin/instructores` | **5** | 3 (`btn-primary`, `btn-secondary`, `filter-pill--active`) | **2** (`classes-badge` ×2) | ❌ excede |
| `admin/alumnos` | 3 | 3 (`Papelera`, `Nueva Matrícula`, `Exportar`) | 0 | ⚠️ 3 int vs 2 permitidos |
| `admin/agenda` | 0 | 0 | 0 | ✅ (ver punto ciego abajo) |

**Lo importante no es el 5, es que `classes-badge` es decorativo y va por fila de tabla.** Con 2
instructores de seed ya hay 2; con 15 instructores reales serían 15 elementos de marca
decorativos en un viewport. La regla 3-2-1 es **estructuralmente insatisfacible** en cualquier
página con un badge de marca por fila. Ese es el fix de fondo, no bajar el contador a 3.

### Hallazgo 3 — `admin/agenda` no tiene `app-section-hero`

`hero: 'ausente'`. La página renderiza completa y con datos (captura `fix-071-agenda-dark.png`),
pero arranca directo en la grilla semanal, sin el hero canónico que sí tienen Instructores y
Alumnos. Inconsistencia de homogeneidad no registrada antes en `UI-HOMOGENEITY-AUDIT.md`.

### ⚠️ Punto ciego del instrumento (declarado, no disimulado)

El detector matchea el **rgb exacto** de `--ds-brand` (`#38bdf8`) y `--color-primary-hover`. En la
captura de Agenda se ven celestes el header "Vie 31 Jul" y el punto "En progreso" que el detector
**no** contó — el proyecto deriva colores con `color-mix()` (ver ASG-b-034), que resuelve a un rgb
distinto. **Todos los conteos de arriba son cota inferior, no cifras exactas.** Un conteo completo
exige resolver también las variantes `color-mix`.

### Ruido descartado (no son bugs de la app)

- **Pantalla en blanco al recargar `admin/instructores`:** era re-optimización de deps de Vite
  (hash `v=a712bc0f` → `v=abd9dc4c`, con `xlsx`/`primeng_datepicker`/`primeng_toggleswitch`
  colgados). Al segundo `navigate` renderizó normal. **No confundir con H-007.**
- **`TimeoutError: Transition was aborted because of timeout in DOM update`:** 1 error de consola,
  del View Transitions del router de Angular en dev. Aparece tras el reload fallido de Vite.
  Vale re-verificar en `ng build` antes de darle entidad de bug.

## Lo que quedó pendiente (para retomar con navegador real)

1. **Skeletons en red lenta** (Dashboard, Agenda, Libro de Clases) — el bug de fondo ya está
   confirmado y tiene su propio track: **ASG-b-022 / no duplicar el diagnóstico** (nota
   explícita de la propia Asignación). Esta parte del alcance de ASG-b-001 queda delegada ahí.
2. **Capturas reales claro/oscuro/mobile** — 🟡 parcial. Hechas en **oscuro**: `admin/instructores`,
   `admin/agenda`. Faltan: modo **claro** y **mobile 375px** de ambas, y las 4 páginas restantes
   (Pagos, Matrícula, Asistencia B, Base Alumnos Prof.).
3. **Conteo real de `var(--ds-brand)` por viewport (regla 3-2-1)** — 🟡 parcial. Medido en render
   sobre 3 rutas (ver Hallazgo 2). Falta: (a) las 4 rutas restantes, (b) **cerrar el punto ciego
   de `color-mix()`** — sin eso los conteos son cota inferior. Ya hay un hallazgo estructural
   accionable (`classes-badge` por fila) que no depende de completar el barrido.
4. **Confirmación visual del reclamo del cliente** ("hero azul antiguo") — ✅ **CERRADO como
   REPRODUCIDO** (ver Hallazgo 1). Está en los portales Instructor y Alumno, no en el admin.
   Causa raíz identificada, alcance exacto medido (16 componentes). **El fix NO se hizo acá:**
   migrar 16 archivos de producción a `density="slim"` excede este track de QA y cambia la
   identidad visual de 2 portales completos → **abrir track propio**.
5. 🆕 **`admin/agenda` sin `app-section-hero`** (Hallazgo 3) — decidir si es intencional o drift.
6. 🆕 **`bento-banner` vs `bento-hero` en heroes slim** — definir cuál es la clase canónica y
   alinear `visual-system.md` con la realidad del código.

## Test de Regresión
<!-- No aplica — este track no tocó código de producción. -->
- N/A — cambio de solo documentación (`indices/UI-HOMOGENEITY-AUDIT.md`), sin lógica que testear.
