# Fix: Aislamiento por sede de la secretaria en facades heredadas de admin
> id: fix-027-b-aislamiento-sede-secretaria
> refs: indices/SECRETARIA-AUDIT.md, fix-002-regresion-instructores-desaparecen-sin-branch-filter
> status: done
> created: 2026-06-24
> closed: 2026-06-24

## Root Cause

El scope de sede de la secretaria se maneja en el **query layer** (PostgREST), NO en RLS
(decisión documentada en migración `20260522000001` y en fix-002: `select_users` deja ver
todos los usuarios a propósito, para que el selector de destinatarios de Tareas funcione).

Pero un grupo de facades heredadas de admin lee `branchFacade.selectedBranchId()` **directo**,
sin el fallback a `user.branchId`. Como el selector de sede del topbar es solo-admin, para la
secretaria ese valor es `null` salvo paso incidental por el wizard de matrícula → `if (branchId
!== null)` se salta → la query no filtra por sede. Si además la RLS de la tabla raíz no ancla
por sede para `secretary`, se filtran datos de otras sedes.

- `students` y `instructors`: RLS = `auth_user_role() IN ('admin','secretary')` **sin**
  `branch_visible` → **fuga real de PII** (Base Alumnos B e Instructores).
- `enrollments`: RLS = `secretary AND branch_visible(branch_id)` → hoy tapa la fuga en las
  vistas profesional/archivo/certificación, pero el frontend igual debería filtrar
  (consistencia + defensa en profundidad).

El patrón correcto ya existe en 11 facades (`getActiveBranchId()`:
`if admin → selectedBranchId(); else → user.branchId`). Falta aplicarlo a las heredadas.

**Restricción:** NO tocar la RLS de `users` (reintroduce la regresión de fix-002). El fix es
puramente query-layer. El filtro de Instructores va sobre `users.branch_id` en el listado, sin
afectar `TasksFacade.loadRecipients`.

## Forward-compatibility (NO es un techo)

El default de **1 sede por secretaria** es intencional y **seguro**, no una limitación
definitiva. La regla de negocio "un admin dueño de 2 sedes puede otorgar a una secretaria
visibilidad de ambas" es válida y se monta **encima** de este fix sin retrabajo: solo añade un
"OR todas/subconjunto" al mismo helper `getActiveBranchId()`. Ese permiso es una **feature con
cambio de modelo de datos** → vive en spec aparte, NO en este fix.

Decisión clave que este fix preserva: `branch_id` null **sin** grant explícito = misconfig →
sin datos (guard defensivo). NUNCA reusar `branch_id = null` como señal de "acceso total",
porque confunde "permiso deliberado" con "mal configurado" = exposición accidental.
Ver spec de multi-sede (flag `can_view_all_branches`).

## ACs Afectados

Ninguno — fix autónomo (deuda de seguridad detectada en auditoría, sin spec original).

Criterio nuevo del fix:
- **AC-F27-1:** Una secretaria de la Sede A NO ve alumnos de la Sede B en Base Alumnos B.
- **AC-F27-2:** Una secretaria de la Sede A NO ve instructores de la Sede B en Instructores.
- **AC-F27-3:** `export-students` invocado por secretaria exporta solo su sede (no `branch_id: null`).
- **AC-F27-4:** Las facades profesional/archivo/certificación filtran por la sede de la
  secretaria también desde el query layer (no dependen solo de RLS).
- **AC-F27-5:** El selector de destinatarios de Tareas sigue mostrando admins + instructores
  (no se reintroduce la regresión de fix-002).

## Cambio

Aplicar el helper `getActiveBranchId()` (patrón existente) y reemplazar las lecturas directas
de `selectedBranchId()` en:

- **`core/facades/admin-alumnos.facade.ts`** — `initialize`/`refreshSilently`/`fetchAlumnosData`
  y el body de `export-students` (`branch_id`). **(fuga real)**
- **`core/facades/instructores.facade.ts`** — `initialize`/`fetchData` (filtra `users.branch_id`). **(fuga real)**
- **`core/facades/admin-alumnos-profesional.facade.ts`** — consistencia/defensa.
- **`core/facades/archivo-profesional.facade.ts`** — consistencia/defensa.
- **`core/facades/certificacion-clase-b.facade.ts`** — consistencia/defensa.
- **`core/facades/certificacion-profesional.facade.ts`** — consistencia/defensa.

## Implementación (2026-06-24)

Núcleo funcional extraído a `core/utils/branch-scope.utils.ts` (`resolveBranchScope` +
`NO_BRANCH_SCOPE = -1`). Las 6 facades lo consumen vía un `getActiveBranchId()` delgado.
Misconfig (secretaria sin `branchId`) → centinela `-1` → 0 filas (nunca "todas").

## Test de Regresión

- `core/utils/branch-scope.utils.spec.ts` — 9/9 ✓ (admin/secretaria/misconfig/otros roles)
- `core/facades/admin-alumnos.facade.spec.ts` — secretaria filtra por su branchId; misconfig→-1;
  admin null→sin filtro ✓
- `core/facades/instructores.facade.spec.ts` — íd. sobre `users.branch_id` ✓
- `core/facades/admin-alumnos-profesional.facade.spec.ts` — secretaria→branchId; misconfig→-1 ✓
- `core/facades/certificacion-profesional.facade.spec.ts` — construye con AuthFacade mockeado;
  tests stale de placeholder corregidos en **hotfix-016** ✓
- `ng build` development — limpio ✓
- **Verificación runtime PENDIENTE** (deuda QA manual, como otros fixes del ROADMAP): login como
  secretaria multi-sede + `/verify` que Base Alumnos B e Instructores no muestren otra sede.
