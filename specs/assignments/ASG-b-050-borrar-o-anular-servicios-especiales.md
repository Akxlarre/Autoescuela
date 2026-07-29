# Asignación ASG-b-050 — Poder borrar (¿o anular?) Servicios Especiales

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P3
> **created:** 2026-07-28
> **created_by:** b

---

## Contexto / Objetivo

Anotación de la reunión (2026-07-28):

> *"Falta poder borrar Servicios Especiales."*

## Hallazgo — no falta permiso, falta el botón

La policy **`delete_special_service_sales` ya existe** y permite DELETE a `admin` y `secretary`
(`indices/DATABASE.md`). O sea: la base de datos ya lo permite, lo que falta es la acción en la
interfaz. No hay que tocar RLS ni migrar nada.

## ⚠️ Pregunta abierta — no asumir "delete"

`special_service_sales` **es una venta**: tiene `price`, `paid` (boolean) y `status`
(`pending`/`completed`). Borrar una venta **ya pagada** es eliminar un registro financiero, y
esa plata ya entró a la caja del día.

Antes de implementar, confirmar con el cliente:

1. **¿Borrar o anular?** Lo recomendado es **anular** (marcar con un estado, conservando la
   fila) cuando la venta está pagada, y permitir **borrar** solo si nunca se pagó —
   típicamente una carga hecha por error hace 5 minutos.
2. Si se borra una venta pagada, **¿qué pasa con la cuadratura del día en que se cobró?**
   Es el mismo problema que ASG-b-037: la cuadratura guarda `total_expenses`/ingresos como
   snapshot. Borrar hacia atrás la descuadra en silencio.

Si el cliente confirma que quiere borrado duro y sin condiciones, se hace — pero que quede
registrado que fue una decisión informada.

## Alcance sugerido

- Acción de borrar/anular en la vista de Servicios Especiales, con confirmación
  (`ConfirmModalService` ya existe — usarlo, no inventar un modal).
- Comportamiento condicional según `paid`, si el cliente valida la recomendación.

## Referencias

- `indices/DATABASE.md` → `special_service_sales` (RLS completa admin/secretaria)
- `src/app/core/facades/servicios-especiales.facade.ts`

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/servicios-especiales.facade.ts`
- Feature de servicios especiales

## Notas para quien la reclame

- ⚠️ Tocando el mismo nervio que **ASG-b-037** (¿se puede modificar el pasado financiero?). Si el
  cliente ya respondió esa pregunta para la cuadratura, **aplicar el mismo criterio acá** — no
  tener dos políticas distintas de trazabilidad en el mismo sistema.
