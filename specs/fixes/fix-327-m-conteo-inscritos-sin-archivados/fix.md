# Fix: El conteo de inscritos de una promoción incluye a personas archivadas
> id: fix-327-m-conteo-inscritos-sin-archivados
> refs: fix-319-m-testing-clase-profesional-piloto (S19, G09, P04, D9) · ASG-i-025
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Root Cause
"Ver promoción" cuenta como inscrita toda matrícula que no sea `cancelled` ni `draft`
(`promociones.facade.ts:131-135,170-180`). Archivar es un estado de la persona
(`students.status = 'archived'`) que no cambia la matrícula, así que una persona archivada sigue
contando.

Decisión D9 (Matías, 2026-10-05): **completados siguen en el Libro y cuentan; archivados siguen en
el Libro (sin columna de estado: registro oficial, réplica del libro físico) pero no cuentan como
inscritos.** El Libro de clases no cambia.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- **`src/app/core/facades/promociones.facade.ts`** — el conteo de inscritos (total y por curso)
  excluye matrículas cuyo alumno está `archived`.
- Libro de clases (pantalla y PDF): sin cambios.

## Test de Regresión
- Spec del facade: una matrícula `active` de un alumno `archived` no suma al conteo; una
  `completed` sí.

**Verificado el 2026-10-05:** `promociones.facade.spec.ts` (caso nuevo: activa + completada cuentan,
activa de persona archivada no → 2) y specs de Promociones/Archivo, 52/52; `tsc` sin errores. Por
API (solo lectura) la consulta nueva (`students!inner(status)`, `status in (active, completed)`)
responde sin error con RLS para admin y `secretaria2@test.com`. El conteo se calcula en
`fetchEnrolledCounts()`, que usan tanto la lista de Promociones como el detalle de Archivo.
Libro de clases sin cambios.
