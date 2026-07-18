# Fix: Migrar badge de rol a app-badge — ajustes-drawer
> id: fix-039-b-migrar-pills-ajustes-drawer
> refs: fix-036-app-badge-fuente-unica, fix-038-app-badge-variant-brand
> status: done
> closed: 2026-07-08
> created: 2026-07-08

## Root Cause
Segundo lote de la migración de pills ad-hoc del baseline ARCH-15 (fase 4,
`docs/BACKLOG-DEUDA-TECNICA.md`) hacia `<app-badge>`. `ajustes-drawer.component.ts` tiene
4 pills (baseline) que en realidad son **4 ramas mutuamente excluyentes de un solo badge**
de rol (`@if (currentUser()?.role === 'admin')` / `'secretaria'` / `'instructor'` /
`'alumno'` — solo una se renderiza). Admin usaba `text-brand`/`bg-brand-muted`/`border-brand`
(bloqueado hasta fix-038); las otras 3 usaban gris genérico idéntico entre sí
(`text-text-secondary`/`bg-base`/`border-border-default`).

El chip de email (mismo bloque, líneas 117-122) NO está en el baseline ARCH-15 de este
archivo — su `text-xs` vive en un `<span>` interno, no en el mismo atributo `class` que
`rounded-full`, así que el heurístico de ARCH-15 no lo cuenta. No es un indicador de
rol/estado (es solo un contenedor de contacto) — queda fuera de scope, sin cambios.

## ACs Afectados
Ninguno — fix autónomo (fase 4 del roadmap, segundo lote de migración).

- AC-1: Los 4 `@if` de rol se colapsan en un único `<app-badge [variant]="roleBadgeVariant()">`
  con ícono y label derivados del rol (`roleBadgeIcon()`, `roleBadgeLabel()`), sin cambiar
  el comportamiento visual (mismo ícono/texto por rol que antes).
- AC-2: `variant` es `'brand'` para admin, `'neutral'` para el resto.
- AC-3: `npm run lint:arch` sin regresión ARCH-15 en este archivo (baseline baja de 4 a 0).
- AC-4: Verificación visual: el badge renderiza igual que antes para cada rol (colores,
  ícono, texto), probado con el usuario admin real de la sesión.

## Cambio
- **Archivo:** `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts`
  — 4 `@if` de rol → 1 `<app-badge>`, import del componente, 3 computed helpers de
  variant/ícono/label.

## Test de Regresión (ejecutado — todo verde)
- 0 clases muertas (ARCH-11), ícono `user` (fallback) confirmado registrado en
  `app.config.ts` (ARCH-14) ✅
- `npm run lint:arch` → exit 0; único hallazgo es ARCH-09 (complejidad, pre-existente,
  no regresión) ✅; baseline ARCH-15 consolidado **115 → 111** (los 4 de este archivo) ✅ (AC-3)
- `ng build` → exit 0 ✅
- Playwright con el **usuario admin real de la sesión** (clic Perfil → Ajustes): badge
  "Administrador" renderiza con `variant="brand"` → `bg rgba(56,189,248,0.15)` /
  `color rgb(56,189,248)` (sky-400), radio `9999px` — igual que el pill original.
  Consola: 0 errores. Captura: `fix039-ajustes-drawer-role-badge.png` (.playwright-mcp) ✅
  (AC-1, AC-2, AC-4). Los otros 3 roles (secretaria/instructor/alumno) comparten la misma
  rama de código (`variant="neutral"`, solo cambia ícono/label) — no requieren verificación
  visual separada, es la misma lógica ya confirmada.
