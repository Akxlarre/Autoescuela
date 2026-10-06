# Fix: "Ver ficha" desde la Base Profesional abre la matrícula Profesional
> id: fix-335-m-ficha-desde-base-profesional-abre-su-matricula
> refs: ASG-i-025 · fix-319-m (H02 · S17) · fix-272-m
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Root Cause

La ficha (`/app/{admin,secretaria}/alumnos/:id`) abre la matrícula que le indica `?enrollment=`;
sin ese parámetro abre la principal (la más reciente). `fix-272-m` hizo que la **Base B** lo
pase, pero la **Base Profesional** quedó fuera: ni el botón "Ver ficha" de la tabla
(`alumnos-profesional-list-content`) ni el de la tarjeta móvil (`alumno-profesional-card`)
mandan la matrícula.

Efecto (H02, verificado el 2026-10-06): E2E-ProfConB tiene la matrícula Profesional 0095 y una
Clase B 0073 posterior. Desde la Base Profesional se abre "CLASE B · MATRÍCULA #0073" con las 12
clases prácticas, y el enlace de vuelta lleva a la Base B (la ruta de "volver" se decide por el
tipo de la matrícula abierta).

## ACs Afectados

Ninguno de spec — fix autónomo derivado del testing de `fix-319-m`. Cierra:

- **H02 / S17:** "Ver ficha" desde la Base Profesional (tabla y tarjeta) abre la matrícula de esa
  fila, y "volver" lleva a la Base Profesional.

## Cambio

- **`shared/components/alumnos-profesional-list-content/alumnos-profesional-list-content.component.ts`**:
  `[queryParams]="{ enrollment: alumno.enrollmentId }"` en "Ver ficha" (mismo patrón que la Base B).
- **`shared/components/alumno-profesional-card/alumno-profesional-card.component.ts`**: lo mismo
  en el "Ver ficha" de la tarjeta.

## Test de Regresión

- `alumnos-profesional-list-content.component.spec.ts > "Ver ficha" manda la matrícula de la fila` ✓
- `alumno-profesional-card.component.spec.ts > "Ver ficha" manda la matrícula de la tarjeta` ✓
- Navegador: E2E-ProfConB desde la Base Profesional abre "PROFESIONAL A3 · MATRÍCULA #0095" y
  vuelve a la Base Profesional; E2E-ProfDoble abre 0093 o 0094 según la fila ✓

### Verificación (2026-10-06)

- Tests: los 2 nuevos en rojo antes del cambio (`fichaQueryParams is not a function`), en verde
  después. Los tests de template están excluidos de Vitest (`vitest.config.ts`), así que se prueba
  la decisión del componente y el binding en navegador. Suite: 3314 ✓. `tsc` y `lint:arch` sin
  errores.
- Navegador (admin, 1440 px): E2E-ProfConB → `/app/admin/alumnos/7335?enrollment=6984`,
  "PROFESIONAL A3 · MATRÍCULA #0095", volver → `/app/admin/clase-profesional/alumnos`.
  E2E-ProfDoble fila 0094 → `?enrollment=6983` (A4 #0094); fila 0093 → `?enrollment=6982`
  (A2 #0093). Tarjeta a 375 px: E2E-ProfConB → `?enrollment=6984`, #0095.
