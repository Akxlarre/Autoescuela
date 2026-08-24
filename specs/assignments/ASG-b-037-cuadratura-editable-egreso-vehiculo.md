# Asignación ASG-b-037 — Cuadratura editable + egresos de combustible por vehículo

> **status:** completada
> **owner:** i
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-07-28
> **created_by:** b
> **claimed_by:** i
> **claimed_at:** 2026-08-05
> **resulting_track:** 0002-i-cuadratura-editable-ajustes

---

## Contexto / Objetivo

Agrupa 2 anotaciones de la reunión (2026-07-28) que chocan con **la misma pared técnica**:

1. *"Ver alguna manera de registrar por ej los egresos de combustible para un vehículo en otra
   vista y que aparezca luego automáticamente en la vista de Cuadratura."*
2. *"Que admin pueda editar una cuadratura pasada."*

### Hallazgo verificado en código

- **`src/app/core/facades/cuadratura.facade.ts:289`** consulta los egresos con
  `.eq('date', today)` — **hardcodeado a hoy**. Un egreso con fecha pasada **nunca** aparece
  en la cuadratura de ese día.
- **Línea 463** guarda `total_expenses` como **snapshot** al momento de cerrar. No se recalcula.
- La tabla `expenses` **no tiene `vehicle_id`** → registrar combustible por vehículo requiere
  migración (columna FK nullable → `vehicles.id`).

Por eso las dos anotaciones son una: "que aparezca automáticamente en Cuadratura" solo funciona
para el día en curso. En cuanto el egreso lleva fecha pasada, estamos en el caso 2.

### El punto que hay que discutir, no asumir

La cuadratura **no es un reporte, es un arqueo físico**: la tabla guarda `qty_bill_20000`,
`qty_bill_10000`, `qty_bill_5000`, etc. Es una constatación de "esto es lo que había en la caja
ese día". Sobrescribirla borra la evidencia del descuadre, que es justamente lo que la
cuadratura existe para detectar.

## Respuesta del cliente (2026-08-02)

Opción **(a) Ajuste posterior con motivo** — confirmado. La cuadratura cerrada queda inmutable;
editar es registrar un ajuste con monto, motivo y autor. El total vigente = original + ajustes.
Esto resuelve de paso el caso del egreso con fecha pasada.

## Alcance sugerido

- Migración: `expenses.vehicle_id` (FK nullable → `vehicles.id`).
- Vista de registro de egreso de combustible asociada al vehículo (probablemente desde Flota).
- Migración: tabla de ajustes de cuadratura (monto, motivo, autor, fecha, `cuadratura_id`).
- Cuadratura deja de estar clavada a `today` para poder reflejar egresos con fecha anterior vía
  ajuste posterior.

## Referencias

- `src/app/core/facades/cuadratura.facade.ts:289` (query clavada a hoy), `:463` (snapshot)
- `indices/DATABASE.md` → tabla `expenses` (ya tiene `category`, `description`, `amount`,
  `date`, `receipt_url`, `branch_id`), tabla de cuadratura con arqueo de billetes/monedas
- RLS de `expenses`: admin + secretaria de su propia sede, CRUD completo

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/cuadratura.facade.ts`
- `src/app/core/facades/flota.facade.ts`
- `supabase/migrations/` (migración nueva)

## Notas para quien la reclame

- ⚠️ **Se solapa con ASG-b-039** (botón de registrar egreso en el dashboard), que es la parte
  desbloqueada del mismo tema. Coordinar para no duplicar el formulario de egreso: conviene
  que ASG-b-039 cree el componente reutilizable y esta asignación lo consuma.
- `fixed_expenses` es **solo admin** (RLS), `expenses` es admin + secretaria de su sede. El
  combustible va en `expenses`, no en `fixed_expenses`.
