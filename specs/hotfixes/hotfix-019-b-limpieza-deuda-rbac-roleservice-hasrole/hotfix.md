# Hotfix: Limpieza de deuda RBAC — RoleService muerto, HasRoleDirective sin uso, comentarios stale, doc rol×módulo
> id: hotfix-019-b-limpieza-deuda-rbac-roleservice-hasrole
> status: done
> closed: 2026-07-06
> created: 2026-07-05

## Problema
Auditoría RBAC detectó 4 deudas menores: (1) `RoleService` es un dev-utility muerto que lee el rol de sessionStorage con default `'admin'` — nadie lo inyecta pero es peligroso si alguien lo usa por error; (2) `HasRoleDirective` (`*appHasRole`) no se usa en ningún template (los portales son exclusivos por rol); (3) comentarios stale que referencian RoleService y un "selector de rol de desarrollo" que ya no existe; (4) no hay documento que consolide la nomenclatura dual de roles (BD `secretary`/`student` ↔ frontend `secretaria`/`alumno`) ni la matriz rol×módulo de las RLS.

## Cambios
- **Archivo:** `src/app/core/services/auth/role.service.ts` — ELIMINAR (dev utility muerto, default 'admin' en sessionStorage)
- **Archivo:** `src/app/core/services/auth/role.service.spec.ts` — ELIMINAR (spec del servicio eliminado)
- **Archivo:** `src/app/core/directives/has-role.directive.ts` — ELIMINAR (0 usos en templates; recuperable de git si aparecen vistas compartidas entre roles)
- **Archivo:** `src/app/core/directives/has-role.README.md` — ELIMINAR (doc de la directiva eliminada)
- **Archivo:** `src/app/core/auth/index.ts` — quitar export y mención de HasRoleDirective
- **Archivo:** `src/app/core/auth/README.md` — quitar filas/secciones de HasRoleDirective
- **Archivo:** `src/app/layout/topbar.component.ts` — corregir comentario stale (líneas 36 y 44: RoleService y "selector de rol")
- **Archivo:** `src/app/core/services/auth/menu-config.service.ts` — corregir comentario stale (línea 23: RoleService → AuthFacade)
- **Archivo:** `docs/RBAC.md` — CREAR: modelo de roles, mapeo de nomenclatura BD↔frontend, matriz rol×módulo derivada de las RLS
- **Archivo:** `indices/SERVICES.md` — quitar filas de RoleService
- **Archivo:** `indices/DIRECTIVES.md` — quitar filas de HasRoleDirective
- **Archivo:** `indices/USAGE-MAP.md` — regenerar vía `npm run indices:sync`
