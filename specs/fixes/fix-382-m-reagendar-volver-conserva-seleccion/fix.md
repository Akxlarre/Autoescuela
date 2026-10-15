# Fix: "Volver" del reagendamiento borra lo que se había desmarcado
> id: fix-382-m-reagendar-volver-conserva-seleccion
> refs: fix-366-m-testing-asistencia-clase-b (J12) · `024b` G08 · ASG-i-027
> status: done
> closed: 2026-10-12
> created: 2026-10-12

## Síntoma

Bloque 3 de `fix-366-m`, J12: en "Reagendar Clases" se desmarcan 2 de 10 → paso 2 "Reagendar 8
Clases" → "Volver" → el paso 1 vuelve con las 10 marcadas, y "Seleccionar Horarios (10)".

## Root Cause

"Volver" (`layoutDrawer.back()`) vuelve a crear el componente del paso 1, y su `ngOnInit` marca
siempre todas las clases. La selección del paso 1 vive en el facade (`reagendarSeleccion`), pero
el paso 1 no la lee.

## Fix

- Paso 1: si el facade ya tiene una selección, marca solo esas clases; si no, todas (como hoy).
- La ficha limpia la selección al abrir "Reagendar Clases", para que una apertura nueva parta con
  todas marcadas.

## Acceptance Criteria

- [x] AC1 — Volver desde el paso 2 conserva exactamente lo que estaba marcado.
- [x] AC2 — Abrir "Reagendar Clases" de nuevo parte con todas marcadas.

## Regression Test

`admin-reagendar-clases-drawer.component.spec.ts` y verificación en navegador.

## Verificación (2026-10-12)

- `admin-reagendar-clases-drawer.component.spec.ts` 2/2 (+ los 4 del paso 2).
- Ficha de `E2E-AsisPenalizado`: 10 marcadas → desmarcar 3 y 4 → "Reagendar 8 Clases" → "Volver"
  → `0011111111` y "Seleccionar Horarios (8)". Cerrar y reabrir → las 10 marcadas.