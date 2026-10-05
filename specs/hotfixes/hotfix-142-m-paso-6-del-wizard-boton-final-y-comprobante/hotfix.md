# Hotfix: Paso 6 del wizard — botón final y comprobante
> id: hotfix-142-m-paso-6-del-wizard-boton-final-y-comprobante
> refs: ASG-i-024, fix-307-m
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Problema
Dos detalles del último paso del wizard de matrícula, anotados al ejecutar `024a` O03:

- El botón final dice "Volver al inicio" con un ícono de casa. Desde `fix-307-m`, cuando el wizard
  está abierto como panel ese botón solo cierra el panel y deja al usuario en su pantalla: el
  texto promete algo que ya no ocurre.
- El botón "Comprobante de Pago" no hace nada (`onDownloadReceipt()` está vacío con un TODO) y
  aparece incluso con el pago pendiente.

**Decisión del owner (Matías, 2026-10-05):** quitar "Comprobante de Pago" sin dejar feo el
espacio. Para el botón final se propuso "Finalizar".

## Cambios
- **Archivos:** `src/app/shared/components/matricula-steps/confirmation/confirmation.component.*`
  — el botón final dice "Finalizar" (ícono de check), que vale tanto en panel como en página; se
  quita "Comprobante de Pago" y su salida; "Contrato Firmado" pasa a ocupar el ancho completo de
  esa franja.
- **Archivos:** `src/app/features/secretaria/matricula/secretaria-matricula.component.*` — se
  quita `onDownloadReceipt()`, que quedaba sin uso.

## Verificación
2026-10-05, en navegador a 1600 px con el wizard en panel: el Paso 6 muestra "Contrato Firmado" a todo el ancho de su franja (590 px) y el botón final "Finalizar"; ya no existe "Comprobante de Pago". Sin errores de compilación. El texto "Se ha enviado una copia del contrato al email del alumno" no se tocó acá: depende de que el envío exista (se trata aparte).
