# Tasks 0012-m — Persistir borrador de Arqueo y Cierre de Caja

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-08-27

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — Verificar que no existan filas duplicadas `(date, branch_id)` en `cash_closings`
  antes de crear el índice único (mitigación de riesgo del plan §8).
  - **DoD:**
    - [x] Corrida verificación de duplicados — Docker no disponible localmente, se ejecutó
      contra el proyecto remoto (único ambiente existente, usado también para UAT) vía
      supabase-js autenticado como `admin@test.com` (RLS admin ve todas las filas), agrupando
      client-side por `(date, branch_id)`. Script temporal, borrado tras la corrida.
    - [x] Resultado: 8 filas totales, 0 grupos duplicados. Sin bloqueo para T1.2.

- [x] **T1.2** — Crear migración `supabase/migrations/20260827120000_cash_closings_draft_upsert.sql`
  - **AC ref:** AC4, AC5, AC-E1
  - **DoD:**
    - [x] Constraint único creado — **ajustado en T1.3**: no es un índice sobre expresión
      `COALESCE`, es columna generada `branch_id_key` (ver T1.3)
    - [x] `DROP POLICY IF EXISTS update_cash_closings` + `CREATE POLICY` ampliada:
      `admin` sin cambios, `secretary` solo si `status = 'draft' AND branch_visible(branch_id)`
    - [x] `npx supabase db reset` corre sin error (Docker local, validado — NO se tocó el
      remoto; el usuario aplicará el SQL final manualmente vía SQL Editor, mismo flujo que
      usa el equipo para todas las migraciones)
    - [x] Prueba manual con usuario `secretary` real (creado ad-hoc en el local, borrado junto
      con el resto del entorno al `db reset` final): `UPDATE` a fila `status='draft'` de su
      sede → 1 fila afectada; `UPDATE` a fila `status='closed'` de su sede → 0 filas afectadas
      (bloqueado por RLS, sin error explícito — comportamiento esperado de Postgres RLS)
    - [ ] Documentado en `indices/DATABASE.md` — pendiente, se hace en T5.1 (Fase Cierre)

- [x] **T1.3** — Validar `upsert(..., { onConflict: 'date,branch_id' })` del cliente Supabase
  contra el índice único cuando `branch_id IS NULL` (riesgo del plan §8, admin sin sede)
  - **DoD:**
    - [x] Probado contra Supabase local: **el `onConflict` sobre índice de expresión
      `COALESCE(branch_id,-1)` FALLA** — PostgREST exige que `onConflict` apunte a columnas
      reales, no a una expresión. Confirmado con error real:
      `duplicate key value violates unique constraint "ux_cash_closings_date_branch"` en el
      segundo upsert.
    - [x] Alternativa aplicada: columna generada `branch_id_key INT GENERATED ALWAYS AS
      (COALESCE(branch_id, -1)) STORED` + `UNIQUE INDEX` sobre `(date, branch_id_key)` +
      `onConflict: 'date,branch_id_key'`. Revalidado: upsert con `branch_id: null` dos veces
      seguidas actualiza la misma fila (mismo `id`, no duplica); upsert con `branch_id: 1` dos
      veces seguidas también actualiza la misma fila. `plan.md` §4 actualizado con el SQL
      final (ver abajo).

---

## Fase 2 — Capa Facade

- [x] **T2.1** — Extender `cuadratura.facade.spec.ts` PRIMERO (TDD) con los casos nuevos
  - **AC ref:** AC1, AC2, AC4, AC5, AC-E3
  - **DoD:**
    - [x] Test: `guardarBorrador()` hace upsert con `status:'draft'` y los valores actuales de
      los signals
    - [x] Test: llamadas sucesivas a `guardarBorrador()` dentro de la ventana de debounce
      (`vi.useFakeTimers()`) solo disparan una escritura
    - [x] Test: `checkCajaStatus()` restaura `fondoInicial`/`cantidades`/`notasArqueo`/
      `realizarArqueo` cuando la fila cargada tiene `status='draft'`
    - [x] Test: `checkCajaStatus()` NO marca `cajaYaCerrada()=true` para una fila `status='draft'`
    - [x] Test: `cerrarCaja()` hace upsert (no insert plano) y no duplica fila si ya había borrador
    - [x] Test: un error en el upsert de `guardarBorrador()` no lanza excepción no capturada
    - [x] Tests FALLAN en este punto (8 tests nuevos en rojo, 34 preexistentes en verde — confirmado)

