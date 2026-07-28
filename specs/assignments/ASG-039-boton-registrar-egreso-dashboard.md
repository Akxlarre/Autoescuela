# Asignación ASG-039 — Botón "Registrar egreso" accesible + atajo para carga de combustible

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-28
> **created_by:** b

---

## Contexto / Objetivo

Anotación de la reunión (2026-07-28):

> *"Cuadratura: egresos usualmente puede ser carga de combustible. Dar una opción más accesible
> para ese egreso en particular. Agregar botón registrar egreso en dashboard."*

El cliente registra egresos a diario y casi siempre son lo mismo (combustible), pero hoy tiene
que entrar a Cuadratura para hacerlo. Pide un acceso directo desde el dashboard y que el caso
"combustible" sea de un clic.

## Alcance sugerido

- Botón "Registrar egreso" en el dashboard que abra el formulario de egreso (drawer/modal).
- El formulario debe traer **combustible preseleccionado** como categoría, ya que es el caso
  dominante — sin impedir elegir otra.
- **Extraer el formulario a un componente reutilizable** (ver nota de solape abajo).

## Referencias — esto NO necesita migración

`indices/DATABASE.md` → tabla `expenses` ya tiene todo lo necesario:
`category` (TEXT), `description`, `amount`, `date`, `receipt_url`, `branch_id`, `registered_by`.

RLS de `expenses`: **admin + secretaria de su propia sede**, CRUD completo. No hay que tocar
policies. (Ojo: `fixed_expenses` sí es solo-admin, pero el combustible no va ahí.)

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/cuadratura.facade.ts` (ya tiene el insert a `expenses`, línea ~381)
- Dashboard admin/secretaria

## Notas para quien la reclame

- ⚠️ **Se solapa con ASG-037** (cuadratura editable + egreso por vehículo), que está bloqueada
  esperando respuesta del cliente. Esta es la mitad desbloqueada del mismo tema.
  **Convenio: esta asignación crea el componente de formulario reutilizable, ASG-037 lo
  consume** y le agrega el `vehicle_id`. Si hacés el formulario cerrado, ASG-037 lo va a tener
  que reescribir.
- Respetar la regla 3-2-1 de marca: el dashboard ya tiene CTAs primarios, revisar que un botón
  más no rompa el presupuesto de color de marca por viewport.
