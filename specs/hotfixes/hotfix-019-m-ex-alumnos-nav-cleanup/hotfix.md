# Hotfix: navegación duplicada entre Base de Alumnos y Ex-Alumnos B

## Problema
1. `AlumnosListContentComponent` (Base de Alumnos, admin y secretaria comparten
   este dumb component vía `basePath`) tiene un botón de hero "Ex-Alumnos B" que
   navega a `${path}/ex-alumnos`. Es redundante: el sidebar ya tiene una entrada
   dedicada (`/app/admin/ex-alumnos` y `/app/secretaria/ex-alumnos`,
   `menu-config.service.ts:65,192`).
2. La vista Ex-Alumnos B (admin y secretaria) tiene un botón "← Alumnos" en el
   hero (`backRoute`/`backLabel`) que asumía que solo se llegaba ahí desde Base
   de Alumnos. Ahora que (1) se elimina, ya no se accede desde ahí — se accede
   directo desde el sidebar.

## Fix
1. Eliminar la acción `historial` de `heroActions` en
   `alumnos-list-content.component.ts:746-752`.
2. Eliminar `backRoute`/`backLabel` del `<app-section-hero>` en
   `admin-ex-alumnos.component.ts` y `secretaria-ex-alumnos.component.ts`.

## AC
- Base de Alumnos B (admin/secretaria) ya no muestra el botón "Ex-Alumnos B" en el hero.
- Ex-Alumnos B (admin/secretaria) ya no muestra el botón de volver "Alumnos" en el hero.

## Cierre
- Botón "Ex-Alumnos B" eliminado de `heroActions` en `alumnos-list-content.component.ts` (Base de Alumnos, admin y secretaria comparten el componente).
- `backRoute`/`backLabel` eliminados del hero en `admin-ex-alumnos.component.ts` y `secretaria-ex-alumnos.component.ts`.
- `tsc --noEmit` limpio.
