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

## ⚠️ Bloqueo de entorno (2026-07-31)

Esta sesión corre en el entorno remoto de Claude Code (Cowork/web), **no** en el Claude Code CLI
local del owner. Dos cosas que la Asignación da por sentadas no están disponibles acá:

1. **Sin `mcp__playwright__*`** — la nota de la propia Asignación dice "Reservada para Benjamín
   porque requiere el entorno de navegador local"; ese entorno es justamente el que falta acá.
   `ToolSearch` confirma que no hay ningún tool `mcp__playwright__*` cargable en esta sesión.
2. **Sin credenciales de sesión** — `environment.ts` apunta a un Supabase de desarrollo real
   (`skvekggejikzxhzsjmkz.supabase.co`), pero no hay `.env`, ni `service_role` key, ni
   `.claude/author.local.json` con contraseñas para los usuarios de prueba documentados en
   `indices/FLOWS-QA-AUDIT.md` (`admin@test.com`, `secretaria@test.com`, `secretaria2@test.com`,
   `instructor@test.com`, `alumno@test.com`). No hay forma de loguearse a las páginas
   autenticadas que pide el alcance (Dashboard, Agenda, Pagos, Matrícula, Asistencia B, Base
   Alumnos Prof., Instructores).

Sin browser real + sesión autenticada, **no puedo producir capturas reales, throttling de red,
ni confirmar visualmente el reclamo del cliente** ("hero azul antiguo en Instructores y
Alumnos"). Lo de abajo es lo que sí alcancé a verificar sin esas dos piezas — no reemplaza el
QA visual real, es la mejor evidencia disponible en este entorno.

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

## Lo que quedó pendiente (para retomar con navegador real)

1. **Skeletons en red lenta** (Dashboard, Agenda, Libro de Clases) — el bug de fondo ya está
   confirmado y tiene su propio track: **ASG-b-022 / no duplicar el diagnóstico** (nota
   explícita de la propia Asignación). Esta parte del alcance de ASG-b-001 queda delegada ahí.
2. **Capturas reales claro/oscuro/mobile** de Agenda, Pagos, Matrícula, Asistencia B, Base
   Alumnos Prof., Instructores — no producidas, requiere navegador + login.
3. **Conteo real de `var(--ds-brand)` por viewport (regla 3-2-1)** — evalué hacerlo por `grep`
   estático y lo descarté a propósito: un grep sobre el template cuenta *todas* las ocurrencias
   posibles (incl. estados condicionales tipo `filter-pill--active`) sin saber cuáles están
   realmente visibles a la vez en pantalla — es exactamente el tipo de falso-positivo que esta
   Asignación existe para evitar (ir más allá de "está referenciado en código"). No hay
   evidencia confiable sin render real.
4. **Confirmación visual del reclamo del cliente** ("hero azul antiguo") — no reproducido. La
   evidencia de código (punto de "Cambio" arriba) sugiere que ya no existe a nivel de
   estructura/clases, pero el reclamo podría ser sobre color/gradiente/dark-mode real, que solo
   se ve renderizado — o sobre una build anterior a los fixes que ya se hicieron. Sigue siendo
   un hallazgo abierto hasta que alguien con navegador lo confirme o descarte en vivo.

## Test de Regresión
<!-- No aplica — este track no tocó código de producción. -->
- N/A — cambio de solo documentación (`indices/UI-HOMOGENEITY-AUDIT.md`), sin lógica que testear.
