# Fix: Auditoría — módulos que faltan en el filtro y sede de la acción
> id: fix-487-m-auditoria-modulos-y-sede-de-la-accion
> refs: ASG-i-036
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause

El mapa tabla → módulo de Auditoría existe dos veces: en la app (`audit-log-row.model.ts`) y
copiado a mano dentro de `generate-audit-report`. Las dos copias divergieron:

- En la app, "Ciclos Teóricos" está mapeado pero no está en el filtro, y "Otros" lo excluye:
  193 registros que ningún filtro deja ver (S11). Tampoco tienen módulo `website_config`,
  `special_service_sales`, `standalone_course_enrollments` ni `professional_pre_registrations`:
  salen con el nombre crudo de la tabla.
- En la exportación faltan "Instructores", "Liquidaciones" y la habilitación de pagos
  (`enrollment_payment_overrides`), y los ciclos teóricos figuran como "Agenda". Exportar con
  filtro "Instructores" no filtraba nada (lista de entidades vacía → sin filtro).

Aparte, con "Quién = Secretarias" el filtro y la columna Sede usaban la sede de la secretaria
(`users.branch_id`) y no la de la acción (`audit_log.branch_id`), como el resto de opciones (S7).
Decisión D4 de `fix-485-m`: el registro es de la sede de la acción.

## ACs Afectados

- Ninguno de spec — hallazgos S7/S11 del testing `fix-485-m`.

## Cambio

- **`supabase/functions/_shared/audit-modules.ts` (nuevo):** el mapa y las opciones de módulo,
  copia espejo del de la app; `generate-audit-report` lo importa en vez de su copia propia.
- **`core/models/ui/audit-log-row.model.ts`:** módulos "Ciclos Teóricos", "Sitio Web",
  "Servicios Especiales" y "Cursos Singulares" en el mapa y en el filtro; pre-inscripciones →
  "Clase Profesional".
- **`core/utils/audit-actor.utils.ts` y `generate-audit-report`:** "Secretarias" filtra por
  `audit_log.branch_id`.
- **`core/facades/auditoria.facade.ts`:** la columna Sede muestra la sede de la acción.

## Test de Regresión

- `core/models/ui/audit-modules.parity.spec.ts` (las dos copias del mapa son iguales) ✓
- `core/utils/audit-actor.utils.spec.ts > Secretarias filtra por la sede de la acción` ✓
- `core/facades/auditoria.facade.spec.ts > fix-487-m` ✓
