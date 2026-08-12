# Fix: Ocultar "Academia Profesional" en el sidebar cuando nunca es alcanzable
> id: fix-156-m-sidebar-ocultar-academia-profesional-sin-acceso
> refs: —
> status: done
> closed: 2026-08-12
> created: 2026-08-12

## Root Cause

`SidebarComponent` (`layout/sidebar.component.ts`) muestra el grupo completo "Academia
Profesional" (9 items) para **todo** admin/secretaria, marcando cada item con candado +
`opacity-50` cuando `hasProfessional()` es `false`. El candado tiene sentido cuando el usuario
**puede** desbloquearlo conmutando de sede (admin, o secretaria con grant
`canAccessBothBranches` — RF-013/spec 0017): el click ofrece conmutar.

Pero una secretaria **sin** grant, anclada a una sede sin Clase Profesional
(`hasProfessional: false` en su única sede), nunca puede conmutar — `canAccessProfessional()`
(`core/utils/professional-access.utils.ts`) siempre devuelve `false` para ella y el click solo
muestra "Acceso denegado, contacte a su Administrador". El candado es un callejón sin salida
permanente: 9 items inertes ocupando la mitad del sidebar sin ninguna acción posible detrás.

## ACs Afectados

Ninguno — fix de UX autónomo, sin spec previa que declare este comportamiento.

- AC-1: Secretaria sin grant en sede sin Clase Profesional → el grupo "Academia Profesional"
  (header + 9 items) no se renderiza en el sidebar.
- AC-2: Admin, o secretaria con grant `canAccessBothBranches`, siguen viendo el grupo con
  candado + flujo de conmutación de sede sin cambios (pueden desbloquearlo).
- AC-3: Secretaria sin grant cuya sede propia SÍ tiene Clase Profesional sigue viendo el grupo
  desbloqueado normalmente (sin cambios).

## Cambio

- **Archivo:** `src/app/core/utils/professional-access.utils.ts` — nuevas funciones puras
  (Núcleo Funcional, misma causa raíz que `canAccessProfessional`, testeables sin TestBed):
  `canUnlockProfessional(role, canAccessBothBranches)` (admin, o secretaria con grant) y
  `visibleNavGroups(groups, hasProfessional, canUnlock)` (filtra el grupo `'Academia
  Profesional'` cuando ni tiene acceso ni puede desbloquearlo).
- **Archivo:** `src/app/layout/sidebar.component.ts` — nuevos computed `canUnlockProfessional` y
  `visibleGroups` que envuelven las funciones de arriba con el estado de `AuthFacade`/
  `MenuConfigService`. El template itera `visibleGroups()` en vez de `menuConfig.menuItems()`
  directamente.

## Test de Regresión

- `core/utils/professional-access.utils.spec.ts` (extendido): `canUnlockProfessional` — admin
  siempre `true`, secretaria con grant `true`, secretaria sin grant `false`, otros roles
  `false`. `visibleNavGroups` — AC-1 (secretaria sin grant + sin acceso → oculta el grupo),
  AC-2 (puede desbloquear → conserva el grupo aunque no tenga acceso aún), AC-3 (ya tiene
  acceso → conserva el grupo). 18/18 tests verdes (`npx vitest run
  src/app/core/utils/professional-access.utils.spec.ts`). `npx tsc --noEmit`: sin errores en
  los archivos tocados.
