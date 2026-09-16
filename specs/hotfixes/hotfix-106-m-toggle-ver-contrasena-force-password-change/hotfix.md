# Hotfix: Falta toggle de ver/ocultar contraseña en "Actualiza tu contraseña"

> id: hotfix-106-m
> refs: —
> status: done
> closed: 2026-09-16
> created: 2026-09-15

## Problema

El input de "Nueva Contraseña" en `force-password-change.component.ts` (pantalla que ve el
alumno tras activar su cuenta) es `type="password"` fijo, sin botón para revelar el texto
mientras la escribe — a diferencia de `login-card.component.ts`, que ya tiene ese toggle
(`showPassword` signal + botón con `app-icon eye/eye-off`).

## Cambios

- **Archivo:** `src/app/features/auth/force-password-change/force-password-change.component.ts`
  — Agrega `showPassword` signal + `togglePasswordVisibility()`, cambia el input a
  `[type]="showPassword() ? 'text' : 'password'"` y agrega el botón de toggle dentro de un
  wrapper relativo, replicando exactamente el markup/estilos del mismo patrón en
  `login-card.component.ts`.
