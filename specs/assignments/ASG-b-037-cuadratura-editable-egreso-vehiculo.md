# Asignación ASG-b-037 — Cuadratura editable + egresos de combustible por vehículo

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-07-28
> **created_by:** b
> **bloqueada_por:** respuesta del cliente (ver "Preguntas abiertas")

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

## Preguntas abiertas (BLOQUEANTE — preguntar al cliente antes de codear)

1. **Cuando el admin edita una cuadratura ya cerrada, ¿qué pasa con el arqueo original?**
   - **(a) Ajuste posterior con motivo** — la cuadratura cerrada queda inmutable; editar es
     registrar un ajuste con monto, motivo y autor; el total vigente es original + ajustes.
     Resuelve de paso el caso del egreso con fecha pasada. Es la opción recomendada por
     trazabilidad, y la más cara.
   - **(b) Sobrescribir con bitácora de auditoría** — se edita el valor, se guarda
     quién/cuándo/qué cambió en una tabla aparte. Más simple de usar; el arqueo físico
     original deja de ser consultable desde la app.
   - **(c) Sobrescribir sin más** — lo más barato y probablemente lo que el cliente imagina al
     pedirlo, pero destruye la trazabilidad. **Solo tomar esta opción si el cliente confirma
     explícitamente que asume ese riesgo.**

   ⚠️ Plantearle al cliente el riesgo en estos términos: *"si alguien se equivoca o hay un
   faltante de caja, ¿quieren poder ver que la cifra cambió y por qué, o alcanza con la cifra
   corregida?"*

## Alcance sugerido

- Migración: `expenses.vehicle_id` (FK nullable → `vehicles.id`).
- Vista de registro de egreso de combustible asociada al vehículo (probablemente desde Flota).
- Según la respuesta a la pregunta: ajuste/bitácora/sobrescritura + que la Cuadratura deje de
  estar clavada a `today` para poder reflejar egresos con fecha anterior.

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
