# Fix: El conteo de inscritos de una promoción incluye a personas archivadas
> id: fix-327-m-conteo-inscritos-sin-archivados
> refs: fix-319-m-testing-clase-profesional-piloto (S19, G09, P04, D9) · ASG-i-025
> status: in_progress
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
