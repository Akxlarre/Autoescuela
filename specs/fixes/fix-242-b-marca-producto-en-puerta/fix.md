# Fix: la puerta de la app muestra la marca del producto y adentro la escuela de cada usuario
> id: fix-242-b-marca-producto-en-puerta
> refs: hotfix-174-b (título y favicon de la app) · fix-146-b (`resolveBrandText`)
> status: in_progress
> created: 2026-11-07

## Root Cause
La app nació como el sistema de una sola escuela y su identidad quedó en «Autoescuela» genérico:
el login y el cambio de contraseña obligatorio muestran el micro-label «Autoescuela» con un ícono
de auto, y el sidebar cae a «Autoescuela» para instructores, alumnos y para el admin viendo todas
las sedes. Ahora el producto es **Gestor de Autoescuelas** (entrada pública
`gestordeautoescuelas.cl`, marca: la G sobre una placa) y vende a varias escuelas. Criterio
acordado con el usuario: **afuera y en la puerta va el producto; adentro va la escuela.** El
producto no debe parecer una de sus clientas, y una escuela no debe ver un nombre genérico donde
corresponde el suyo.

`resolveBrandText()` solo resolvía sede para admin y secretaria; instructores y alumnos tienen
`users.branch_id` (expuesto como `currentUser().branchId`), pero `AppShellComponent` solo cargaba
`BranchFacade.branches()` para admin/secretaria, así que no había nombre que mostrarles.

## ACs Afectados
Ninguno — fix autónomo. Contrato de este fix:

- **AC1 — Login:** la card del login muestra la marca del producto (placa con la G + «Gestor de
  Autoescuelas», «de» en peso normal) en vez del ícono de auto y el micro-label «Autoescuela».
- **AC2 — Cambio de contraseña obligatorio:** el micro-label «Autoescuela» pasa a ser la misma
  marca del login.
- **AC3 — Marca adaptada al DS:** la marca es una **firma**, no un título: logotipo de 16 px, peso
  700, en `text-text-secondary`, con más aire antes del h1. La placa toma el azul de la app
  (`fill-brand`, el mismo del botón principal y el que la entrada usa para «la app») y la G el color
  de la superficie (`stroke-surface`): G blanca sobre `#0369a1` en claro (5,9:1), G oscura sobre
  `#38bdf8` en oscuro. Sin colores hardcodeados. Componente Dumb reutilizable en `shared/`.
  > Decisión del usuario tras ver la primera versión (placa negra `--text-primary` + logotipo de
  > 20 px/800 en negro): en modo claro quedaban dos títulos negros compitiendo arriba y la placa era
  > el único negro sólido de una pantalla blanca, gris y azul; lo de abajo no encajaba con lo de
  > arriba. No era contraste (19,9:1) sino peso y paleta. Se eligió «azul y discreta» entre
  > variantes prototipadas en el navegador.
- **AC4 — Sidebar, sede donde ya aplicaba:** admin con sede filtrada y secretaria siguen viendo el
  nombre de su sede.
- **AC5 — Sidebar, escuela propia:** instructores y alumnos ven el nombre de la sede de su
  `users.branch_id` (la lista de sedes se carga para todo rol autenticado; RLS `select_branches`
  ya permite leerla a cualquier autenticado).
- **AC6 — Sidebar, sin escuela:** donde no corresponde una escuela (admin en «Todas las escuelas»,
  usuario sin sede, sede aún no cargada, sin usuario) → «Gestor de Autoescuelas».

## Cambio
- **Archivo:** `src/app/core/utils/brand-text.utils.ts` — instructor/alumno resuelven su
  `branchId`; fallback `PRODUCT_NAME` = «Gestor de Autoescuelas».
- **Archivo:** `src/app/shared/components/product-brand/product-brand.component.ts` — nuevo Dumb
  `app-product-brand` (placa SVG + logotipo), tamaños `md`/`sm`.
- **Archivo:** `src/app/shared/components/login-card/login-card.component.ts` — usa la marca.
- **Archivo:** `src/app/features/auth/force-password-change/force-password-change.component.ts` —
  usa la marca.
- **Archivo:** `src/app/layout/app-shell.component.ts` — `loadBranches()` para todo rol con usuario.
- **Archivo:** `indices/COMPONENTS.md`, `indices/UTILS.md` — sincronización.

## Test de Regresión
- `src/app/core/utils/brand-text.utils.spec.ts > resolveBrandText` (instructor/alumno con sede,
  fallback «Gestor de Autoescuelas») ✓
- `app-product-brand` no toma decisiones (solo tamaño) y los tests de template están excluidos de
  Vitest en este repo: login y cambio de contraseña se verifican en el navegador, en modo claro y
  oscuro.
- La carga de sedes para instructor/alumno (`AppShellComponent`, sin spec propio) se verifica en
  el navegador: sidebar de un instructor con el nombre de su sede.
