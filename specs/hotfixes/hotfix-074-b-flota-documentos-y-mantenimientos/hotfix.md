# Hotfix: Documentos por vencer en verde, historial "vacío" cuando falla, umbral de 14 días y KPIs mal rotulados
> id: hotfix-074-b-flota-documentos-y-mantenimientos
> refs: ASG-i-032 (checklist 032, S8, S9, S14 y S15; decisiones 5 y 7 del owner, 2026-10-12)
> status: done
> created: 2026-10-12

## Problema
1. **S8:** el drawer de Documentos solo distingue "Vencido" de todo lo demás: un documento por vencer
   sale "Vigente" en verde, mientras el listado lo marca en ámbar.
2. **S9 (decisión 5):** la página de mantenimientos considera "por vencer" a 14 días; el resto de la
   app, a 30. Un solo umbral: 30.
3. **S14:** si falla la consulta del historial de mantenimientos se muestra "historial vacío" (no se
   revisa el error). Y si falla la Hoja de Ruta, además del mensaje del propio drawer aparece en la
   página el banner "Hubo un problema al cargar los datos del vehículo".
4. **S15 (decisión 7):** "Costo p/Mes" es el total dividido por la cantidad de servicios y "KM
   Recorridos" es el odómetro. Se renombran a "Costo promedio por servicio" y "Kilometraje actual".

## Cambios
- **Archivo:** `src/app/features/admin/flota/vehicle-documents-drawer/vehicle-documents-drawer.component.ts`
  — insignia "Por vencer" (ámbar) para `expiring_soon`.
- **Archivo:** `src/app/core/facades/flota-detalle.facade.ts` (+ spec) — el estado de los vencimientos
  sale de `resolveDocStatus()` (30 días, el mismo del listado); se revisa el error del historial; el
  fallo de la Hoja de Ruta ya no ensucia el error de la página; `avgMonthly` → `avgPerService`,
  `kmTraveled` → `currentKm`.
- **Archivo:** `src/app/core/models/ui/vehicle-detail.model.ts` — nombres de los KPIs.
- **Archivo:** `src/app/features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.ts` —
  etiquetas de los KPIs.

## Verificación
- vitest del facade; `tsc`, `lint:arch`; e2e de la página de mantenimientos y del drawer de documentos.

## Resultado (2026-10-12)
- `flota-detalle.facade.spec.ts` 7/7 (+4: umbral de 30 días con vencimientos a −1, 0, 20 y 31 días; error del historial; la Hoja de Ruta no toca el error de la página; KPIs).
- `e2e/flota-documentos.spec.ts` 2/2 (fechas cambiadas en la respuesta, la BD no se toca): el drawer muestra "Vencido", "Por vencer" y "Vigente"; la página de mantenimientos muestra "Costo prom. por servicio" y "Kilometraje actual".
- `tsc` sin errores, `lint:arch` 0 errores.
- La etiqueta quedó "Costo prom. por servicio" (la versión larga no cabe en la tarjeta).
