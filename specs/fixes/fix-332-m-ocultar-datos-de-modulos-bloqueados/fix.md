# Fix: La Base Profesional y la ficha muestran datos de módulos bloqueados, siempre vacíos
> id: fix-332-m-ocultar-datos-de-modulos-bloqueados
> refs: fix-319-m-testing-clase-profesional-piloto (S12, C07, C08, D12) · ASG-i-025
> status: done
> closed: 2026-10-05
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

**Ajuste al implementar:** el facade **sigue consultando** asistencia y notas (no se cortó la
consulta). Cortarla dejaba sin cobertura el test del mapeo semáforo/módulos (AC6) y son dos
consultas livianas; ocultar en la UI cumple D12 y, al levantar el recorte, todo vuelve sin tocar
el facade. En la ficha, en vez de dejar la columna de progreso vacía, se muestra un estado vacío
que explica por qué no hay datos.

## Test de Regresión
- E2E: la Base Profesional y la ficha Profesional no muestran asistencia, módulos ni certificado.

**Verificado el 2026-10-05:** spec de la lista (sin columnas `modulos`/`asistencia` ni KPI
`riesgo`) y specs de tarjeta, ficha y facade: 69/69. `tsc` y `lint:arch` sin errores. Visual
(`secretaria2@test.com`, 1440 px): encabezados de la Base Profesional "Alumno · Nº Mat. ·
Promoción · Estado · Saldo · Acciones" (celdas alineadas), KPIs sin "En riesgo"; ficha de
`E2E-ProfA2` (student 7333): columna central con "Asistencia y evaluaciones aún no habilitadas",
sin tarjetas de asistencia/nota ni botón de certificado; consola sin errores. Todo bajo
`isBlockedInPilot('clase-profesional-recorte')`.

**Visto de paso, fuera de este fix (para el bloque 2, casos H):** la ficha Profesional muestra los
botones "Inasistencias" y "Reagendamientos" (propios de Clase B) y "Generar Carnet" deshabilitado.
