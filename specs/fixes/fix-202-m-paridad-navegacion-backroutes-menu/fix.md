# Fix: Paridad de navegación admin/secretaria — backRoutes a rutas inexistentes e icono divergente
> id: fix-202-m-paridad-navegacion-backroutes-menu
> refs: —
> status: done
> closed: 2026-08-24
> created: 2026-08-24

## Root Cause
Constantes de navegación copiadas de un rol al otro sin ajustar el segmento de rol, y
componentes compartidos que **defaultean a un path de un rol concreto**, lo que oculta el
error hasta que alguien usa el botón:

1. `secretaria/alumnos-pre-inscritos` pasa `backRoute="/app/secretaria/clase-profesional/alumnos"`.
   El segmento `clase-profesional` solo existe bajo `admin`; en secretaria la ruta es
   `profesional/alumnos`. No matchea ningún hijo → cae en el wildcard `**` → NotFound.
2. `admin/servicios-especiales` pasa `backRoute="/app/dashboard"`, que no existe (el dashboard
   de admin es `/app/admin/dashboard`) → mismo 404.
3. La causa de fondo de (2): `servicios-especiales-content` declara
   `backRoute = input<string>('/app/dashboard')` — un default roto que cualquier consumidor
   futuro hereda en silencio. `ex-alumnos-profesional-content` tiene el mismo antipatrón con
   `input<string>('/app/admin/clase-profesional/alumnos')`: un path de admin como default de un
   componente compartido.
4. El ítem de menú "Evaluaciones" quedó con icono distinto por rol (`file-spreadsheet` en admin,
   `star` en secretaria). Decisión del dueño: el canon es el de admin.

## ACs Afectados
Ninguno — fix autónomo. Detectado en la auditoría de paridad admin/secretaria (2026-08-24).

## Cambio
- **Archivo:** `src/app/features/secretaria/alumnos-pre-inscritos/secretaria-alumnos-pre-inscritos.component.ts`
  **Qué cambia:** `backRoute` → `/app/secretaria/profesional/alumnos` (la ruta que existe).
- **Archivo:** `src/app/features/admin/servicios-especiales/admin-servicios-especiales.component.ts`
  **Qué cambia:** `backRoute` → `/app/admin/dashboard`.
- **Archivo:** `src/app/shared/components/servicios-especiales-content/servicios-especiales-content.component.ts`
  **Qué cambia:** `backRoute` pasa de `input<string>('/app/dashboard')` a `input.required<string>()`
  — elimina el default de rol. Los 2 únicos consumidores ya lo pasan.
- **Archivo:** `src/app/shared/components/ex-alumnos-profesional-content/ex-alumnos-profesional-content.component.ts`
  **Qué cambia:** `backRoute` pasa a `input.required<string>()` por la misma razón. Los 2
  consumidores ya lo pasan.
- **Archivo:** `src/app/core/services/auth/menu-config.service.ts`
  **Qué cambia:** icono de "Evaluaciones" en `SECRETARIA_NAV`: `star` → `file-spreadsheet`.

## Test de Regresión
- `npm run test:ci` verde (sin regresiones en los specs de los componentes tocados).
- Verificación manual: "Volver" en Pre-inscritos de secretaria y en Servicios Especiales de
  admin llegan a su listado/dashboard en vez de NotFound.

- ✅ **Verificado visualmente por el dueño en el navegador (2026-08-24).**
