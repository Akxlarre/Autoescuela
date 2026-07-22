# Asignación ASG-013 — Fix H-024: Registrar Pago con monto excesivo falla en silencio

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Al registrar un pago con monto mayor al saldo pendiente (ej. $200.000 sobre una deuda de $90.000), el botón "Guardar Pago" queda habilitado (solo valida que el desglose sume el total declarado, no contra el saldo real) y al hacer click no pasa absolutamente nada — sin toast de error, sin mensaje, el drawer queda abierto. Confirmado con inspección de red: solo se disparan GETs de refresco, cero request de escritura. El dato NO se corrompe (no se guarda), pero la secretaria no tiene ninguna señal de que su acción falló.

## Alcance sugerido

- Agregar validación client-side ANTES de intentar guardar: si `montoTotal > saldoPendiente`, mostrar un mensaje claro (toast o inline) en vez de dejar que el submit falle silenciosamente.
- Investigar también por qué el backend rechaza el insert sin devolver un error visible a la UI — probablemente una constraint de BD o RLS que sí bloquea correctamente, pero cuyo error nunca se propaga al `catch` del facade.
- Archivo probable: drawer de registrar pago en `admin/pagos` (`admin-pagos.component.ts` y su drawer asociado).

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-024 — reproducido 2 veces con el mismo resultado, incluye verificación de que no hay corrupción de datos.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/features/admin/pagos/admin-pagos.component.ts`
- `src/app/features/admin/pagos/registrar-pago-drawer.component.ts`

## Notas para quien la reclame

- Nota positiva ya confirmada: el sistema SÍ previene el saldo negativo — el problema es exclusivamente la ausencia de feedback, no la integridad de datos.
