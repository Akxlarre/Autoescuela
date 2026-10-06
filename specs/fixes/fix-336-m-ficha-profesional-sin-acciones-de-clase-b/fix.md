# Fix: La ficha de un alumno Profesional no muestra acciones de Clase B
> id: fix-336-m-ficha-profesional-sin-acciones-de-clase-b
> refs: ASG-i-025 · fix-319-m (H06 · D15)
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Root Cause

La tarjeta de perfil de la ficha (`admin-alumno-detalle`) arma sus acciones operativas sin
distinguir el tipo de matrícula abierta:

- **Inasistencias** (con "Registrar Nueva"), **Ficha Técnica** ("Desempeño en clases prácticas") y
  **Reagendamientos** están fijos en el template: salen para cualquier matrícula, aunque los tres
  son conceptos de Clase B (clases prácticas con instructor).
- **Carnet**: para Clase B arma el menú real; para cualquier otra matrícula agrega un botón
  "Generar Carnet" **deshabilitado** que nunca se puede usar en Profesional.

Decisión D15 (Matías, 2026-10-06): en modo Profesional se ocultan los 4; Clase B no cambia.

## ACs Afectados

Ninguno de spec — fix autónomo derivado del testing de `fix-319-m`. Cierra:

- **H06 / D15:** con una matrícula Profesional abierta, la ficha no muestra Inasistencias, Ficha
  Técnica, Reagendamientos ni "Generar Carnet". Con una matrícula Clase B se ven igual que antes.

## Cambio

- **`features/admin/alumno-detalle/admin-alumno-detalle.component.ts`**:
  - Función pura exportada `showsClaseBActions(licenseGroup)` (mismo patrón que
    `resolveListadoRoute`) — `true` solo para `class_b`.
  - Template: Inasistencias, Ficha Técnica y Reagendamientos dentro de
    `@if (showsClaseBActions(alumno.licenseGroup))`.
  - `heroActions`: se elimina la rama que agregaba "Generar Carnet" deshabilitado.

## Test de Regresión

- `admin-alumno-detalle.component.spec.ts > showsClaseBActions (fix-336-m)` ✓
- Navegador: ficha de E2E-ProfA2 (Profesional) sin las 4 acciones; ficha de E2E-ProfConB en su
  matrícula B #0073 con las 4 ✓

### Verificación (2026-10-06)

- `showsClaseBActions`: 2 tests en rojo antes del cambio, en verde después. Suite completa en
  verde; `tsc` y `lint:arch` sin errores.
- Navegador (admin): ficha de E2E-ProfA2 (`?enrollment=6981`, Profesional A2 #0092) → la tarjeta de
  perfil solo muestra Consentimientos (además de Editar/Eliminar en el header); sin hueco donde iba
  la grilla. Ficha de E2E-ProfConB en su matrícula B (`?enrollment=6985`, #0073) → Carnet,
  Generar Certificado, Inasistencias, Ficha Técnica, Consentimientos y Reagendamientos, igual que
  antes.
- Además del cambio declarado: la grilla de acciones secundarias se dibuja solo si tiene algo
  (en Profesional quedaba vacía y sumaba un hueco).
