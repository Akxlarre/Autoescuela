# Plan 0001-i — Ciclo de vida de la clase: exclusión mutua y aviso de cierre atrasado

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-08-04

---

## 1. Resumen ejecutivo

Se agrega un trigger `BEFORE UPDATE` en `class_b_sessions` que rechaza el `UPDATE` a
`status='in_progress'` si el instructor ya tiene otra sesión `in_progress` — protege ambos
puntos de entrada existentes (`InstructorClasesFacade.startClass()` y
`AsistenciaClaseBFacade.startClass()`) sin duplicar la validación en cada Facade. En paralelo,
se extiende `app-live-classes-panel` (Dashboard Admin/Secretaria) con un cuarto estado visual
("atrasada") para sesiones `in_progress` cuya hora de fin agendada (`scheduled_at +
duration_min`) ya pasó hace más de 15 minutos, distinto de los 3 colores existentes
(pending/in_progress/completed).

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260804120000_class_b_sessions_exclusion_mutua_instructor.sql` | Migration | Trigger `BEFORE UPDATE` que rechaza `status='in_progress'` si el instructor ya tiene otra sesión `in_progress` |
| `src/app/core/utils/class-b-session-overdue.utils.ts` | Util (función pura) | `isSessionOverdue(scheduledAt, durationMin, status, now)` — calcula si una sesión `in_progress` superó los 15 min desde su fin agendado |
| `src/app/core/utils/class-b-session-overdue.utils.spec.ts` | Test | Cobertura de `isSessionOverdue` (TDD, obligatorio por `testing-tdd.md`) |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/models/ui/dashboard.model.ts` | Agregar `durationMin: number` a `LiveClassModel` | Necesario para calcular la hora de fin agendada en el cliente (AC3) |
| `src/app/core/facades/dashboard.facade.ts` | `fetchLiveClasses()`: agregar `duration_min` al `select()` y mapear a `durationMin` en `LiveClassModel` | Fuente de datos para el estado "atrasada" |
| `src/app/shared/components/live-classes-panel/live-classes-panel.component.ts` | Agregar estado visual "atrasada": usar `isSessionOverdue()`, nuevo color (`text-error`) + icono/pulso distinto del verde de `in_progress` normal | AC3 — el estado hoy no existe, `in_progress` recién iniciada y atrasada se ven igual |
| `src/app/core/facades/instructor-clases.facade.ts` | Ninguno funcional — `startClass()` sigue igual, el trigger de BD es quien rechaza. Ajustar manejo de error para mostrar mensaje claro si Supabase devuelve el error del trigger | AC1 — feedback al usuario cuando el trigger rechaza |
| `src/app/core/facades/asistencia-clase-b.facade.ts` | Mismo ajuste de manejo de error que arriba en `startClass()` | AC1 — mismo caso, segundo punto de entrada |
| `indices/DATABASE.md` | Documentar el trigger nuevo en la fila de `class_b_sessions` | Regla del proyecto: toda función/trigger nuevo se documenta |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `app-live-classes-panel` — ya diferencia visualmente `pending`/`in_progress`/`completed`
  (`text-warning`/`text-success`/`text-text-muted`); se extiende con un 4to caso en vez de
  crear un componente nuevo.
- `SessionStatus` (`schedule-status.utils.ts`) — el estado "atrasada" NO es un valor nuevo de
  `status` en BD, es un flag puramente de presentación (`isOverdue: boolean`) calculado en el
  cliente a partir de `status === 'in_progress'` + tiempo transcurrido. No se toca el enum.

### Facades/Services existentes que extendemos
- `InstructorClasesFacade.startClass()` — sin cambio de firma, solo verificación de que el
  error del trigger se propague como mensaje legible (ya usa `ErrorSanitizerService`).
- `AsistenciaClaseBFacade.startClass()` — mismo ajuste.
- `DashboardFacade.fetchLiveClasses()` — se extiende el `select()` existente, no se crea un
  fetch nuevo.

### Componentes/Facades que NO existen y debemos crear
- Ninguno. El único artefacto nuevo de lógica es la función pura `isSessionOverdue()` en
  `core/utils/`, siguiendo el patrón de Núcleo Funcional (`architecture.md`) — no justifica un
  Facade ni Service nuevo.

---

## 4. Modelo de datos

### Migración requerida

