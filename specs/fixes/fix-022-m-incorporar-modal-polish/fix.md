# fix-022-m — Modal "Incorporar alumno": polish visual + bug de scoping por sede

## Contexto

Tras fix-021 (panel inline → `p-dialog` modal), el dueño probó el modal y reportó
dos problemas sobre una captura real:

1. **Visual:** el título "Incorporar alumno de otro ciclo" y la X de cerrar se ven
   pegados a los bordes del modal — poco profesional.
2. **Bug de negocio:** la lista de alumnos "incorporables" muestra alumnos de
   ciclos de **cualquier sede**, no solo de la sede del ciclo actualmente abierto.
   El dueño señaló correctamente que un alumno nunca debería poder moverse a un
   ciclo de otra escuela — el filtro debe ser por sede del ciclo activo, no
   global.

## Causa raíz (bug de negocio)

`CiclosTeoricosFacade.loadAddableStudents()` (`src/app/core/facades/ciclos-teoricos.facade.ts:295-343`)
filtra por `this._branchFilter()` — el filtro de sede **global** del dashboard
admin (que puede ser `null` = "Todas las escuelas"). Cuando el admin tiene
"Todas las escuelas" seleccionado y abre un ciclo específico (que sí pertenece a
una sede concreta), `loadAddableStudents` trae candidatos de **todas** las sedes,
no solo la del ciclo abierto. El campo correcto para filtrar es el `branchId` del
ciclo actualmente seleccionado (`selectedCycle().branchId`, ya expuesto por
`CicloOption`), no el filtro global del dashboard.

## Causa raíz (visual)

Los 3 usos de `p-dialog` en el proyecto (`admin-pagos`, `secretaria-pagos`,
`ciclos-teoricos-content`) usan el header por defecto de PrimeNG Aura sin
ningún ajuste — no hay un modal "de referencia" mejor diseñado en la app. El
padding por defecto del tema (`overlay.modal.padding: 1.25rem`) es válido pero
no hay separación visual (borde) entre header y contenido, lo que puede leerse
como que título/X están "pegados". Se ajusta el override global en
`src/styles/vendors/_primeng-overrides.scss` para dar más aire y un borde
inferior de separación — beneficia a los 3 modales del proyecto por igual, no
solo a este.

## Cambios

### 1. `core/facades/ciclos-teoricos.facade.ts`
- `loadAddableStudents()`: reemplazar el filtro `branchId` (global) por el
  `branchId` del ciclo seleccionado (`this.selectedCycle()?.branchId`). Si no
  hay ciclo seleccionado, el método ya retorna temprano (no cambia ese guard).

### 2. `styles/vendors/_primeng-overrides.scss`
- Agregar padding explícito y separación visual (borde inferior sutil) al
  `.p-dialog-header`, y asegurar que `.p-dialog-header-icon` (botón cerrar)
  tenga área de toque con separación del borde. Cambio de tokens/CSS, no de
  arquitectura — aplica a los 3 modales existentes.

## Acceptance Criteria

- [x] Al abrir "Incorporar" desde un ciclo de la sede X, `addableStudents` solo
      incluye alumnos de ciclos de la sede X (no de otras sedes), sin importar
      el filtro global del dashboard admin. Cubierto por test de regresión en
      `ciclos-teoricos.facade.spec.ts` ("filtra por la sede del ciclo
      seleccionado, no por el filtro global del dashboard").
- [x] El modal usa padding/borde-separador basados en tokens (`--space-4/5`,
      `--border-subtle`) en `.p-dialog-header/.p-dialog-content/.p-dialog-footer`.
      No se pudo verificar visualmente en navegador real (Playwright MCP no
      disponible en esta máquina, y el usuario pidió no usarlo) — verificado
      solo por build/tsc.
- [x] Cambio es CSS global compartido por los 3 usos de `p-dialog`
      (`admin-pagos`, `secretaria-pagos`, `ciclos-teoricos-content`); no hay
      overrides por componente que puedan chocar. Sin verificación visual real
      (ver punto anterior) — riesgo bajo por ser solo padding/border, sin tocar
      layout ni z-index.
- [x] `npm run test:ci`: 1081 passed / 1 failed — el único fallo es el mismo
      timeout preexistente de `auth.facade.spec.ts` (no relacionado).
