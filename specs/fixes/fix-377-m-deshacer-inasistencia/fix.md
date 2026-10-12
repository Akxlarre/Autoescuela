# Fix: una inasistencia marcada por error no se puede corregir
> id: fix-377-m-deshacer-inasistencia
> refs: fix-366-m-testing-asistencia-clase-b (E07) · ASG-i-027 · fix-191-m
> status: done
> closed: 2026-10-11
> created: 2026-10-11

## Síntoma

Bloque 2 de `fix-366-m`, E07: una clase marcada "Ausente" solo ofrece "Justificar". Si se marcó
por error (el alumno sí vino), no hay forma de volverla atrás.

## Root Cause

No existe la acción.

## Fix

**Decisión de Matías (2026-10-11):**
- En una fila "Ausente" **sin justificar**, botón **"Deshacer"** con confirmación. También en el
  detalle que se abre al tocar una clase "No asistió" en "Clases Actuales" (y en la Agenda, que
  usa el mismo detalle).
- Archiva la falta (`archived_at`, queda en el historial como al reagendar, fix-191-m) y la
  clase vuelve a `scheduled` → "Pendiente". Desde ahí se inicia/finaliza normal o se vuelve a
  marcar.
- Si esa falta ya había cancelado clases por penalización, no vuelven solas: el aviso lo dice y
  se reagendan con "Reagendar Clases" de la ficha.

`AsistenciaClaseBFacade.undoAbsence(sessionId)` lee la clase de la BD (sirve desde cualquier
pantalla) y refresca la tabla, las alertas y "Clases Actuales".

## Acceptance Criteria

- [x] AC1 — "Deshacer" en una falta sin justificar: tras confirmar, la falta queda archivada y la
      clase "Pendiente". Una falta justificada no ofrece "Deshacer".
- [x] AC2 — Funciona desde Asistencia y desde "Clases Actuales" del Dashboard.
- [x] AC3 — Si la falta había disparado una cancelación por penalización, el aviso lo dice.
- [x] AC4 — La alerta del alumno se recalcula (la falta archivada no cuenta).

## Regression Test

`asistencia-clase-b.facade.spec.ts` → `undoAbsence`. Verificación en navegador.

## Verificación (2026-10-11)

- Dashboard: la clase de las 13:30 "No asistió" → detalle → "Deshacer inasistencia" → modal con el
  nombre del alumno → "Inasistencia deshecha — La clase quedó pendiente." y vuelve a "Por iniciar".
- Asistencia: la de las 12:00 "Ausente" → "Deshacer" → "Pendiente" con "Iniciar/Ausente" y su
  alerta del rail desaparece.
- Una falta justificada responde "La inasistencia está justificada" (test). Con clases canceladas
  después de la falta, avisa "N clase(s) se cancelaron… Reagéndalas desde la ficha" (test).
