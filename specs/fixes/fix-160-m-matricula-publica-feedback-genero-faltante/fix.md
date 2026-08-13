# Fix: Matrícula pública paso 1 — sin feedback visual cuando falta género (u otro campo) al presionar Continuar
> id: fix-160-m-matricula-publica-feedback-genero-faltante
> refs: —
> status: done
> closed: 2026-08-12
> created: 2026-08-12

## Root Cause
En `public-personal-data.component.ts`, `onNext()` valida correctamente con `canAdvanceFn` y bloquea
el avance si falta un campo obligatorio (ej. género), marcando el campo como "dirty". Pero el bloque
de Género (`role="radiogroup"`) es el único campo obligatorio del formulario que nunca renderiza un
mensaje de error ni un borde de error — a diferencia de RUT, Nombres, Apellido paterno y Fecha de
nacimiento, que sí lo hacen. Resultado: el botón muestra "Procesando..." por el `setTimeout` de 10ms
y luego vuelve a "Continuar" sin que el usuario vea ninguna indicación de qué falta.

## ACs Afectados
Ninguno — fix autónomo (bug reportado por QA manual del dueño en el flujo público de matrícula).
- AC-1: Si el usuario no selecciona género y presiona "Continuar", el radiogroup muestra borde de
  error y un mensaje "Selecciona una opción" — igual que el resto de campos obligatorios.

## Cambio
- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.ts`
- **Qué cambia:** Se agrega `genderValid` computed y feedback visual (borde + mensaje de error +
  `aria-invalid`) al radiogroup de Género, siguiendo el mismo patrón que RUT/Nombres/Apellido.

## Test de Regresión
- Verificación manual: en `/matricula` paso 1, dejar género sin seleccionar y presionar "Continuar" →
  debe aparecer mensaje de error bajo el radiogroup y no debe avanzar de paso.
