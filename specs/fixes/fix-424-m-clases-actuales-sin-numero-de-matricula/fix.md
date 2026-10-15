# Fix: "Clases Actuales" identifica al alumno solo por su primer nombre, sin Nº de matrícula
> id: fix-424-m-clases-actuales-sin-numero-de-matricula
> refs: fix-395-m-testing-dashboards (caso M19, decisión de Matías 2026-10-14)
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Síntoma

Cada clase del panel "Clases Actuales" muestra el primer nombre del alumno (el nombre completo solo
en el tooltip) y no muestra el Nº de matrícula. Dos alumnos con el mismo nombre no se distinguen.

## Root Cause

`DashboardFacade.fetchLiveClasses()` no trae `enrollments.number` y `LiveClassModel` no tiene dónde
llevarlo; el panel recorta `studentName` a la primera palabra.

## Fix

Decisión de Matías: "lo más importante siempre debe ser el número de matrícula por sobre los
nombres".

- `PRACTICA_SELECT` trae `enrollments.number` → `LiveClassModel.enrollmentNumber`.
- El panel muestra primero "Nº 0027" (título) y al lado el nombre del alumno (nombre y apellido,
  sin recortar, en texto secundario).
- El nombre accesible de la fila suma el número: "Iniciar la clase de Juan Pérez (Nº 0027), 11:30".
- El número no se recorta nunca (se recorta el nombre) y en móvil (`< sm`) se ocultan los avatares
  de alumno e instructor, que no identifican a nadie y le quitaban el ancho al número.

## Acceptance Criteria

- [x] AC1 — `fetchLiveClasses()` entrega el Nº de matrícula de cada clase.
- [x] AC2 — La fila muestra el Nº de matrícula como dato principal y el nombre del alumno al lado.
- [x] AC3 — El `aria-label` de la fila incluye el Nº de matrícula.

## Regression Test

- `dashboard.facade.spec.ts` → `fix-424-m`
- `live-classes-panel.component.spec.ts` → `fix-424-m`

## Verificación (2026-10-14)

- Unit: 1 test en `dashboard.facade.spec.ts` y 2 en `live-classes-panel.component.spec.ts`. 87/87.
  `tsc` sin errores.
- Navegador con una clase sembrada hoy (test temporal, borrado): a 1440 px la fila muestra
  "Nº E2E-… · nombre" y su `aria-label` "Iniciar la clase de E2E-Matricula Prueba471063
  (Nº E2E-84710630), 02:00". A 375 px, antes del ajuste el número quedaba "Nº E…"; después se ve
  completo. Los números de prueba (12 caracteres) son mucho más largos que los reales (4 dígitos).
