# Acceptance 0001-i — Ciclo de vida de la clase: exclusión mutua y aviso de cierre atrasado

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-08-04
> **Verifier:** Claude Sonnet 5 · validado por i

---

## Resumen

- AC totales: 7 (AC1–AC5, AC-E1, AC-E2)
- AC cumplidos: 5
- AC con evidencia parcial (cobertura equivalente, no verificación directa): 1 (AC1 cruzado)
- AC no verificable con los datos disponibles: 1 (AC-E1)
- AC fallidos: 0

**Veredicto final:** ⚠️ PARCIAL (no bloqueante — ver justificación de los 2 gaps abajo; ambos son de
verificación, no de implementación faltante)

---

## Verificación por AC

### AC1 — Rechazar `startClass()` si el instructor ya tiene una sesión `in_progress`

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Migración: `supabase/migrations/20260804120000_class_b_sessions_exclusion_mutua_instructor.sql` — trigger `trg_prevent_concurrent_in_progress`
  - Test SQL manual (BD real): sesiones #515/#516 (instructor 5) — la segunda falló con el mensaje esperado (T1.1)
  - Test: `src/app/core/facades/asistencia-clase-b.facade.spec.ts` — caso error P0001 propagado
  - Test: `src/app/core/facades/instructor-clases.facade.spec.ts` — caso error P0001 propagado
  - QA manual (T5.3): iniciar sesión 516 mientras 515 seguía `in_progress`, ambas vía `AsistenciaClaseBFacade` (Admin/Secretaria) → rechazado con mensaje legible en UI real
- **Notas:** validado en UI real solo desde el path de Admin/Secretaria (sin cuenta de instructor disponible para probar `InstructorClasesFacade` end-to-end). Ver AC1 cruzado abajo para la justificación de por qué esto no deja un hueco real.

### AC1 cruzado — Ambos puntos de entrada (`InstructorClasesFacade` y `AsistenciaClaseBFacade`) protegidos por el mismo trigger

- **Estado:** ⚠️ parcial — cobertura equivalente, no verificación directa en UI
- **Evidencia:**
  - El trigger (`prevent_concurrent_in_progress_class_b_sessions()`) corre a nivel de BD sobre cualquier `UPDATE` a `class_b_sessions`, sin importar qué código lo dispare — no hay lógica de exclusión mutua duplicada en ningún Facade que pudiera divergir entre los dos paths
  - Validado por SQL directo (T1.1) — un `UPDATE` crudo sin pasar por ningún Facade también fue rechazado, lo que confirma que la protección no depende de qué cliente la invoque
- **Notas:** no se pudo loguear como instructor en esta sesión para confirmar el rechazo end-to-end desde el portal del instructor. El riesgo residual es bajo (la garantía es a nivel de BD, no de código cliente) pero **no** es una verificación end-to-end completa. Recomendado: la próxima vez que alguien tenga acceso a una cuenta de instructor, correr el caso cruzado real y actualizar esta sección.

### AC2 — Sin regresión: instructor sin sesión abierta inicia normal

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test SQL manual (BD real): instructor sin otra sesión `in_progress` → `UPDATE` a `in_progress` pasó sin error (T1.1)
  - Test: `src/app/core/facades/asistencia-clase-b.facade.spec.ts` / `instructor-clases.facade.spec.ts` — caso éxito sin conflicto
  - QA manual (T5.3): confirmado en UI real

### AC3 — Aviso visual a los 15 min de retraso en el cierre

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `src/app/core/utils/class-b-session-overdue.utils.ts` (`isSessionOverdue`)
  - Test: `src/app/core/utils/class-b-session-overdue.utils.spec.ts` — 8/8 verde, incluye caso borde (15 min inclusive)
  - Código: `src/app/shared/components/live-classes-panel/live-classes-panel.component.ts` (`isOverdue()`, estado visual `text-error`/`bg-error-subtle`/`alert-triangle`/`.badge-pulse`)
  - Test: `src/app/shared/components/live-classes-panel/live-classes-panel.component.spec.ts` — 14/14 verde
  - QA manual (T5.3): sesión forzada a 20 min de atraso vía SQL → apareció marcada en rojo con ícono e etiqueta "Atrasada"/"Cierre atrasado" en el Dashboard real

### AC4 — Visibilidad simultánea (clase abierta + siguiente agendada)

- **Estado:** ✅ cumplido
- **Evidencia:**
  - No se implementó ningún filtro que oculte sesiones — `fetchLiveClasses()`/`visibleClasses()` no cambiaron su criterio de inclusión, solo se agregó `durationMin` al mapeo
  - QA manual (T5.3): confirmado en UI real, ambas sesiones visibles a la vez

### AC5 — Secuencial: cerrar A permite iniciar B sin restricción

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Trigger: solo actúa cuando `NEW.status='in_progress' AND OLD.status IS DISTINCT FROM 'in_progress'` y hay OTRA fila `in_progress` — una vez cerrada A (`completed`/`no_show`), deja de contar como conflicto
  - QA manual (T5.3): cerrar 515 → iniciar 516 sin error

### AC-E1 — Exclusión mutua es global por instructor (no por sede)

