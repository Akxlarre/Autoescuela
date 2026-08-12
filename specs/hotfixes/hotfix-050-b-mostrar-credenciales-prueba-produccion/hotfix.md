# Hotfix: Mostrar credenciales de prueba en el login también en producción
> id: hotfix-050-b-mostrar-credenciales-prueba-produccion
> status: done
> closed: 2026-08-12
> created: 2026-08-12

## Problema
El panel de "Credenciales de prueba" en `LoginComponent` está condicionado a
`isDevMode()`, por lo que no se renderiza en el build de producción. El proyecto
está desplegado en Vercel como demo para una postulación laboral y se necesita
que el panel se muestre siempre, sin importar el entorno.

## Cambios
- **Archivo:** `src/app/features/auth/login/login.component.ts` — quitar el gate
  `isDevMode()` del signal `devMode` (o renombrarlo/reemplazarlo) para que el
  bloque `@if` del panel de credenciales se muestre siempre, en dev y en
  producción.
