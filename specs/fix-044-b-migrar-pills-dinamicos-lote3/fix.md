# Fix: Migrar pills dinámicos a app-badge — lote 3 (varios archivos)
> id: fix-044-b-migrar-pills-dinamicos-lote3
> refs: fix-036-app-badge-fuente-unica, fix-038-app-badge-variant-brand, fix-042-migrar-pills-estaticos-lote1, fix-043-migrar-pills-dinamicos-lote2
> status: done
> created: 2026-07-09
> closed: 2026-07-09

## Root Cause
Séptimo lote de la migración de pills ad-hoc del baseline ARCH-15 (fase 4,
`docs/BACKLOG-DEUDA-TECNICA.md`). Tras fix-043 quedan 51 pills en 43 archivos. De esos, ya
están revisados y excluidos con justificación documentada (no requieren nueva revisión):
`admin-pre-inscrito-drawer` (3), `admin-contabilidad-cursos` (1, pill "tipo" con
`--color-purple` inexistente), `admin-profesional-evaluaciones` (2, `getPromedioClasses`
sólido), `secretaria-profesional-notas` (2, ídem), `alumnos-list-content` (2, sesión
paralela activa — no tocar), `public-context-banner` (2, botones), `tabs.component` (2,
contadores sin semántica de estado), `admin-curso-singular-detalle-drawer` (1, ídem tipo
purple), `servicios-especiales-content` (1, pill uppercase/2xs), `section-hero` (1, chip
hero-full), `asistencia-clase-b-content` (1, botón filtro), `assignment.component.html`
(1, RECOMENDADO sólido), `admin-profesional-asistencia` (1, botón "Volver a Hoy"),
`signature-pad` (1, botón "Limpiar"), `topbar` (1, contador de notificaciones decorativo).

Este fix ataca el resto: ~27 archivos genuinamente no revisados aún, 1 pill cada uno.

## ACs Afectados
Ninguno — fix autónomo (fase 4 del roadmap, lote de migración de pills dinámicos).

- AC-1: Los pills dinámicos abordados en este lote migran a `<app-badge [variant]="...">`
  preservando la lógica de mapeo color→condición.
- AC-2: Los helpers `getXBg()`/`getXColor()` reemplazados se eliminan; los helpers de solo
  label se mantienen.
- AC-3: `npm run lint:arch` sin regresión; baseline ARCH-15 baja en la cantidad de pills
  efectivamente migrados.
- AC-4: `ng build` verde.
- AC-5: Verificación proporcional al riesgo: lectura de código del mapeo condición→variant
  por archivo; excluir (no forzar) cualquier pill con lenguaje visual distinto a `badge-*`
  (sólido vs diluido) o que resulte ser un falso positivo del heurístico ARCH-15 (botones,
  contadores decorativos).

## Cambio
15 archivos migrados (16 pills — algunos archivos tenían más de un match del heurístico
para el mismo pill visual, ej. `admin-ex-alumnos-comments` era `<div>` no `<span>`), 12
archivos revisados y excluidos con justificación (0 pills migrados en esos).

**Migrados:**
- `admin-ex-alumnos-comments.component.ts` — rating estático (siempre `warning`)
- `admin-contabilidad-anticipos.component.ts` — pill "tipo" estático → `neutral`
- `vehicle-documents-drawer.component.ts` — ya usaba `[class.badge-success]`/
  `[class.badge-error]` (la colisión accidental que motivó el hallazgo de fix-036);
  consolidado a `<app-badge>` limpio, elimina clases locales redundantes
  (uppercase/tracking-widest/shadow-sm que competían con el estilo propio del badge)
- `admin-instructor-ver-drawer.component.ts` / `admin-relator-ver-drawer.component.ts` /
  `admin-secretarias-ver-drawer.component.ts` — patrón repetido: rama `@if` "Activo" ya
  usaba `<app-badge variant="success">`, rama `@else` "Inactivo/Inactiva" quedó a medio
  migrar con `<span>` suelto; completado a `<app-badge variant="neutral">`
