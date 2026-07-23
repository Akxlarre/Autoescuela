# Fix: Registrar Pago con monto excesivo falla en silencio
> id: fix-057-m-registrar-pago-monto-excesivo-silencioso
> refs: ASG-013
> status: in_progress
> created: 2026-07-23

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
[Heredado de ASG-013, a confirmar]: Al registrar un pago con monto mayor al saldo pendiente (ej. $200.000 sobre una deuda de $90.000), el botón "Guardar Pago" queda habilitado (solo valida que el desglose sume el total declarado, no contra el saldo real) y al hacer click no pasa absolutamente nada — sin toast de error, sin mensaje, el drawer queda abierto. Confirmado con inspección de red: solo se disparan GETs de refresco, cero request de escritura. El dato NO se corrompe (no se guarda), pero la secretaria no tiene ninguna señal de que su acción falló. Probablemente el backend rechaza el insert (constraint de BD o RLS) pero ese error nunca se propaga al `catch` del facade.

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
- Ninguno — fix autónomo (hallazgo de QA manual, H-024 en `indices/FLOWS-QA-AUDIT.md`)

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `src/app/features/admin/pagos/registrar-pago-drawer.component.ts` (o el drawer de registrar pago equivalente)
- **Qué cambia:** agregar validación client-side previa al submit (monto total vs saldo pendiente) con feedback visible, e investigar por qué el error del backend no se propaga al facade para exponerlo como error manejable.

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- Pendiente de definir tras investigar la causa raíz exacta (client-side vs backend).