```sql
-- supabase/migrations/20260804120000_class_b_sessions_exclusion_mutua_instructor.sql

-- Pseudo-SQL — la versión final va en tasks.md.
CREATE OR REPLACE FUNCTION prevent_concurrent_in_progress_class_b_sessions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' THEN
    IF EXISTS (
      SELECT 1 FROM class_b_sessions
      WHERE instructor_id = NEW.instructor_id
        AND status = 'in_progress'
        AND id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'El instructor ya tiene una clase en curso. Debe cerrarla antes de iniciar otra.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_prevent_concurrent_in_progress
  BEFORE UPDATE ON class_b_sessions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_concurrent_in_progress_class_b_sessions();
```

**Nota de diseño:** exclusión mutua es por `instructor_id` global (sin filtro de sede) — un
instructor es una sola persona física, confirmado por el owner (spec §9, AC-E1). No se usa
constraint `UNIQUE` parcial porque un `EXCEPTION` con mensaje legible es más fácil de propagar
al usuario que un error de violación de constraint genérico.

### RLS

Sin cambios — el trigger corre en el mismo `UPDATE` ya cubierto por
`update_class_b_sessions` (admin/secretary/instructor propio). No se agregan policies nuevas.

### Modelos UI/DTO

- `core/models/ui/dashboard.model.ts` → `LiveClassModel` gana el campo `durationMin: number`
  (no hay DTO nuevo — `duration_min` ya existe en la tabla `class_b_sessions`, solo faltaba
  seleccionarlo).

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
[Exclusión mutua]
InstructorClasesFacade.startClass()  ─┐
                                       ├─→ UPDATE class_b_sessions SET status='in_progress'
AsistenciaClaseBFacade.startClass()  ─┘         │
                                                 ▼
                                   trigger BEFORE UPDATE (BD)
                                   ├─ ya hay in_progress del mismo instructor → RAISE EXCEPTION
                                   └─ no hay conflicto → OK, UPDATE procede
                                                 │
                                    Facade captura error Postgres (P0001)
                                    → ErrorSanitizerService → mensaje legible al usuario

[Aviso visual "atrasada"]
DashboardFacade.fetchLiveClasses()
  └─ select(..., duration_min) → LiveClassModel.durationMin
       └─ LiveClassesPanelComponent
             └─ isSessionOverdue(scheduledAt, durationMin, status, now)  [core/utils, función pura]
                   └─ true → variante visual "atrasada" (text-error + ícono/pulso distinto)
                   └─ false → variante existente (pending/in_progress/completed sin cambios)
