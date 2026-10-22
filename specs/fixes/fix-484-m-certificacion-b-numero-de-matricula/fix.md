# Fix: La lista de Certificación Clase B no muestra el Nº de matrícula
> id: fix-484-m-certificacion-b-numero-de-matricula
> refs: fix-480-m-testing-certificacion-profesional · fix-482-m
> status: done
> closed: 2026-10-22
> created: 2026-10-22

## Root Cause

Mismo hallazgo que `fix-482-m` en Profesional, visto al compararlas: la fila de Certificación B
identifica al alumno solo por nombre y RUT. El Nº de matrícula, que es como la escuela identifica a
un alumno, no aparece ni se puede buscar.

## ACs Afectados

- AC propio — tabla y tarjeta de Certificación B (admin y secretaria) muestran el Nº de matrícula
  como primer dato del alumno.
- AC propio — el buscador encuentra por Nº de matrícula, además de nombre y RUT.

## Cambio

- `core/utils/certificate-list.utils.ts` (nuevo): `filterCertificadoAlumnos()` — el filtro de
  `fix-482-m` pasa acá para que lo usen las dos listas (Profesional lo importaba de
  `professional-certificate.utils.ts`).
- Modelo `CertificacionAlumnoRow`: `numeroMatricula`; `CertificacionClaseBFacade` lo lee de
  `enrollments.number`.
- `certificacion-clase-b-content`: columna "Nº" primero, Nº sobre el nombre en la tarjeta,
  buscador "Buscar por Nº, nombre o RUT...", filtro con la función común.

## Test de regresión

- `certificate-list.utils.spec.ts` — por estado, nombre sin tildes, RUT sin puntos y Nº.

## Progreso

- [x] Test rojo (el módulo no existía) → verde; `core/utils` + facades de certificación 1651/1651,
  `tsc` app y spec limpios
- [x] Facade y componente (el spec del componente y `e2e/documentos-certificacion.spec.ts` se
  ajustaron al campo y al placeholder nuevos)
- [x] Navegador (2026-10-22, admin 1440 px): columna "Nº" primero (0048, 0049…); buscar "0048"
  filtra. E2E `documentos-certificacion` (1 y 2) + `certificacion-profesional`: 19/19.
