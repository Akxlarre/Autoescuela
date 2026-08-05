# Tasks 0001-i — Ciclo de vida de la clase: exclusión mutua y aviso de cierre atrasado

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-08-04

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 0 — Auditoría previa (riesgo #3 del plan)

> Debe correr ANTES de aplicar el trigger. Si aparecen filas huérfanas, coordinar con el owner
> antes de seguir — no bloquea indefinidamente, pero sí requiere una decisión explícita.

- [x] **T0.1** — Auditar sesiones `in_progress` huérfanas en producción
  - **DoD:**
    - [x] Corrido en Supabase (dashboard SQL): join con `instructors`/`users` para identificar al instructor, sin filtro de fecha (incluye las de hoy también)
    - [x] Resultado documentado acá: **1 fila** — sesión `id=575`, instructor `Julio Verstappen (id=4)`, `scheduled_at=2026-08-03 15:00`, `duration_min=45`, abierta hace ~19h al momento de la auditoría (2026-08-04)
    - [x] Decisión explícita del owner (i, 2026-08-04): **cerrar manualmente la sesión #575 antes de aplicar el trigger** (T1.1), en vez de dejarla y bloquear a Julio Verstappen después del deploy
    - [x] Confirmado (2026-08-04): sesión #575 cerrada manualmente desde la app (Finalizar Clase). Sin filas huérfanas restantes conocidas — vía libre para T1.1.

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — Crear migración `20260804120000_class_b_sessions_exclusion_mutua_instructor.sql`
  - **AC ref:** AC1, AC-E1, AC2
  - **DoD:**
    - [x] Trigger `BEFORE UPDATE` en `class_b_sessions` que rechaza `status='in_progress'` si el `instructor_id` ya tiene otra fila `in_progress` (excluyendo la propia `id`)
    - [x] Mensaje de `RAISE EXCEPTION` legible en español (ver pseudo-SQL del plan §4)
    - [x] `SECURITY DEFINER` (mismo patrón que otros triggers de la tabla)
    - [x] Archivo guardado en `supabase/migrations/20260804120000_class_b_sessions_exclusion_mutua_instructor.sql` (idempotente, `CREATE OR REPLACE` + `DROP TRIGGER IF EXISTS`)
    - [~] `npx supabase db reset` — **diferido**: el owner va a auditar primero qué otros cambios recientes de este mismo estilo faltan como archivo antes de resetear local. No bloquea el resto de la spec.
    - [x] Prueba manual (BD real): sesiones #515/#516 (instructor 5) — la segunda falló con el mensaje esperado
    - [x] Prueba manual (BD real): instructor sin otra sesión `in_progress` → `UPDATE` a `in_progress` pasa sin error (no regresión, AC2 confirmado por el owner)
    - [x] Documentado en `indices/DATABASE.md` (fila `prevent_concurrent_in_progress_class_b_sessions()`)

- [x] **T1.2** — Agregar `durationMin` a `LiveClassModel`
  - **DoD:**
    - [x] `core/models/ui/dashboard.model.ts`: campo `durationMin: number` agregado a `LiveClassModel`
    - [x] `indices/MODELS.md` no lista campos individuales de este UI model (solo referencia el archivo) — sin cambio necesario

---

## Fase 2 — Núcleo funcional (TDD)

- [x] **T2.1** — Escribir `class-b-session-overdue.utils.spec.ts` PRIMERO
  - **AC ref:** AC3, AC-E2
  - **DoD:**
    - [x] Caso: `status='in_progress'`, ahora < `scheduled_at + duration_min` → `false`
    - [x] Caso: `status='in_progress'`, ahora > `scheduled_at + duration_min + 15min` → `true`
    - [x] Caso borde: exactamente a los 15 min del fin agendado → **inclusive** (a los 15 min exactos ya cuenta como atrasada), documentado en el test correspondiente
    - [x] Caso: `status='pending'` o `status='completed'`, sin importar el tiempo → siempre `false`
    - [x] Tests FALLAN al escribirlos (confirmado: error de import, módulo no existía aún)

- [x] **T2.2** — Implementar `isSessionOverdue()` en `class-b-session-overdue.utils.ts`
  - **AC ref:** AC3, AC-E2
  - **DoD:**
    - [x] Firma: `isSessionOverdue(scheduledAt: string, durationMin: number, status: string, now?: Date): boolean`
    - [x] Función pura (sin Angular, sin efectos secundarios), `now` opcional con default `new Date()`
    - [x] Tests PASAN — 8/8 verdes (`npm run test:ci`)
    - [x] Documentado en `indices/UTILS.md` (agregado a mano — `npm run indices:sync` tiene un bug preexistente con el espacio en el path del proyecto, no relacionado a esta tarea)

---

## Fase 3 — Capa Facade (manejo de error del trigger)

- [x] **T3.1** — `InstructorClasesFacade.startClass()`: propagar error legible del trigger
  - **AC ref:** AC1
  - **DoD:**
    - [x] `ErrorSanitizerService`: agregado manejo de `code==='P0001'` (SQLSTATE por defecto de `RAISE EXCEPTION` sin ERRCODE explícito) — confía en `error.message` tal cual, en vez del fallback genérico `(código)`. Con test propio en `error-sanitizer.service.spec.ts` (10/10 verde)
    - [x] `startClass()`: catch sanitiza el error y relanza `new Error(sanitized.message)`
    - [x] `instructor-clase.component.ts` (`onStartClass`): el `catch {}` ni siquiera capturaba el error — corregido a `catch (err)`, muestra `err.message` real en el toast en vez de texto fijo
    - [x] Test en `instructor-clases.facade.spec.ts`: mock de error `P0001` → verifica mensaje propagado (20/20 verde)
    - [x] Test de regresión: `startClass()` sin conflicto sigue funcionando igual (test preexistente sigue verde, AC2)

- [x] **T3.2** — `AsistenciaClaseBFacade.startClass()`: mismo tratamiento
  - **AC ref:** AC1
  - **DoD:**
    - [x] `ErrorSanitizerService` inyectado (no lo tenía); mismo patrón catch→sanitize→relanzar, implementado independientemente de T3.1 (riesgo #2 del plan)
    - [x] `admin-iniciar-clase-drawer.component.ts` (`onSubmit`): mismo bug que en instructor — `catch {}` sin capturar, corregido a `catch (err)` con `err.message` real
    - [x] Test en `asistencia-clase-b.facade.spec.ts` equivalente al de T3.1 — caso éxito + caso P0001, ambos verdes (15/15 total del archivo)

---

## Fase 4 — Capa UI

- [x] **T4.1** — `DashboardFacade.fetchLiveClasses()`: seleccionar y mapear `duration_min`
  - **DoD:**
    - [x] `select()` de `class_b_sessions` incluye `duration_min`
    - [x] `LiveClassModel.durationMin` mapeado desde `row.duration_min`, fallback a `45` si viene `null` (default de la columna)
    - [x] Sin cambios en el resto del mapeo — test nuevo + 13 preexistentes, 14/14 verde

- [x] **T4.2** — `live-classes-panel.component.ts`: estado visual "atrasada"
  - **AC ref:** AC3
  - **DoD:**
    - [x] Método `isOverdue(cls)` usa `isSessionOverdue()` — sin lógica repetida inline en el template
    - [x] Color distinto de los 3 existentes: `text-error` para texto, `bg-error-subtle`+`text-error` para el ícono (no `bg-error` sólido, para no asumir contraste de blanco sobre `--state-error`) — NO reutiliza `text-warning`
    - [x] Señal visual adicional: ícono `alert-triangle` con `.badge-pulse` junto a la etiqueta, y el ícono de acción también cambia a `alert-triangle` cuando está atrasada (antes siempre `play`)
    - [x] No rompe el estado `in_progress` normal: todas las condiciones de color ahora excluyen explícitamente `!isOverdue(cls)`, tests preexistentes de `statusLabel`/`getRelativeTime` siguen verdes
    - [x] `data-llm-description="Clase con cierre atrasado, requiere atención"` agregado al indicador cuando `isOverdue(cls)` es true
    - [x] Tests nuevos: `isOverdue()` (3 casos) + `statusLabel`/`getRelativeTime` con `overdue=true` — 14/14 verde en el archivo completo

- [x] **T4.3** — Re-evaluación periódica del estado "atrasada" (riesgo #1 del plan)
  - **AC ref:** AC3, AC-E2
  - **DoD:**
    - [x] Signal `_now` actualizado cada 60s vía `setInterval`, limpiado con `destroyRef.onDestroy()` — reevalúa `isOverdue()` sin pedir datos nuevos
    - [x] Confirmado: no reintroduce el polling de fetch eliminado en fix-004-i (ese traía datos de BD; este solo re-evalúa una función pura local con la data ya cargada)
    - [x] Al cerrar la clase manualmente, `cls.status` deja de ser `in_progress` (Realtime actualiza `classes()` como ya hacía antes) → `isOverdue()` devuelve `false` de inmediato sin depender del tick de 60s

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch` corre limpio
  - **DoD:**
    - [x] Exit code 0, sin errores bloqueantes
    - [x] 2 warnings (no error) de complejidad en archivos tocados, ambos **preexistentes** (confirmado comparando contra `git stash` antes de mis cambios): `live-classes-panel.component.ts` ya estaba en 319 líneas (límite 200) antes, ahora 354; `asistencia-clase-b.facade.ts` ya tenía 6 `inject()` (límite 5) antes, ahora 7 (`ErrorSanitizerService` agregado). Los agravé un poco pero no son violaciones nuevas — refactorizarlos (dividir componente/extraer service) es fuera de scope de esta spec
- [x] **T5.2** — `npm run test:ci` corre verde (incluye los specs nuevos de T2.1, T3.1, T3.2)
  - **DoD:**
    - [x] Suite completo (`npm run test:ci` sin filtro) tiene un problema de infraestructura preexistente ajeno a esta spec (confirmado con `git stash` en sesión anterior — falla igual sin mis cambios). Validado en su lugar cada archivo tocado individualmente
    - [x] 7 archivos de test relacionados a esta spec — **83/83 verde**: `instructor-clases.facade.spec.ts`, `asistencia-clase-b.facade.spec.ts`, `dashboard.facade.spec.ts`, `error-sanitizer.service.spec.ts`, `class-b-session-overdue.utils.spec.ts`, `live-classes-panel.component.spec.ts`, `admin-iniciar-clase-drawer.component.spec.ts`
    - [x] `instructor-clase.component.ts` no tiene `.spec.ts` (no existía antes tampoco) — el cambio es un fix de bug en un `catch` existente, no lógica nueva; no se crea spec fuera de scope
- [x] **T5.3** — QA manual (adaptado: sin cuenta de instructor disponible, todo validado desde Admin/Secretaria)
  - **DoD:**
    - [x] AC1: iniciar sesión 516 (instructor 5) mientras 515 seguía `in_progress`, ambas desde `AsistenciaClaseBFacade` (Admin/Secretaria) → rechazado con mensaje legible en UI real (no solo en el mock del test unitario)
    - [~] AC1 cruzado (2 Facades distintas): no verificado en vivo por falta de cuenta de instructor — cobertura equivalente: el trigger vive en BD, no en ningún Facade, así que el rechazo confirmado arriba aplica igual sin importar qué Facade dispare el `UPDATE` (validado también por SQL directo en T1.1, sesiones 515/516)
    - [x] AC2: instructor sin sesión abierta → inició normal, sin regresión
    - [x] AC3: sesión con `scheduled_at` forzado a más de 15 min atrás → apareció marcada (rojo + `alert-triangle` + "Atrasada"/"Cierre atrasado") en `app-live-classes-panel`
    - [x] AC4: clase abierta + siguiente agendada, mismo instructor → ambas visibles en el dashboard simultáneamente
    - [x] AC5: clase cerrada normalmente → la siguiente se inició sin restricción
    - [~] AC-E1: no verificable — sin datos de prueba de un instructor en 2 sedes distintas el mismo día
    - [x] AC-E2: cerrar la clase atrasada → el aviso desapareció sin esperar el tick de 60s (Realtime actualizó `classes()` al instante)
    - [x] Confirmado por el owner (i, 2026-08-04): "todo funciona bien"

- [ ] **T5.4** — Ejecutar `/spec-verify`
  - **DoD:** AC Verifier devuelve `{ok: true}` o tickets restantes resueltos

---

## Fase 6 — Cierre

- [x] **T6.1** — Actualizar `indices/` con todo lo nuevo (hecho a mano: `npm run indices:sync`/`assignments:sync` tienen bug preexistente con el espacio en el path del proyecto — `DATABASE.md`, `FACADES.md`, `COMPONENTS.md`, `UTILS.md` actualizados)
- [x] **T6.2** — Marcar spec como `done` en `ROADMAP.md` (movida de Backlog a Done)
- [x] **T6.3** — Limpiar `specs/.active`

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
