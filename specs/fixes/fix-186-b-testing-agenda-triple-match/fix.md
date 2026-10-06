# Fix: Testing — Agenda Clase B y Triple Match
> id: fix-186-b-testing-agenda-triple-match
> refs: ASG-i-026
> status: in_progress
> created: 2026-10-06

## Root Cause
[Heredado de ASG-i-026.] Track de **testing**, no de un bug puntual: ejecutar el checklist
`specs/testing-piloto/026-agenda-triple-match.md` (Agenda semanal, los flujos que agendan o mueven
una clase B, ciclo de vida, cron, RLS) y dejar automatizado lo marcado "Auto ✓".

Regla de la tanda: **cada bug encontrado va a su propio fix/hotfix**; acá solo se registra el
resultado de cada caso (✅ / ❌ + evidencia).

## ACs Afectados
Ninguno de una spec previa — track de testing (origen ASG-i-026). Criterios propios:

- **T1:** las sospechas S1–S21 quedan confirmadas o descartadas con evidencia (navegador, BD o
  código), o como decisión pendiente con dueño.
- **T2:** los casos "Auto ✓" de lectura (Agenda, navegación, filtro, detalle, sedes) quedan en
  `e2e/agenda.spec.ts`, contra el build de producción.
- **T3:** las reglas de BD (O02–O06, L01–L03) quedan probadas con SQL dentro de transacciones que
  se deshacen (`supabase/tests/`), sin dejar datos.
- **T4:** cada ❌ tiene su propio track (fix/hotfix) o una decisión registrada.

## Cambio
- `e2e/agenda.spec.ts`, `supabase/tests/` — tests nuevos (sin cambios de producción en este track).

## Test de Regresión
- `npx playwright test e2e/agenda.spec.ts` contra el build de producción en `localhost:4200`.

## Resultados — automatizados (2026-10-06)

**E2E** (`e2e/agenda.spec.ts`, build de producción): **25/25 en verde** (7,1 min), incluidos 4 `knownBug`
que fallan por la razón esperada (verificado con `E2E_SHOW_KNOWN_BUGS=1`).
**BD** (`supabase/tests/agenda/fix-186-b-triple-match-bd.sql`, transacciones que se deshacen;
verificado después que no quedó nada) + regresión `supabase/tests/rls/0047-b-aislamiento-por-sede.sql`.

| Casos | Resultado |
|---|---|
| A01, A02, A03, A04, A06, A10, P09 | ✅ (A03: `/app/admin/agenda` como secretaria → su dashboard; P09: consola limpia) |
| B01, B02 | ✅ lunes a viernes, hoy destacado, 13 bloques 08:30–20:00 |
| C01–C05 | ✅ (C05: 20 clics rápidos nunca pasan del límite y la grilla no navega sola — regresión `fix-162-m`) |
| D01, D03, D06 | ✅ |
| D02 / D09 | ✅ "Limpiar filtros" lleva a la vista maestra ("N libres") → **S15 resuelta en parte** (sigue preseleccionando un instructor, y sin orden fijo: la consulta no tiene `.order`) |
| E01, E02, E04, E09 | ✅ (E04: KM inicio, fin y "Distancia recorrida") |
| F01, F04 | ✅ |
| K01, K04, K09 | ✅ **Pregunta crítica respondida: la secretaria SÍ puede cerrar una clase de punta a punta** desde Asistencia B (estado `completed`, KM inicio/fin, asistencia `present`, `vehicles.current_km` actualizado) |
| K10 | ✅ "El instructor ya tiene una clase en curso…" (regresión spec `0001-i`) |
| P02, P04 | ✅ 375 / 768 / 1440 px sin scroll horizontal; pestañas de día en móvil |
| O02 / L01, L03 | ✅ la BD rechaza instructor y alumno ocupados (regresión `fix-152-m`, `fix-301-m`) |
| O01, O04, O05 (S12) | ✅ **S12 descartada**: la cerró `0047-b` (RLS por sede en `class_b_sessions`); su prueba pasa entera |
| A08 | ❌ `knownBug` **S11**: con la carga caída la Agenda muestra una semana vacía, sin mensaje |
| C06 | ❌ `knownBug` **S3**: desde la semana 5 no hay "Disponible" aunque el texto diga "hasta el 6 de enero" |
| E01b, E03 | ❌ `knownBug` **S18**: el slot libre dice "Clic para agendar" (solo lectura) y la pastilla "Agendada"/"En progreso" sale sin fondo (`--state-brand` no existe) |

