# Fix: Unificar límite de clases/día entre wizard público, wizard interno y reagendamientos (H-021)

> id: fix-062-m-unificar-limite-clases-dia
> refs: ASG-023
> status: done
> closed: 2026-07-25
> created: 2026-07-25

## Root Cause
`[Heredado de ASG-023, a confirmar]:` El wizard público de matrícula (`/inscripcion`) limita a 1 clase por día al agendar las 12 prácticas, mientras el wizard interno (secretaría/admin) permite hasta 3 clases por día — dos reglas de negocio distintas para la misma operación. Decisión de producto tomada por el dueño (2026-07-25): la diferencia ES intencional (el público debe ser más restrictivo por falta de supervisión de secretaría), pero el tope del flujo interno debe bajar de 3 a **2** clases por día. Además, esta regla debe aplicarse de forma consistente en los 3 lugares donde se agenda/reagenda clases, y actualmente NO lo es:

1. **Wizard público** (`public-enrollment.facade.ts:332-338`, computed `maxClassesPerDay`) → ya en 1, sin cambios.
2. **Wizard interno de matrícula** (`secretaria-matricula.component.ts:253`) → `maxClassesPerDay: 3` hardcodeado, debe bajar a `2`.
3. **Reasignación de clases canceladas** (`admin-reagendar-horarios-drawer.component.ts:83`) → `maxClassesPerDay: 3` hardcodeado, debe bajar a `2`.
4. **Reagendamiento desde ficha técnica** (`admin-reprogramar-clase-drawer.component.ts`, vía `AdminAlumnoDetalleFacade.computeBlockedDates()` en `admin-alumno-detalle.facade.ts:1342-1355`) → SÍ existe un mecanismo de bloqueo (fechas con `count >= 3` se marcan `occupied` en el grid), pero el umbral está hardcodeado en 3, no en 2. Hay que bajarlo a `>= 2` para que sea consistente con el resto de flujos internos.

Nota: la investigación inicial (previa a leer el Facade completo) reportó erróneamente que este flujo no tenía validación alguna — sí la tiene, solo con el umbral equivocado.

## ACs Afectados
- Ninguno de spec — hallazgo H-021 (`indices/FLOWS-QA-AUDIT.md`), gestionado como Asignación de equipo (ASG-023).

## Cambio
- `secretaria-matricula.component.ts:253` — `maxClassesPerDay: 3` → `2`.
- `admin-reagendar-horarios-drawer.component.ts:83` — `maxClassesPerDay: 3` → `2`.
- `admin-alumno-detalle.facade.ts:1352` (`computeBlockedDates()`) — `count >= 3` → `count >= 2`. Afecta directamente al drawer "Reprogramar Clase" de la ficha técnica, que consume este método vía `loadScheduleGrid()`.

## Test de Regresión
`admin-alumno-detalle.facade.spec.ts` (nuevos, dentro de `describe('loadScheduleGrid — límite dinámico de reagendamiento')`):
- "bloquea un día que ya tiene 2 clases agendadas — tope bajó de 3 a 2": con 2 sesiones existentes el mismo día, el slot resultante queda `status: 'occupied'`.
- "NO bloquea un día que solo tiene 1 clase agendada — cabe una 2da": con 1 sesión existente, el slot queda `status: 'available'`.

29/29 tests verdes en `admin-alumno-detalle.facade.spec.ts`. `secretaria-matricula.component.ts` y `admin-reagendar-horarios-drawer.component.ts` no tienen `.spec.ts` (constante literal sin lógica derivada) — cambio verificado por lectura + `tsc --noEmit` sin errores.

## Notas
- Originado de Asignación ASG-023 (`specs/assignments/ASG-023-decision-h021-limite-clases-dia.md`).
- Decisión de producto documentada arriba — no requiere spec formal, se resuelve como fix.