```

### Capas tocadas

- **Dumb**: `shared/components/live-classes-panel/live-classes-panel.component.ts`
- **Facade**: `core/facades/dashboard.facade.ts`, `core/facades/instructor-clases.facade.ts`,
  `core/facades/asistencia-clase-b.facade.ts`
- **Util (Núcleo Funcional)**: `core/utils/class-b-session-overdue.utils.ts`
- **Migration**: `supabase/migrations/20260804120000_...sql`

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Núcleo Funcional: `isSessionOverdue()` es función pura testeable sin
  Angular; Facades no acumulan lógica de cálculo de tiempo.
- [x] `facades.md` — `AsistenciaClaseBFacade`/`InstructorClasesFacade` no cambian su contrato
  público; siguen siendo el único punto de entrada de UI a Supabase para esta tabla.
- [ ] `models.md` — no aplica, no hay DTO nuevo, solo un campo agregado a un UI model existente.
- [x] `visual-system.md` — usar `text-error` (token existente) para el estado "atrasada", NUNCA
  un color arbitrario nuevo. Reutilizar `.animate-pulse`/`.badge-pulse` si se agrega pulso.
- [ ] `swr-pattern.md` — no aplica, `fetchLiveClasses()` ya sigue SWR/Realtime, no se toca ese
  patrón.
- [ ] `notifications.md` — no aplica, la spec descarta explícitamente notificación persistente
  (solo aviso visual en vivo).
- [x] `testing-tdd.md` — `isSessionOverdue()` es `core/utils/` → `.spec.ts` obligatorio,
  escrito primero (TDD).
- [ ] `ai-readability.md` — no aplica, no hay botón de mutación nuevo (el botón "Iniciar" ya
  existe y ya debería tener su `data-llm-action`; verificar en tasks si falta).

---

## 7. Plan de testing

- **Unitarios (obligatorios):**
  - `class-b-session-overdue.utils.spec.ts`: casos — `in_progress` recién iniciada (false),
    `in_progress` justo en el límite de 15 min (false/true según borde exacto, definir
    inclusive/exclusive en tasks.md), `in_progress` claramente atrasada (true), `pending`/
    `completed` (siempre false sin importar el tiempo).
  - `instructor-clases.facade.spec.ts` / `asistencia-clase-b.facade.spec.ts`: agregar caso
    "startClass() propaga mensaje legible cuando Supabase devuelve error P0001 del trigger".
- **Integración / manual (golden path + edge cases):**
  - Instructor inicia clase A, intenta iniciar clase B (mismo instructor) sin cerrar A → debe
    rechazarse con mensaje claro, desde el portal del instructor.
  - Secretaria intenta iniciar clase B desde el Dashboard mientras el mismo instructor tiene A
    `in_progress` (iniciada desde el portal del instructor) → debe rechazarse igual (prueba
    cruzada entre los 2 Facades, valida que el trigger cubre ambos).
  - Clase A `in_progress` pasa los 15 min desde su fin agendado → `app-live-classes-panel`
    muestra el estado "atrasada" sin necesidad de refrescar manualmente (Realtime ya cubierto,
    solo verificar que el cálculo de tiempo se re-evalúe — ver riesgo below).
  - Cerrar manualmente una clase atrasada → el estado "atrasada" desaparece de inmediato.
- **QA visual (`/verify`):** confirmar contraste del nuevo color `text-error` en modo claro y
  oscuro, y que no rompe el layout existente de la tarjeta.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| El cálculo de "atrasada" es client-side (`new Date()` al render); si el panel no re-renderiza cada minuto, una clase que recién cruzó el umbral de 15 min no se pinta hasta el próximo refresh (Realtime/SWR solo dispara con cambios en BD, no con el paso del tiempo) | Media | Evaluar en tasks.md un `setInterval`/`signal` de "tick" liviano (ej. cada 60s) SOLO para forzar re-evaluación del computed de horas — no confundir con el `setInterval` de polling que se eliminó en fix-004-i (ese traía datos de BD; este solo re-evalúa una función pura local, no dispara fetch) |
| El mensaje de error del trigger (`RAISE EXCEPTION`) llega como texto crudo de Postgres a través de `ErrorSanitizerService` — puede no sanitizarse igual en los 2 Facades si no se prueba explícitamente en ambos | Media | Test unitario explícito en ambos `.spec.ts` (ver sección 7), no asumir que un fix en un Facade cubre el otro |
| Instructores con sesiones "huérfanas" ya `in_progress` en producción desde antes de este fix (nadie las cerró nunca) podrían bloquear el primer intento de iniciar una clase nueva después del deploy | Alta (dato real, no hipotético) | Antes de mergear la migración, correr un SELECT de auditoría (`status='in_progress'` con `scheduled_at` de días anteriores) y decidir con el owner si se cierran a mano antes del deploy — **no** se auto-cierran por código, contradice la decisión de "siempre cierre manual" (spec §9) |

---

## 9. Orden de implementación

1. `class-b-session-overdue.utils.spec.ts` + `class-b-session-overdue.utils.ts` (TDD)
2. Migración SQL (trigger) — probar manualmente en Supabase local con 2 sesiones del mismo
   instructor antes de continuar
3. Auditoría de sesiones `in_progress` huérfanas en producción (riesgo #3) — coordinar con el
   owner antes de continuar si aparecen filas
4. `dashboard.model.ts` (+ `durationMin`) y `dashboard.facade.ts` (`fetchLiveClasses()`)
5. `live-classes-panel.component.ts` — estado visual "atrasada"
6. Manejo de error del trigger en `instructor-clases.facade.ts` y `asistencia-clase-b.facade.ts`
   + sus `.spec.ts`
7. QA manual cruzado (los 2 puntos de entrada) + `/verify` visual
8. `indices/DATABASE.md` — documentar el trigger

---

## 10. Estimación

M — 2 a 3 días (incluye la auditoría de datos huérfanos del riesgo #3, que puede extenderse si
aparecen muchas filas a resolver con el cliente).

---

## Changelog

- 2026-08-04 — plan inicial. Trigger BD (no constraint UNIQUE, error legible) para cubrir los 2
  puntos de entrada (`InstructorClasesFacade` + `AsistenciaClaseBFacade`) descubiertos en esta
  fase. Estado visual "atrasada" nuevo en `live-classes-panel` (no reutiliza los 3 colores
  existentes). Riesgo de datos huérfanos identificado y añadido como paso previo al deploy.
