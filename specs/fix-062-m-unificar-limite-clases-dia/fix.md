# Fix: Unificar límite de clases/día entre wizard público, wizard interno y reagendamientos (H-021)

> id: fix-062-m-unificar-limite-clases-dia
> refs: ASG-023
> status: in-progress
> created: 2026-07-25

## Root Cause
`[Heredado de ASG-023, a confirmar]:` El wizard público de matrícula (`/inscripcion`) limita a 1 clase por día al agendar las 12 prácticas, mientras el wizard interno (secretaría/admin) permite hasta 3 clases por día — dos reglas de negocio distintas para la misma operación. Decisión de producto tomada por el dueño (2026-07-25): la diferencia ES intencional (el público debe ser más restrictivo por falta de supervisión de secretaría), pero el tope del flujo interno debe bajar de 3 a **2** clases por día. Además, esta regla debe aplicarse de forma consistente en los 3 lugares donde se agenda/reagenda clases, y actualmente NO lo es:

1. **Wizard público** (`public-enrollment.facade.ts:332-338`, computed `maxClassesPerDay`) → ya en 1, sin cambios.
2. **Wizard interno de matrícula** (`secretaria-matricula.component.ts:253`) → `maxClassesPerDay: 3` hardcodeado, debe bajar a `2`.
3. **Reasignación de clases canceladas** (`admin-reagendar-horarios-drawer.component.ts:83`) → `maxClassesPerDay: 3` hardcodeado, debe bajar a `2`.
4. **Reagendamiento desde ficha técnica** (`admin-reprogramar-clase-drawer.component.ts`) → **no tiene ninguna validación de límite diario** (solo valida orden secuencial contra la clase anterior/siguiente). Al reprogramar una sola clase a una fecha/slot arbitrario, puede dejar 3+ clases el mismo día sin bloqueo. Hay que agregar el mismo tope de 2/día que los otros flujos internos.

## ACs Afectados
- Ninguno de spec — hallazgo H-021 (`indices/FLOWS-QA-AUDIT.md`), gestionado como Asignación de equipo (ASG-023).

## Cambio
- `secretaria-matricula.component.ts:253` — `maxClassesPerDay: 3` → `2`.
- `admin-reagendar-horarios-drawer.component.ts:83` — `maxClassesPerDay: 3` → `2`.
- `admin-reprogramar-clase-drawer.component.ts` — agregar validación de máximo 2 clases el mismo día al reprogramar (actualmente inexistente), reutilizando el mismo criterio de conteo que `schedule-grid.logic.ts`.

## Test de Regresión
<!-- Pendiente: agregar test que verifique 1/día en público, 2/día en los 3 flujos internos (matrícula, reasignación de canceladas, reprogramar ficha técnica), y que un intento de exceder el tope sea bloqueado en los 4 lugares. -->

## Notas
- Originado de Asignación ASG-023 (`specs/assignments/ASG-023-decision-h021-limite-clases-dia.md`).
- Decisión de producto documentada arriba — no requiere spec formal, se resuelve como fix.
