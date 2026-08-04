# Tasks 0001-i — Ciclo de vida de la clase: exclusión mutua y aviso de cierre atrasado

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
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

- [ ] **T0.1** — Auditar sesiones `in_progress` huérfanas en producción
  - **DoD:**
    - [ ] Corrido en Supabase (dashboard SQL o local): `SELECT id, instructor_id, scheduled_at, status FROM class_b_sessions WHERE status = 'in_progress' AND scheduled_at < CURRENT_DATE;`
    - [ ] Resultado documentado acá (cantidad de filas, instructores afectados)
    - [ ] Si hay filas: decisión explícita del owner registrada (¿se cierran a mano antes del deploy? ¿se dejan y se acepta que ese instructor no podrá iniciar clases nuevas hasta cerrarlas manualmente?)
    - [ ] Si no hay filas: marcar DoD como "sin hallazgos" y continuar sin bloqueo

---

## Fase 1 — Datos y modelo

- [ ] **T1.1** — Crear migración `20260804120000_class_b_sessions_exclusion_mutua_instructor.sql`
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [ ] Trigger `BEFORE UPDATE` en `class_b_sessions` que rechaza `status='in_progress'` si el `instructor_id` ya tiene otra fila `in_progress` (excluyendo la propia `id`)
    - [ ] Mensaje de `RAISE EXCEPTION` legible en español (ver pseudo-SQL del plan §4)
    - [ ] `SECURITY DEFINER` (mismo patrón que otros triggers de la tabla)
    - [ ] `npx supabase db reset` corre sin error
    - [ ] Prueba manual local: 2 `UPDATE` consecutivos al mismo `instructor_id` a `in_progress` → el segundo falla con el mensaje esperado
    - [ ] Prueba manual local: `UPDATE` a `in_progress` de un instructor SIN otra sesión abierta → pasa sin error (no regresión, AC2)
    - [ ] Documentado en `indices/DATABASE.md` (fila de `class_b_sessions`, sección de triggers)

- [ ] **T1.2** — Agregar `durationMin` a `LiveClassModel`
  - **DoD:**
    - [ ] `core/models/ui/dashboard.model.ts`: campo `durationMin: number` agregado a `LiveClassModel`
    - [ ] Documentado en `indices/MODELS.md` si el archivo lista los campos de este UI model

---

## Fase 2 — Núcleo funcional (TDD)

- [ ] **T2.1** — Escribir `class-b-session-overdue.utils.spec.ts` PRIMERO
  - **AC ref:** AC3, AC-E2
  - **DoD:**
    - [ ] Caso: `status='in_progress'`, ahora < `scheduled_at + duration_min` → `false`
    - [ ] Caso: `status='in_progress'`, ahora > `scheduled_at + duration_min + 15min` → `true`
    - [ ] Caso borde: exactamente a los 15 min del fin agendado → definir y testear si es inclusive o exclusive (documentar la decisión en el test)
    - [ ] Caso: `status='pending'` o `status='completed'`, sin importar el tiempo → siempre `false`
    - [ ] Tests FALLAN (no hay implementación aún)

- [ ] **T2.2** — Implementar `isSessionOverdue()` en `class-b-session-overdue.utils.ts`
  - **AC ref:** AC3, AC-E2
  - **DoD:**
    - [ ] Firma: `isSessionOverdue(scheduledAt: string, durationMin: number, status: string, now?: Date): boolean`
    - [ ] Función pura (sin Angular, sin efectos secundarios), acepta `now` opcional para testeabilidad
    - [ ] Tests PASAN (`npm run test:ci`)
    - [ ] Documentado en `indices/UTILS.md`

---

## Fase 3 — Capa Facade (manejo de error del trigger)

- [ ] **T3.1** — `InstructorClasesFacade.startClass()`: propagar error legible del trigger
  - **AC ref:** AC1
  - **DoD:**
    - [ ] Si Supabase devuelve el error del trigger (código `P0001`), el mensaje mostrado al usuario es el texto del `RAISE EXCEPTION` (vía `ErrorSanitizerService`), no un error genérico
    - [ ] Test en `instructor-clases.facade.spec.ts`: mock de error `P0001` → verificar mensaje propagado
    - [ ] Test de regresión: `startClass()` sin conflicto sigue funcionando igual (AC2)

