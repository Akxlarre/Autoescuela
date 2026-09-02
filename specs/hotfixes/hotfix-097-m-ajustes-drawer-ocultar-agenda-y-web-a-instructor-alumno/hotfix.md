# Hotfix: Ocultar "Límite de Visualización de Agenda" y "Landing Pages en Caliente" a Instructor y Alumno
> id: hotfix-097-m-ajustes-drawer-ocultar-agenda-y-web-a-instructor-alumno
> refs: —
> status: done
> closed: 2026-09-02
> created: 2026-09-01

## Problema
En el drawer de Ajustes (tab "Ajustes"), las tarjetas "Límite de Visualización de Agenda"
y "Landing Pages en Caliente" se muestran a todos los roles, incluidos Instructor y Alumno.
Ninguna de las dos les corresponde: la primera es una configuración global de agendamiento
y la segunda navega a `/app/{role}/configuracion-web`, ruta que solo existe para admin y
secretaria (para instructor/alumno da 404).

## Cambios
- **Archivo:** `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts` — agregar
  computed `canManageSiteConfig` (role admin o secretaria) y envolver ambas tarjetas
  ("Límite de Visualización de Agenda" y "Landing Pages en Caliente") en `@if (canManageSiteConfig())`.
