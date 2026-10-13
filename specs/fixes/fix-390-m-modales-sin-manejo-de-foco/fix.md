# Fix: los modales no toman el foco del teclado
> id: fix-390-m-modales-sin-manejo-de-foco
> refs: fix-366-m-testing-asistencia-clase-b (O05) · ASG-i-027 · fix-357-m (mismo criterio en el panel lateral)
> status: done
> closed: 2026-10-12
> created: 2026-10-12

## Síntoma

Bloque 4 de `fix-366-m`, O05, usando solo el teclado:
- **Confirmación global** ("Marcar inasistencia", "Deshacer", "Borrar horarios" y el resto de las
  confirmaciones de la app): al abrirse, el foco queda en el botón de atrás. Tab sigue por la
  pantalla tapada, Escape no lo cierra, y sus botones no se alcanzan: están primeros en el orden
  de tabulación, así que habría que dar la vuelta completa. Un segundo Enter vuelve a disparar el
  botón de atrás.
- **Justificar, Ver motivo, Elegir destinatarios e Incorporar alumno** (Asistencia B): Escape
  cierra, pero el foco tampoco entra, Tab sale del modal y al cerrar no vuelve al botón que lo
  abrió.

## Root Cause

Ningún modal maneja el foco. `fix-357-m` lo resolvió para el panel lateral (`LayoutDrawerComponent`)
pero los modales se dibujan aparte: el de confirmación en `AppShellComponent` y los demás dentro
de su componente, con `appModalOverlay`.

## Fix

- `core/utils/focus-trap.utils.ts`: funciones puras — qué elementos reciben foco dentro de un
  contenedor, cuál lo toma al abrir y a dónde salta Tab en los extremos.
- `core/directives/modal-focus.directive.ts` (`appModalFocus`): al crearse el modal recuerda quién
  tenía el foco y lo lleva adentro; mantiene Tab y Shift+Tab dentro; al destruirse lo devuelve.
- Se aplica al modal de confirmación global (que además cierra con Escape, como "Cancelar") y a
  los cuatro modales de Asistencia B. En "Justificar" el foco parte en el campo del motivo.

Los demás modales de la app (eliminar alumno, eliminar servicio, panel de notificaciones) no se
tocan en este fix; la directiva queda disponible para ellos.

## Acceptance Criteria

- [x] AC1 — Al abrir la confirmación global el foco queda en "Cancelar"; Tab alterna entre sus dos
  botones; Escape la cierra como "Cancelar"; el foco vuelve al botón que la abrió.
- [x] AC2 — Escape en la confirmación abierta sobre el panel lateral no cierra el panel.
- [x] AC3 — Justificar: el foco parte en el motivo; Tab no sale del modal; al cerrar vuelve a
  "Justificar".
- [x] AC4 — Elegir destinatarios e Incorporar alumno: el foco entra y Tab no sale.

## Regression Test

`focus-trap.utils.spec.ts` y verificación en navegador con teclado (`b4-o2.cjs`).

## Verificación (2026-10-12)

- `focus-trap.utils.spec.ts` 11/11; `tsc` sin errores.
- Navegador, solo teclado (secretaria, `b4-o2.cjs` y `b4-o3.cjs`):
  - "Marcar inasistencia": el foco abre en "Cancelar"; Tab alterna "Marcar ausente" ↔ "Cancelar";
    Escape cierra sin marcar y el foco vuelve a "Ausente" de la fila.
  - La misma confirmación abierta desde el panel de Iniciar: Escape cierra solo la confirmación, el
    panel sigue abierto y el foco vuelve a su botón "Marcar ausente".
  - Justificar: abre en el campo del motivo; Tab recorre motivo → "Cancelar" → "Cerrar" → motivo
    ("Guardar" está deshabilitado con el motivo vacío); Escape cierra y el foco vuelve a
    "Justificar".
  - Elegir destinatarios: Shift+Tab desde "Cerrar" salta a "Enviar a 15" y Tab vuelve; al cerrar, el
    foco vuelve a "Elegir destinatarios y enviar". Incorporar alumno: el foco entra y vuelve a
    "Incorporar".
