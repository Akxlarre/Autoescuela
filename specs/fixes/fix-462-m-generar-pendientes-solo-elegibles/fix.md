# Fix: "Generar pendientes" incluye a alumnos que no cumplen las clases
> id: fix-462-m-generar-pendientes-solo-elegibles
> refs: fix-447-m-testing-documentos-certificacion (S15)
> status: done
> closed: 2026-10-19
> created: 2026-10-19

## Root Cause

El admin ve en Certificación a todas las matrículas Clase B activas o completadas, cumplan o no
las clases (puede forzar una a una). "Generar pendientes" toma **todas** las filas pendientes
(`certificadoStatus === 'pendiente'`) y llama a `generate-certificate-b-pdf` sin `force`: la
función rechaza a las que no cumplen y el lote termina en "N con error", sin decir por qué. El
drawer promete "todos los alumnos pendientes elegibles" y el contador del botón cuenta también a
los no elegibles.

## ACs Afectados

- AC propio — "Generar pendientes" solo genera (y cuenta, en el botón y el drawer) a las
  matrículas pendientes con todas las clases del curso completadas.
- AC propio — el lote nunca fuerza: los que no cumplen se emiten uno a uno con el bypass admin.

## Cambio

- `CertificacionClaseBFacade.pendientesElegibles` (computed): pendientes con
  `clasesCompletadas >= clasesTotales`. `generarPendientes()` lo usa.
- Drawer "Generar pendientes" y contador del botón del contenido usan el mismo criterio.

## Test de regresión

- `certificacion-clase-b.facade.spec.ts` — con un pendiente 12/12 y otro 8/12, el lote invoca la
  función solo para el primero.

## Progreso

- [x] Test rojo antes del cambio (el lote invocaba también al 8/12) → verde después. Specs de certificación 45/45; `lint:arch` 0 errores.
- Navegador (admin, Certificación): contador y drawer — en la verificación conjunta del testing (fix-447-m).
