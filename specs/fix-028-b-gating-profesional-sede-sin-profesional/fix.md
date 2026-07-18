# Fix: Gating de Clase Profesional inconsistente (sede sin profesional + hack de grant)
> id: fix-028-b-gating-profesional-sede-sin-profesional
> refs: 0017-secretaria-multi-sede-grant-admin (RF-013)
> status: done
> closed: 2026-06-25
> created: 2026-06-25

## Root Cause
El gating de "Clase Profesional" (impedir operar en una sede sin `has_professional`)
existe pero **no se aplicó de forma consistente**, y la autorización multisede de la
secretaria quedó en un **placeholder pre-0017**:

1. **Páginas profesionales sin `setProfessionalOnly`**: 7 páginas admin llaman
   `branchFacade.setProfessionalOnly(true)` en `ngOnInit` (auto-selecciona una sede
   profesional y deshabilita "Todas"/sedes sin profesional en el selector). Pero
   **3 admin** (Base Alumnos Prof, Pre-inscritos, Ex-Alumnos Prof) y **las 9 de
   secretaría** NO lo hacen → estando en ellas se puede cambiar el selector a una sede
   sin profesional (o "Todas") y quedar en una vista vacía sin bloqueo.

2. **Hack de autorización en el sidebar** (`sidebar.component.ts` `onItemClick`): la
   "autorización multisede (RF-013)" de la secretaria se simula con
   `email.includes('multisede') || email.includes('autorizada')`. Ahora que el grant
   real `users.can_access_both_branches` existe y está desplegado (spec 0017), ese hack
   está obsoleto y es incorrecto.

3. **`hasProfessional()` ignora el grant** (`sidebar.component.ts`): para la secretaria
   usa `currentUser().branchId` (sede fija), no el selector. Una secretaria con grant que
   selecciona una sede profesional igual ve el módulo bloqueado.

4. **Emojis en modales** (`onItemClick`): `🔒` en los títulos de los `confirm`, prohibidos
   por el DS (regla de íconos Lucide).

## ACs Afectados
- **Spec 0017 / RF-013**: completa el grant — la "autorización multisede" deja de mirar el
  email y usa `canAccessBothBranches` real. Una secretaria con grant se comporta como admin
  también para el gating profesional (principio rector de 0017).
- Gating profesional (sin AC formal previo): "estando en una página profesional no se puede
  quedar en una sede sin `has_professional`".

## Cambio
- **`features/admin/alumnos-profesional/admin-alumnos-profesional.component.ts`**: `setProfessionalOnly(true)` en init, `(false)` en destroy.
- **`features/admin/alumnos/pre-inscritos/admin-pre-inscritos.component.ts`**: ídem.
- **`features/admin/ex-alumnos-profesional/admin-ex-alumnos-profesional.component.ts`**: ídem.
- **`features/secretaria/**` (9 páginas profesionales)**: aplicar el gate cuando corresponda (secretaria con grant tiene selector como admin).
- **`layout/sidebar.component.ts`**:
  - `hasProfessional()` → rama secretaria honra el grant (usa el selector cuando `canAccessBothBranches`).
  - `onItemClick()` → reemplazar `email.includes('multisede')` por `currentUser()?.canAccessBothBranches`.
  - Quitar emojis `🔒` de los modales (usar texto/`app-icon`).

## Test de Regresión
- Extraer la decisión de gating a una función pura testeable (`core/utils`), p. ej.
  `canAccessProfessional(role, selectedBranchId, userBranchId, branches, canAccessBothBranches) → boolean`,
  y cubrir: admin "Todas"→true; admin sede sin prof→false; secretaria sin grant en sede sin prof→false;
  secretaria con grant + sede prof seleccionada→true. `<util>.spec.ts` verde.
- `ng build` limpio + `/verify`: con sede sin profesional, las páginas profesionales no quedan en vista vacía.