- **Estado:** ⚠️ no verificable con los datos disponibles
- **Evidencia:** el trigger filtra por `instructor_id` sin ningún filtro de `branch_id` (revisar `20260804120000_...sql`) — la implementación es correcta por diseño
- **Notas:** no había datos de prueba de un instructor con sesiones en 2 sedes distintas el mismo día para confirmarlo en vivo. No bloqueante — el código no tiene ninguna referencia a sede en el trigger, así que no hay forma de que se comporte distinto por sede aunque quisiera.

### AC-E2 — El aviso desaparece al cerrar la clase manualmente

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `isOverdue()` depende de `cls.status === 'in_progress'` — al pasar a `completed`, retorna `false` inmediatamente
  - Test: `live-classes-panel.component.spec.ts` — caso `false para pending sin importar el tiempo` cubre el mismo principio para status no `in_progress`
  - QA manual (T5.3): cerrar la clase atrasada → el aviso desapareció sin esperar el tick de 60s (Realtime actualizó `classes()` al instante)

---

## Out-of-scope respetado

- ❌ Geocerca GPS — confirmado: no se tocó nada relacionado a ubicación/GPS en esta spec
- ❌ Cierre automático a un estado terminal (cron/trigger que cierre solas las sesiones olvidadas) — confirmado: el trigger implementado solo **rechaza** el `startClass()` conflictivo, no cierra nada; no existe ningún cron nuevo
- ❌ Notificación persistente (capa 2, `NotificationsFacade`) por clase atrasada — confirmado: el aviso es 100% visual/efímero en `live-classes-panel`, no se creó ninguna notificación persistida
- ❌ Modificaciones a `fix-091-m`/`fix-092-m` (alerta de cierre manual ya existente) — confirmado: no se tocó `notify_class_b_completed()` ni migraciones relacionadas

---

## Deuda técnica detectada

- **AC1 cruzado sin verificación end-to-end real** (ver arriba) → cuando haya cuenta de instructor disponible, correr el caso cruzado real y actualizar esta sección. No amerita spec nueva, es una verificación pendiente de bajo riesgo.
- **`live-classes-panel.component.ts` supera el límite de complejidad** (354 líneas, límite 200 — ya estaba en 319 antes de esta spec) → candidato a dividir en subcomponentes en una spec de refactor de DS, no bloqueante para esta.
- **`asistencia-clase-b.facade.ts` supera el límite de `inject()`** (7, límite 5 — ya estaba en 6 antes de esta spec) → mismo caso, candidato a extraer lógica a un service, no bloqueante.
- **`instructor-clase.component.ts` sin `.spec.ts`** → preexistente a esta spec (el cambio fue un fix de bug menor en un `catch`), no se creó test nuevo por estar fuera de scope. Si este componente gana más lógica en el futuro, debería ganar su spec.

---

## Cambios en índices

- `indices/DATABASE.md` — agregado el trigger `prevent_concurrent_in_progress_class_b_sessions()` en la fila de funciones/triggers de `class_b_sessions`
- `indices/FACADES.md` — notas agregadas en `InstructorClasesFacade`, `AsistenciaClaseBFacade` (manejo del error del trigger) y `DashboardFacade` (`duration_min` en `fetchLiveClasses()`)
- `indices/COMPONENTS.md` — `app-live-classes-panel` actualizado con el nuevo estado "atrasada"
- `indices/UTILS.md` — agregado `class-b-session-overdue.utils.ts` (`isSessionOverdue`) — agregado a mano por bug preexistente de `npm run indices:sync` con el espacio en el path del proyecto (no relacionado a esta spec)
- `indices/MODELS.md` — sin cambio necesario (no lista campos individuales de `LiveClassModel`)

---

## Post-mortem

- **Qué salió mejor de lo esperado:** el Discovery del plan encontró a tiempo que había 2 Facades distintas llamando `startClass()` (no solo la que mencionaba la Asignación original) — evitó una implementación que hubiera dejado un hueco real de exclusión mutua.
- **Qué fricciones encontramos:**
  - `npm run indices:sync` tiene un bug preexistente (ENOENT por el espacio en el path del proyecto, `C:\Proyecto Autoescuela\...`) que obligó a documentar los índices a mano.
  - No había cuenta de instructor disponible para el QA manual, dejando el caso "AC1 cruzado" con verificación indirecta en vez de end-to-end real.
  - La corrida completa de `npm run test:ci` (sin filtro) tiene un problema de infraestructura preexistente ajeno a esta spec — se validó archivo por archivo en su lugar.
- **Qué cambiaríamos en el siguiente ciclo:** conseguir credenciales de prueba para los 3 roles (admin, secretaria, instructor) antes de empezar el QA manual, para no tener que rediseñar el flujo de verificación a mitad de camino.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia (2 con gaps de verificación documentados y aceptados, no de implementación)
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando (83/83 en los archivos relacionados a esta spec — suite completo tiene problema de infra preexistente ajeno)
- [x] `lint:arch` limpio (exit 0; 2 warnings de complejidad preexistentes, agravados levemente, documentados como deuda)
- [x] Sin deuda crítica abierta (la deuda listada es menor y no bloqueante)

**Cerrado por:** i
**Fecha:** 2026-08-04
