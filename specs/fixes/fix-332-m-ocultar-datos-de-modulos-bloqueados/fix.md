# Fix: La Base Profesional y la ficha muestran datos de módulos bloqueados, siempre vacíos
> id: fix-332-m-ocultar-datos-de-modulos-bloqueados
> refs: fix-319-m-testing-clase-profesional-piloto (S12, C07, C08, D12) · ASG-i-025
> status: in_progress
> created: 2026-10-05

## Root Cause
El semáforo de asistencia, "Módulos N/7", las tarjetas de asistencia y nota de la ficha y el botón
de certificado dependen de datos que solo se cargan en Asistencia Profesional y Evaluaciones,
bloqueados en el piloto (`admin-alumnos-profesional.facade.ts:279-289`;
`admin-alumno-detalle.component.ts:635-861,1324-1333`). Todos los alumnos salen "Sin datos", 0/7 y
"Certificado (1/3 criterios)" deshabilitado.

Decisión D12 (Matías, 2026-10-05): **se ocultan en el piloto** mientras sus módulos sigan
bloqueados.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- **`src/app/shared/components/alumnos-profesional-list-content/alumnos-profesional-list-content.component.ts`**
  — sin columnas Asistencia y Módulos (ni sus datos en la tarjeta) cuando
  `isBlockedInPilot('clase-profesional-recorte')`; también el KPI que cuenta semáforo rojo (S11
  queda resuelto por no mostrarse).
- **`src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts`** — en modo
  Profesional, sin tarjetas de asistencia/nota ni botón de certificado bajo el mismo flag.
- **`src/app/core/facades/admin-alumnos-profesional.facade.ts`** — no consultar asistencia/notas
  mientras esté bloqueado.

## Test de Regresión
- E2E: la Base Profesional y la ficha Profesional no muestran asistencia, módulos ni certificado.