## Sospechas — estado

| # | Resultado | Evidencia |
|---|---|---|
| S1 | 🔴 **Confirmada con datos reales del piloto** | Entre el 15 y el 23-sep el cron de las 01:00 UTC (sin usuario) **canceló 174 clases futuras de ~69 matrículas**: nadie las inició → `no_show` → 2 faltas → penalización. Es lo que le pasaría a cualquier alumno si la secretaria no inicia cada clase el mismo día. → **decisión del owner** (§5) |
| S2 | Confirmada por definición de la vista | `generate_series` desde `CURRENT_DATE` sin `slot_start > now()`. La prueba de BD dio 0 a las 03:30 (aún no pasaba ningún bloque): repetir después de las 08:30 → **decisión** (H05/L04) |
| S3 | ❌ Confirmada | vista = **28 días**; Agenda "hasta el 6 de enero, 2027" (3 meses) → **decisión** (C06/H08) |
| S4 | ❌ **Confirmada** | INSERT de otro instructor con el **mismo vehículo** a la misma hora: **se guarda**; UPDATE solo de `vehicle_id` a uno ocupado: **se guarda**. No hay trigger de vehículo |
| S5 | ✅ Resuelta (`fix-299/301-m`) | L03 rechazado por `trg_prevent_student_double_booking` |
| S6 | ❌ Confirmada | instructor+vehículo "ambas sedes" con clase de un alumno de sede 1: postgres ve `occupied`, **secretaria sede 2 ve `available`** (vista `security_invoker` + RLS de `enrollments`). Hoy no hay ningún instructor "ambas sedes" en el piloto |
| S11 | ❌ Confirmada | `fetchAvailableSlots`/`fetchSessions` ignoran `error`; ninguna página usa `facade.error()`; A08 |
| S12 | ✅ Descartada (corregida en `0047-b`) | prueba `0047-b` |
| S15 | Parcial | "Limpiar filtros" da la vista maestra; el filtro inicial sigue siendo un instructor sin orden |
| S16 | Confirmada por código | `secretaria-agenda.component.ts` no tiene el `effect` de sede que sí tiene admin |
| S17 | Confirmada por código | canal Realtime → `refreshSilently()` sin debounce |
| S18 | ❌ Confirmada | E01b, E03 |
| S19 | ❌ Confirmada | la vista genera **2 filas** por horario para instructor+vehículo "ambas sedes" |
| S20 | ❌ Confirmada | vehículo en `maintenance` → **261 horarios disponibles** → **decisión** (B14/L10) |
| Otro | Inconsistencia | `courses.max_classes_per_day = 1` en los 6 cursos B, pero la app aplica tope 2 (`fix-062-m`) → **decisión** (L06/J07) |

## Hallazgos → destino

| # | Hallazgo | Gravedad | Destino |
|---|---|---|---|
| H1 | S1: el cron cancela la agenda completa del alumno si nadie inicia sus clases | 🔴 operativa | **decisión del owner** antes del piloto real |
| H2 | S4: la BD permite el mismo vehículo en 2 clases a la misma hora | 🟠 | track propio (pendiente) |
| H3 | S11: la Agenda nunca muestra errores de carga | 🟠 | track propio (pendiente) |
| H4 | S6 + S19: horarios "ambas sedes" (falso libre para secretaria, filas duplicadas) | 🟡 hoy sin datos que lo gatillen | track propio (pendiente) |
| H5 | S18: "Clic para agendar" + pastilla sin color | 🟡 | hotfix (pendiente) |
| H6 | S16, S17 | 🟡 | backlog |

## Casos manuales pendientes

| Casos | Estado |
|---|---|
| G01–G07, H*, I*, J*, K02/K03/K05–K08/K11–K18, L (matriz por flujo), M*, N* | Pendientes — necesitan 2 navegadores, hora real (cron de las 22:00) o decisiones de §5 del checklist |
| A05, A07, A09, B03–B16, C07–C13, D04/D05/D07/D08, E05–E08/E10/E11, F02/F03/F05–F08, P01/P03/P05–P08 | Pendientes (visuales/manuales) |