- `admin-pago-detalle-drawer.component.ts` — `paymentStatusVariant` (paid/partial/default)
- `admin-profesional-promociones.component.ts` — 4 estados vía `[class]="'status-badge--' +
  status"` + bloque SCSS local de 4 reglas; migrado a `statusVariant()` y el bloque SCSS
  local eliminado (duplicaba `badge-*` con tokens ligeramente distintos)
- `alumno-dashboard.component.ts` — semáforo de asistencia (`semaphoreVariant`)
- `alumno-pagos.component.ts` — **corrige bug latente**: usaba `var(--color-success-muted)`/
  `var(--color-warning-muted)`, tokens que no existen en el design system (0 matches en
  `_variables.scss`) — el pill actualmente renderizaba sin fondo/color visible. Migrado a
  `success`/`warning`, resuelto como efecto colateral de la migración
- `alumno-pruebas-online.component.ts` — 3 entradas estáticas de datos (`tag`/`tagBg`/
  `tagColor` → `tag`/`tagVariant`), interfaz `SimulatorLink` actualizada
- `certificacion-profesional-content.component.ts` — **corrige bug latente**: `getAccionBg`
  usaba `var(--bg-brand-muted)` sin fallback (token inexistente, declaración inválida →
  `email_sent` renderizaba sin fondo). Migrado a `getAccionVariant` (generated→success,
  email_sent→brand, downloaded→info, default→neutral) — mismo patrón que
  `certificacion-clase-b-content` de fix-040
- `ciclos-teoricos-content.component.ts` — pill "Enviado" estático → `success`
- `dms-list-content.component.ts` — pill categoría estático → `neutral`
- `reportes-contables-content.component.ts` — pill categoría de gasto estático → `error`

**Revisados y excluidos (0 pills migrados, justificación documentada):**
- `admin-pre-inscritos.component.ts`, `secretaria-alumnos-pre-inscritos.component.ts` —
  pill "licencia" sólido (`bg-brand text-white`), mismo patrón ya excluido en
  `admin-pre-inscrito-drawer` (fix-043)
- `admin-curso-singular-cobro-drawer.component.ts` — mismo bug `--color-purple` del pill
  "tipo" ya documentado en fix-043 (tercera ocurrencia del mismo patrón SENCE/Particular)
- `admin-alumno-docs-detalle.component.ts`, `alumnos-profesional-list-content.component.ts`,
  `ex-alumnos-profesional-content.component.ts` — `bg-brand-muted`/`bg-brand-tint` con
  texto/borde neutro (no `text-brand`), combinación distinta a `badge-brand` (que colorea
  también texto y borde) — forzarlo cambiaría el color del texto
- `admin-sesion-drawer.component.ts` — pill con `[style.color]="'white'"` fijo (estilo
  sólido, no diluido)
- `secretaria-asistencia-profesional.component.ts` — botón "Volver a Hoy" (`(click)`),
  mismo falso positivo ya documentado para `admin-profesional-asistencia` en fix-043
- `secretaria-matricula.component.html`, `daily-schedule-timeline.component.ts`,
  `public-license-type.component.ts`, `public-payment-mode.component.ts` — overlays
  blanco-semitransparente sobre superficie de marca (mismo patrón que el chip "hero-full"
  de `section-hero`) o gradiente sólido tipo "RECOMENDADO", no semánticos por diseño
- `public-wizard-shell.component.ts` — botón de ayuda WhatsApp (`(click)`), falso positivo

## Test de Regresión
- `npm run lint:arch` → 0 errores, backlog ARCH-15/16/17 bajó 237→222, baseline consolidado ✓
- `ng build` → exit 0 tras corregir 2 imports duplicados de `BadgeComponent` detectados por
  el primer build (`dms-list-content` y `reportes-contables-content` ya lo tenían importado
  desde ediciones previas de otra sesión) ✓
- Verificación por archivo (lectura de mapeo condición→variant) en los 15 archivos
  migrados; sin variants nuevos introducidos (todos ya probados en fix-036/038/043) ✓