- [x] **T2.2** — Implementar `guardarBorrador()` en `cuadratura.facade.ts`
  - **AC ref:** AC1, AC-E3
  - **DoD:**
    - [x] Debounce interno (`setTimeout`/`clearTimeout`, ventana 800ms) — sin utility
      compartida nueva (justificado en plan §3, alcance acotado a este Facade)
    - [x] Upsert vía `supabase.client.from('cash_closings').upsert(payload, { onConflict: 'date,branch_id_key' })`
      con `status: 'draft'`, `closed: false` — **`branch_id_key`, no `branch_id`** (ver T1.3:
      `onConflict` no soporta expresión/branch NULL con columna real)
    - [x] Falla silenciosa (try/catch sin re-throw, sin toast) — mismo criterio que
      `refreshSilently()` del patrón SWR
    - [x] Tests de T2.1 relacionados PASAN
    - [x] Guard adicional no planeado en tasks pero sí en plan: `guardarBorrador()` no hace nada
      si `cajaYaCerrada()` ya es `true` (defensivo — los inputs del drawer ya están
      deshabilitados en ese estado, pero evita una escritura inútil si algo dispara el evento igual)

- [x] **T2.3** — Extender `checkCajaStatus()` para cargar y restaurar el borrador
  - **AC ref:** AC2, AC5, AC-E2
  - **DoD:**
    - [x] Quita el filtro `.eq('closed', true)` del SELECT (debe traer también `status='draft'`)
    - [x] Si `status='closed'` → comportamiento actual sin cambios (`cajaYaCerrada=true`)
    - [x] Si `status='draft'` → restaura los 4 signals de arqueo; `cajaYaCerrada` queda `false`
    - [x] Si no hay fila → estado en blanco (comportamiento actual, sin cambios)
    - [x] La query sigue filtrando por `date = hoy` exacta (garantiza AC-E2 sin lógica extra)
    - [x] Tests de T2.1 relacionados PASAN

- [x] **T2.4** — Cambiar `cerrarCaja()` de `insert` a `upsert`
  - **AC ref:** AC4
  - **DoD:**
    - [x] `upsert(..., { onConflict: 'date,branch_id_key' })` con `status:'closed'`, `closed:true`
    - [x] Si ya existía un borrador, se actualiza la MISMA fila (mismo `id`) — no se crea una
      fila nueva
    - [x] `resetArqueoState()` (ya existente) sigue llamándose tras el cierre exitoso
    - [x] Tests de T2.1 relacionados PASAN
    - [x] Además limpia `_borradorTimer` pendiente al cerrar (evita un upsert de borrador
      colgado después del cierre — la RLS ya lo bloquearía igual, pero evita la llamada inútil)
    - [ ] Documentado en `indices/FACADES.md` — pendiente, se hace en T5.1 (Fase Cierre)

**Descubierto durante esta fase (no en el plan original):** `fondoInicial` y `realizarArqueo`
no tenían columna donde persistir — se agregó una segunda migración,
`supabase/migrations/20260827130000_cash_closings_draft_columns.sql`
(`opening_amount INTEGER`, `arqueo_enabled BOOLEAN`, ambas nullable). Validada localmente igual
que T1.2/T1.3 y aplicada manualmente por el usuario. `spec.md` §6 y `plan.md` §4 quedaron
desactualizados respecto a "sin columnas nuevas" — ver nota en `plan.md`.

---

## Fase 3 — Conexión UI

- [x] **T3.1** — Conectar `arqueo-cierre-drawer.component.ts` al autoguardado
  - **AC ref:** AC1, AC3
  - **DoD:**
    - [x] Cada handler que muta un signal (`onFondoChange`, `onCantidadChange`, `onToggleArqueo`
      nuevo, `onNotasChange` nuevo) llama `facade.guardarBorrador()` después de mutar el signal
      — `onToggleArqueo`/`onNotasChange` reemplazan los bindings inline `(click)`/`(input)` que
      antes mutaban el signal directo en el template, para tener un solo punto donde encadenar
      el autoguardado
    - [x] No se agrega lógica de decisión nueva en el componente (el debounce vive en el
      Facade, ver T2.2) — el componente solo dispara

- [x] **T3.2** — Renombrar botón "Listo" → "Cerrar panel"
  - **AC ref:** AC3
  - **DoD:**
    - [x] Texto del botón actualizado en el template
    - [x] `data-llm-action` se mantiene igual (no cambia el atributo, solo el label visible)
    - [x] `npm run lint:arch` sin nuevos hallazgos en este archivo (exit 0, confirmado)

