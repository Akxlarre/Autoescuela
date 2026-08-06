---
# Fix: Panel "clases actuales" no muestra sesiones in_progress colgadas de días anteriores
> id: fix-131-m-live-classes-panel-sesiones-dia-anterior
> refs: 0001-i-ciclo-vida-clase-exclusion-cierre
> status: done
> closed: 2026-08-06
> created: 2026-08-06

## Root Cause

`dashboard.facade.ts::fetchLiveClasses()` (líneas 351-352) filtra `class_b_sessions` por
`scheduled_at` acotado exclusivamente al día de hoy (`.gte(...T00:00:00).lte(...T23:59:59)`).
Cuando una sesión queda en `status='in_progress'` sin que el instructor llame `finishClass()`
(nunca se cierra sola — confirmado y decidido así en la spec 0001-i), esa fila deja de
aparecer en el panel `app-live-classes-panel` a partir del día siguiente, aunque el trigger
`trg_prevent_concurrent_in_progress` (`supabase/migrations/20260804120000_...`) la sigue
usando para bloquear cualquier `startClass()` nuevo de ese instructor — sin fecha límite.
Resultado: la sesión colgada se vuelve invisible en el dashboard justo cuando más falta hace
verla, y el instructor/secretaría no tiene forma de saber por qué un `startClass()` de hoy es
rechazado.

La spec 0001-i cubrió el aviso "atrasada" (15 min post fin agendado) solo dentro del set ya
filtrado por hoy — nunca contempló el caso cross-día porque el alcance original asumía que el
aviso bastaba con ser visible el mismo día.

## ACs Afectados

- AC3 (0001-i): "el dashboard... muestra esa sesión con un color/estado distinto" — el AC no
  especifica límite de un día, pero la implementación sí lo impuso implícitamente vía el filtro
  de fecha del facade. Este fix extiende la cobertura de AC3 a sesiones `in_progress` de días
  anteriores, sin modificar el AC ni su spec original.

## Cambio

- **Archivo:** `src/app/core/facades/dashboard.facade.ts`
  - `fetchLiveClasses()`: se agregó una segunda query (`stuckSessionsQuery`) que trae sesiones
    `status='in_progress'` con `scheduled_at < hoy` (sin límite inferior). Se extrajo el mapeo
    DTO→UI a `mapPracticaRow()` (antes inline) para reutilizarlo en ambas queries sin duplicar
    lógica. Ambas queries corren en paralelo (`Promise.all`) y sus resultados se concatenan
    antes de ordenar cronológicamente.
  - Decisión de diseño respecto al Cambio propuesto originalmente: **no se agregó un campo
    `isFromPreviousDay` al UI model.** Es derivable 100% a partir de `scheduledAt` (ya presente
    en `LiveClassModel`) con una función pura — agregarlo como campo persistido en el modelo
    habría sido estado redundante. En su lugar se creó `isFromPreviousDay(scheduledAt, now)` en
    `class-b-session-overdue.utils.ts`, consumida por el componente (Núcleo Funcional,
    `architecture.md`).
- **Archivo:** `src/app/core/utils/class-b-session-overdue.utils.ts`
  - Nueva función pura `isFromPreviousDay(scheduledAt, now)`: compara el día calendario local de
    `scheduledAt` contra `now`.
- **Archivo:** `src/app/shared/components/live-classes-panel/live-classes-panel.component.ts`
  - Nuevo método `isFromPrevDay(cls)` (usa la util de arriba con el tick `_now` existente).
  - Marca visual: fecha corta (`formatShortDate`) sobre la hora cuando es de un día anterior,
    borde izquierdo distintivo en el `<li>`, ícono `history` + label "Día Anterior" (distinto de
    "Atrasada") en el badge de estado, y `data-llm-description` propio.

## Test de Regresión

- `class-b-session-overdue.utils.spec.ts`: 6 casos nuevos para `isFromPreviousDay()` (día
  anterior, varios días atrás, mismo día temprano, futuro, vacío, inválido) — verde.
- `dashboard.facade.spec.ts`: nuevo caso `incluye sesiones in_progress colgadas de días
  anteriores junto con las de hoy (fix-131-m)` — verde. Se ajustó el helper `makeSupabaseMock()`
  del archivo para devolver un builder nuevo por cada `.from()` (antes compartía uno solo, lo
  que habría duplicado filas entre la query de hoy y la de colgadas).
- `live-classes-panel.component.spec.ts`: 5 casos nuevos (`isFromPrevDay` true/false,
  `statusLabel` con `fromPrevDay`, `formatShortDate`, y el caso explícito del dueño: sesión de
  ayer a las 18:30 vs. clase de hoy a las 18:30 no son indistinguibles) — verde.
- Suite completa (`npm run test:ci`): 1780 passed / 9 failed / 5 skipped (1794 total). Los 9
  fallos son preexistentes y no relacionados (`flota.facade.spec.ts`, `NG0201: No provider
  found for MessageService` — falta un provider de `MessageService` en el TestBed de ese
  archivo, no tocado por este fix). Cero regresión en `live-classes-panel.component.spec.ts`
  (19/19 verde, incluye los casos de fix-073/fix-074) ni en `dashboard.facade.spec.ts` (18/18
  verde).
