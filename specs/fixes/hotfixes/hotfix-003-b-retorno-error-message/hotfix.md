# Hotfix: Error técnico expuesto al usuario en retorno Webpay
> id: hotfix-003-b-retorno-error-message
> status: done
> closed: 2026-06-04
> created: 2026-06-04

## Problema
La página `/inscripcion/retorno` muestra el mensaje crudo de infraestructura
"Edge Function returned a non-2xx status code" cuando la confirmación de pago falla.
El usuario ve jerga técnica en lugar de un mensaje de error amigable.

Además: el card de error está alineado a la izquierda (sin `min-h-dvh flex items-center
justify-center`) y no tiene el hero tematizado de la sede.

## Causa raíz
`PublicEnrollmentRetornoComponent` expone `facade.error()` directamente en el template.
`facade.error()` a su vez expone el mensaje raw de la Edge Function / Supabase sin sanitizar.

## Cambios
- **Archivo:** `src/app/features/public-enrollment/retorno/public-enrollment-retorno.component.ts`
  1. Función `sanitizeInfraError()` — detecta mensajes técnicos ("Edge Function", "non-2xx", "failed to fetch", etc.) y los reemplaza con texto amigable para el usuario. Usada en el `else` branch de `confirmPayment()`.
  2. Layout fix: outer wrapper usa `style="display: flex; min-height: 100dvh; width: 100%; align-items: center; justify-content: center;"` en vez de clases Tailwind `flex items-center justify-center` — las clases Tailwind eran anuladas por el `host: { style: 'display: block' }` de Angular (mayor especificidad CSS). Card ahora centrado vertical y horizontalmente.
  3. `host: { style: 'display: block;' }` agregado para que el host element sea block-level.
