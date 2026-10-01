# Asignación ASG-i-050 — Matrícula queda activa aunque el mensaje dice "no se confirmó"

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

**Sospecha no confirmada en vivo** (tanda de testing 2026-09-29). `confirmEnrollment()` pasa la
matrícula a `active` y le asigna número **antes** de registrar el consentimiento (Ley 21.719). Si
el registro del consentimiento falla, muestra "No se pudo registrar el consentimiento… La
matrícula no se confirmó" y corta, pero la matrícula ya quedó activa con sus clases en `reserved`
(invisibles en la agenda). Si la secretaria reintenta, se asigna otro número
(`enrollment.facade.ts:1414-1443`).

Relacionado (🟠): el consentimiento promocional se registra aunque nadie lo marque, porque el
`reset` del wizard no lo limpia (`enrollment.facade.ts:2054-2077`).

## Alcance sugerido

- **Paso 1, confirmar**: forzar el fallo del consentimiento (p. ej. bloqueando la petición en
  DevTools → Network → "Block request URL") en una matrícula de prueba y revisar el estado.
- Registrar el consentimiento antes de confirmar, o hacer ambas cosas en una misma transacción
  (idealmente dentro de la RPC de confirmación).
- Limpiar el consentimiento promocional en el `reset` y registrarlo solo si se marcó.

## Referencias

- `specs/testing-piloto/023-matricula-presencial.md` S2, S5
- Specs `0009-m` y `0010-m` (consentimientos)

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/enrollment.facade.ts`

## Notas para quien la reclame

- Solapa con `ASG-i-047` si se mueve la lógica dentro de `confirm_enrollment_with_payment`.