- [ ] **T3.2** — `AsistenciaClaseBFacade.startClass()`: mismo tratamiento
  - **AC ref:** AC1
  - **DoD:**
    - [ ] Mismo comportamiento que T3.1, implementado independientemente (no asumir que el fix de un Facade cubre el otro — ver riesgo #2 del plan)
    - [ ] Test en `asistencia-clase-b.facade.spec.ts` equivalente al de T3.1

---

## Fase 4 — Capa UI

- [ ] **T4.1** — `DashboardFacade.fetchLiveClasses()`: seleccionar y mapear `duration_min`
  - **DoD:**
    - [ ] `select()` de `class_b_sessions` incluye `duration_min`
    - [ ] `LiveClassModel.durationMin` mapeado desde `row.duration_min`
    - [ ] Sin cambios en el resto del mapeo (no rompe campos existentes)

- [ ] **T4.2** — `live-classes-panel.component.ts`: estado visual "atrasada"
  - **AC ref:** AC3
  - **DoD:**
    - [ ] Usa `isSessionOverdue(cls.scheduledAt, cls.durationMin, cls.status)` para derivar el nuevo estado (computed o método, no lógica repetida inline en el template)
    - [ ] Color distinto de los 3 existentes: `text-error` (token del DS, ver `visual-system.md`) — NO reutilizar `text-warning` (ya es "pending")
    - [ ] Señal visual adicional más allá del color (ícono o `.animate-pulse`/`.badge-pulse` existente) — no solo cambio de texto
    - [ ] No rompe el estado `in_progress` normal (una clase recién iniciada sigue viéndose como hoy)
    - [ ] `data-llm-description` o similar en el elemento si aplica (`ai-readability.md`)

- [ ] **T4.3** — Re-evaluación periódica del estado "atrasada" (riesgo #1 del plan)
  - **AC ref:** AC3, AC-E2
  - **DoD:**
    - [ ] Mecanismo liviano (ej. `signal` + `setInterval` de 60s SOLO para re-triggerear el `computed()` local, sin fetch a BD) que fuerza que una clase cruce a "atrasada" sin necesidad de refresh manual
    - [ ] Confirmado que NO reintroduce el polling de datos eliminado en fix-004-i (esto es un tick de UI puro, no un fetch)
    - [ ] Al cerrar la clase manualmente, el estado "atrasada" desaparece de inmediato (Realtime ya cubre el refresh de datos, AC-E2)

---

## Fase 5 — Validación

- [ ] **T5.1** — `npm run lint:arch` corre limpio
- [ ] **T5.2** — `npm run test:ci` corre verde (incluye los specs nuevos de T2.1, T3.1, T3.2)
- [ ] **T5.3** — QA manual cruzado
  - **DoD:**
    - [ ] AC1: iniciar clase B desde el portal del instructor mientras A sigue abierta (mismo instructor) → rechazado
    - [ ] AC1 (cruzado): iniciar clase B desde el Dashboard/Asistencia B (secretaria) mientras A sigue abierta desde el portal del instructor → rechazado igual
    - [ ] AC2: instructor sin sesión abierta → inicia normal, sin regresión
    - [ ] AC3: clase que supera 15 min desde su fin agendado → aparece marcada en `app-live-classes-panel`
    - [ ] AC4: clase A abierta + clase B agendada al mismo tiempo → ambas visibles en el dashboard, solo el inicio de B está bloqueado
    - [ ] AC5: clase cerrada normalmente → la siguiente se puede iniciar sin restricción
    - [ ] AC-E1: (si hay datos de prueba multi-sede) instructor con clases en 2 sedes → exclusión sigue siendo global
    - [ ] AC-E2: cerrar una clase atrasada → el aviso desaparece sin refresh manual
    - [ ] Evidencia (capturas o notas) volcada en `acceptance.md`
  - **/verify** (Playwright): confirmar contraste del nuevo color en modo claro/oscuro y que no rompe el layout de la tarjeta

- [ ] **T5.4** — Ejecutar `/spec-verify`
  - **DoD:** AC Verifier devuelve `{ok: true}` o tickets restantes resueltos

---

## Fase 6 — Cierre

- [ ] **T6.1** — Actualizar `indices/` con todo lo nuevo (`/sync-indices`)
- [ ] **T6.2** — Marcar spec como `done` en `ROADMAP.md`
- [ ] **T6.3** — Limpiar `specs/.active`

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
