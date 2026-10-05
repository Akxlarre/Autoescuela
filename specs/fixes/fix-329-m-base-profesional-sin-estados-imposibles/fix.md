# Fix: La Base Profesional ofrece estados que en Clase Profesional no pueden existir
> id: fix-329-m-base-profesional-sin-estados-imposibles
> refs: fix-319-m-testing-clase-profesional-piloto (S10, B02, E07, D2) · ASG-i-025
> status: in_progress
> created: 2026-10-05

## Root Cause
La Base Profesional trae matrículas `active`/`inactive` (`ENROLLED_STATUSES`,
`admin-alumnos-profesional.facade.ts:53`), traduce `inactive` → "Inactivo" y `cancelled` →
"Retirado" (`:403-406`), y ofrece el filtro "Retirado"
(`alumnos-profesional-list-content.component.ts:428-432`). Pero ningún flujo deja una matrícula
Profesional en `inactive`, `withdrawn` ni `cancelled`: lo único que cambia una matrícula activa es
el trigger que la pasa a `completed` al finalizar la promoción; los que escriben `cancelled`
(deserción por inasistencias, vencimiento del pago online) son de Clase B. El filtro "Retirado"
siempre queda vacío.

Decisión D2 (Matías, 2026-10-05): **los filtros y estados que nunca pueden existir se eliminan.**
Cuando se modele al desertor de Clase Profesional se define dónde se ve.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- **`src/app/core/facades/admin-alumnos-profesional.facade.ts`** — `ENROLLED_STATUSES = ['active']`;
  quitar las traducciones `inactive`/`cancelled`.
- **`src/app/shared/components/alumnos-profesional-list-content/alumnos-profesional-list-content.component.ts`**
  — quitar el filtro "Retirado" (y el de Estado si queda con una sola opción) y la variante
  "Inactivo" del badge.
- Revisar `core/models/ui/` por el tipo de estado de la fila.

## Test de Regresión
- Spec del facade: solo consulta `active`.
- E2E: el filtro de estado no ofrece "Retirado".
