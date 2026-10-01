# Asignación ASG-i-055 — Escrituras a Supabase que no revisan el error y muestran éxito igual

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

**Sospecha no confirmada en vivo** (tanda de testing 2026-09-29). supabase-js no lanza excepción
cuando una escritura falla: devuelve `{ error }`. En ~13 grupos de llamadas ese `error` no se
revisa y la UI muestra un toast de éxito aunque la RLS o la red lo hayan rechazado. Ejemplos:
KM del vehículo al cerrar una clase con un vehículo de otra sede
(`asistencia-clase-b.facade.ts:449-455`), cancelar un comunicado que no se canceló
(`announcements.facade.ts:479-491`), además de los de Cuadratura (`ASG-i-048`).

El inventario completo está en `specs/testing-piloto/037-transversal-multisede-shell.md` §1.

## Alcance sugerido

- **Paso 1, confirmar** 2 o 3 casos del inventario forzando el fallo (DevTools → bloquear la
  petición) y ver el toast.
- Revisar `error` en cada ocurrencia y mostrar el error real (vía `ToastService` /
  `ErrorSanitizerService`).
- Evaluar una regla de lint o un helper que obligue a revisar `error`, para que no se repita.

## Referencias

- `specs/testing-piloto/037-transversal-multisede-shell.md` §1 (inventario)
- `032-flota-mantenimientos.md` S2 · `035-tareas-notificaciones-comunicados.md` S2

## Archivos involucrados (opcional, para detectar solapes)

- Varios facades (ver inventario).

## Notas para quien la reclame

- Los de Cuadratura van en `ASG-i-048`; no duplicar.