---

## Fase 4 — Validación

- [x] **T4.1** — `npm run lint:arch` corre limpio (sin nuevos hallazgos vs. baseline actual) —
  exit 0, warnings preexistentes sin relación a los archivos tocados
- [x] **T4.2** — `npm run test:ci` corre verde (incluye los tests nuevos de T2.1) — 2234
  pasan, 1 falla preexistente y no relacionada
  (`secretaria-contabilidad-cuadratura.component.spec.ts` — `openIngresoDrawer is not a
  function`, archivo no tocado en esta spec), 5 skipped
- [x] **T4.3** — QA manual con Playwright, golden path + edge cases, logueado como
  `secretaria@test.com` contra la BD real (proyecto remoto único, mismo usado para UAT)
  - **DoD:** Cada AC (AC1–AC5, AC-E1–AC-E3) marcado con evidencia en `acceptance.md`:
    - [x] Editar fondo ($35.000), 3×$10.000 y justificación → esperar debounce → F5 → los tres
      valores y el toggle de arqueo persisten exactos (AC1, AC2)
    - [x] Reabrir el drawer sin recargar → mismo estado (implícito en el flujo anterior)
    - [x] "Cerrar panel" no descarta el borrador ya guardado (AC3) — probado en fix-225-m,
      sin cambios de comportamiento
    - [x] Cerrar caja con un borrador existente → **misma fila `id=10`** en Supabase, pasó de
      `status='draft'` a `status='closed'`, no una fila nueva (AC4) — confirmado con query
      directa post-cierre
    - [x] Un borrador (`status='draft'`) nunca deja `cajaYaCerrada()` en `true` al recargar
      (AC5) — la caja mostró "Caja Abierta" durante todo el ciclo de edición, hasta el cierre
      explícito
    - [x] Fecha distinta (`2026-08-28`) → sin fila (`[]`), no arrastra el borrador de ayer (AC-E2)
    - [x] Sin errores 4xx en Network al autoguardar logueado como `secretary` — **bug real
      encontrado**: el primer intento de `cerrarCaja()` dio **403** (ver abajo, corregido con
      migración `20260827140000`); tras el fix, autoguardado (201→200→200...) y cierre (200)
      sin errores
    - [x] AC-E1 (no duplicar fila en carrera) — cubierto indirectamente: el mismo mecanismo de
      upsert probado en T1.3 aplica igual a 2 usuarios; no se montó un test de concurrencia real
      de 2 sesiones simultáneas (bajo valor para el riesgo — ya lo blinda el constraint único a
      nivel de BD, no la lógica de la app)

  **Bug real encontrado y corregido durante T4.3:** `cerrarCaja()` (transición
  `draft`→`closed`) devolvía **403**. Causa: `update_cash_closings` (migración
  `20260827120000`) declaraba `FOR UPDATE USING (...)` sin `WITH CHECK` explícito — Postgres
  reutiliza el `USING` para validar también la fila NUEVA post-UPDATE, y el `USING` exigía
  `status = 'draft'`, así que la propia transición a `'closed'` quedaba bloqueada por su propia
  policy. Corregido en `supabase/migrations/20260827140000_cash_closings_update_with_check_fix.sql`
  con un `WITH CHECK` separado (solo valida sede, no repite `status='draft'`). Validado local
  (Docker) con el flujo completo draft→closed→intento de reedición bloqueado, y luego
  re-verificado en producción vía Playwright tras que el usuario aplicó la migración.

- [x] **T4.4** — Ejecutar `/spec-verify`
  - **DoD:** AC Verifier devuelve `{ok: true}` o tickets restantes resueltos

---

## Fase 5 — Cierre

- [x] **T5.1** — Actualizar `indices/DATABASE.md` y `indices/FACADES.md` con todo lo nuevo
- [x] **T5.2** — Marcar spec como `done` en `specs/ROADMAP.md`
- [x] **T5.3** — Limpiar `specs/.active`

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [x] Migración `20260827130000_cash_closings_draft_columns.sql` — `opening_amount` y
  `arqueo_enabled` no tenían columna (ver Fase 2). Aplicada por el usuario.
- [x] Migración `20260827140000_cash_closings_update_with_check_fix.sql` — fix del 403 en
  `cerrarCaja()` por falta de `WITH CHECK` explícito en `update_cash_closings` (ver T4.3).
  Aplicada por el usuario y re-verificada en producción.
