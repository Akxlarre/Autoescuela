# Acceptance — Spec 0057-b (disponibilidad de Clase B por sede)

> Verificado: 2026-11-06 · Supabase `skvekggejikzxhzsjmkz` (**producción**, migración aplicada) ·
> Playwright + `ng serve` · edge function `public-enrollment` v75

| AC | Estado | Evidencia |
|---|---|---|
| AC1 | ✅ | `supabase/tests/agenda/0057-b-disponibilidad-por-sede.sql` contra la vista real: 0 filas con `branch_ids` nulo, vacío o con una sede sin curso Clase B activo (14 días) |
| AC2 | ✅ | Test SQL: instructor de la sede 1 marcado "Ambas" (en un sub-bloque revertido), vehículo solo de la sede 1 → 0 bloques con `branch_ids @> {2}`. Unit: `agenda.facade.spec.ts` "disponibilidad por sede — spec 0057-b" (la consulta lleva `contains('branch_ids',[2])` y ya no filtra por los instructores de la sede en el cliente). Navegador: la Agenda de `secretaria2@test.com` pide `branch_ids=cs.{2}` → 200. e2e: `agenda-4.spec.ts` F08 espera 0 horarios "Disponible" en la sede 2 (verde, 2026-11-06) |
| AC3 | ✅ | Test SQL: el mismo instructor sigue con bloques en la sede 1 (`branch_ids = {1}`) |
| AC4 | ✅ | Test SQL AC5: con instructor y vehículo "Ambas", cada bloque trae `{1,2}`, así que aparece al filtrar por cualquiera de las dos sedes. Unit de Agenda con sede 1 y sede 2. e2e: `agenda-4.spec.ts` F03 con horarios en las dos sedes (verde, 2026-11-06) |
| AC5 | ✅ | Test SQL: 0 bloques repetidos por (instructor, vehículo, inicio) con instructor y vehículo "Ambas". Unit: el admin en "Todas las sedes" (`branchId` null) no agrega filtro |
| AC6 | ✅ | `enrollment.facade.spec.ts` (3 tests): la carga inicial y el refresco filtran por la sede de `loadInstructors(branchId)`; sin sede no filtran; `reset()` la olvida |
| AC7 | ✅ | `admin-alumno-detalle.facade.spec.ts` (2 tests): reagendar filtra por la sede del alumno; sin sede no filtra |
| AC8 | ✅ | `public-enrollment.facade.spec.ts`: las dos llamadas a `load-schedule` mandan `branchId` de la sede elegida. Edge function desplegada (v75) con `contains('branch_ids',[branchId])` cuando llega un número. Por HTTP responde 503 a todo porque la inscripción pública está cerrada a propósito (`PUBLIC_ENROLLMENT_ENABLED`, fix-193-b); la consulta equivalente en SQL da, para el instructor 223 de la sede 1, 1071 bloques en la sede 1 y 0 en la sede 2 |
| AC9 | ✅ | `EXPLAIN ANALYZE` sobre una copia de la vista en producción (revertida): admin 28 días 682 vs 679 ms; secretaria una semana 168 vs 169 ms |
| AC-E1 | ✅ | Test SQL: un instructor de una sola sede solo trae su sede. Antes de aplicar: la copia de la vista devolvía las mismas 2210 filas que la vista vigente (30 días), 0 diferencias |
| AC-E2 | ✅ | Test SQL como `secretaria2@test.com` (rol `authenticated`): lee la vista sin error y ve los bloques del instructor "Ambas" en su sede |

## Hallazgo durante la verificación
La primera versión agrupaba por `is_available` y la consulta del admin a 28 días quedaba un 40 %
más lenta: armar `slot_status` volvía a evaluar `class_b_slot_occupied()` por fila. Agrupar por
las columnas de salida (`GROUP BY 1..5`) la dejó igual que el `DISTINCT` anterior.

## Otros
- `npm run test:ci`: 4666 ok, 1 falla intermitente ajena (`instructor-clases`, 30/30 sola).
  `npm run lint:arch`: 0 errores.
- El test SQL no deja cambios: tras correrlo hay 0 instructores y 0 vehículos "Ambas", igual que antes.
- Fuera de alcance, anotado: la edge function no valida la sede al crear la matrícula.
