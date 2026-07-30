# Fix: Modal "Incorporar alumno" de Ciclos Teóricos no usa el canon
> id: fix-051-b-ciclos-incorporar-modal-canon
> refs: 0001 (spec original de Ciclos Teóricos)
> status: done
> closed: 2026-07-17
> created: 2026-07-17

## Root Cause
`ciclos-teoricos-content.component.ts` implementa el modal "Incorporar alumno de otro
ciclo" con `<p-dialog>` de PrimeNG en vez del patrón canónico del proyecto (modal a
mano: backdrop + card `rounded-2xl` + `[appModalOverlay]` que teletransporta el modal
sobre el overlay del layout + `appAnimateIn` GSAP para la entrada), que ya usan
`eliminar-alumno-modal` y otros modales "premium" del design system. Confirmado
visualmente en vivo (screenshot): el `p-dialog` se ve plano — sin ícono de header, sin
`backdrop-blur`, esquinas rectas — comparado con el canon.

## ACs Afectados
Ninguno funcional — es consistencia visual/arquitectónica con el design system. No
cambia la lógica de `loadAddableStudents`/`onAddStudent` ni el contrato del Facade.

## Cambio
- **Archivo:** `src/app/shared/components/ciclos-teoricos-content/ciclos-teoricos-content.component.ts`
  - Reemplazar el bloque `<p-dialog>` (líneas ~468-509) por el patrón custom: backdrop
    `fixed inset-0 z-50` + card `rounded-2xl shadow-2xl bg-surface` + `appAnimateIn` +
    cierre por click en backdrop / tecla Escape, igual que `eliminar-alumno-modal`.
  - Agregar `hostDirectives: [{ directive: ModalOverlayDirective, inputs: ['appModalOverlay: addPanelOpen'] }]`
    (o el binding equivalente al signal `addPanelOpen`) para que el modal se
    teletransporte sobre el overlay del layout, igual que `eliminar-alumno-modal`.
  - Quitar `DialogModule` de los imports si ya no se usa `p-dialog` en el resto del
    componente.

## Test de Regresión
- `ng build` compila sin el import de `DialogModule` sobrante.
- `/verify` (Playwright): abrir "Incorporar" en Ciclos Teóricos, confirmar que el
  modal se ve con el estilo canon (backdrop-blur, rounded-2xl, animación GSAP de
  entrada), cierra con Escape y con click fuera, y sigue listando/agregando alumnos
  correctamente (sin regresión funcional).
