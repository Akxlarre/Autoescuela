# Fix: Botón "Continuar" del paso 1 muestra flash de "Procesando..." en vez de verse simplemente no-listo
> id: fix-161-m-boton-continuar-flash-procesando
> refs: fix-160-m-matricula-publica-feedback-genero-faltante
> status: done
> closed: 2026-08-12
> created: 2026-08-12

## Root Cause
`onNext()` en `public-personal-data.component.ts` seteaba `_submitting.set(true)` apenas
ocurría el click, antes de validar. Si el formulario resultaba inválido, `_submitting` volvía
a `false` ~10ms después (dentro del `setTimeout` del "Silver Bullet" de autofill), causando un
parpadeo visible del botón ("Continuar" → "Procesando..." → "Continuar") sin que el usuario
llegue a leer nada. El dueño pidió que el botón se vea directamente "no listo" en vez de ese
flash.

No se puede usar `disabled` HTML nativo: el mismo `onNext()` depende de un click real para
disparar el workaround de autofill de Chrome (dispatch de eventos sintéticos sobre los inputs
para forzar el resync de `ngModel` cuando el navegador autocompleta sin emitir `input`/`change`).
Un botón con `disabled` nativo bloquearía ese click y dejaría el formulario sin forma de
recuperarse en el caso de autofill.

## ACs Afectados
Ninguno — fix autónomo (continuación de fix-160, mismo flujo).
- AC-1: Mientras el formulario no es válido (`canAdvance()` false), el botón "Continuar" se ve
  atenuado (opacidad + cursor not-allowed) de forma reactiva, sin esperar a que el usuario
  interactúe.
- AC-2: Al hacer click con el formulario inválido, el botón ya NO pasa por el estado
  "Procesando..." — muestra los errores de inmediato (comportamiento de fix-160 intacto).
- AC-3: Al hacer click con el formulario válido, el flujo de avance (incl. el workaround de
  autofill) sigue funcionando igual que antes.

## Cambio
- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.ts`
- **Qué cambia:**
  1. El botón "Continuar" agrega estilo reactivo atenuado (`opacity`, `cursor`, `aria-disabled`)
     ligado al `canAdvance()` existente — sigue siendo clickeable de verdad (no `disabled` HTML)
     para no romper el workaround de autofill.
  2. `onNext()` deja de hacer `_submitting.set(true)` al inicio del click. Solo se setea
     `true` en la rama donde `advance` es verdadero, justo antes de `next.emit()`.

## Test de Regresión
- Verificación manual (Playwright): en `/inscripcion?branchId=1`, con el formulario vacío el
  botón se ve atenuado desde el inicio. Al hacer click sin completar nada, deben aparecer los
  errores de inmediato y el botón NO debe mostrar "Procesando..." en ningún momento. Al completar
  todos los campos válidos y hacer click, debe avanzar normalmente.
