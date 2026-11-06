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

## Estado al 2026-10-16 (revisión contra `main` y producción)

`e2e/agenda.spec.ts`: **29/29 en verde, sin ningún `knownBug`** (tras fix-227-b y fix-228-b).

| # | Estado hoy | Cómo se resolvió |
|---|---|---|
| H1 / S1 | ✅ Resuelto por decisión | spec `0048-b`: la cancelación automática es configurable por sede y está **apagada en las dos** (`branch_absence_penalty_config.auto_cancel_enabled = false`). El cron sigue marcando "Ausente" a las 21:00 las clases no iniciadas, pero ya no cancela la agenda; además `fix-371-m` impide marcar ausente antes de la hora |
| H2 / S4 | ✅ Corregido | `fix-187-b` (trigger que impide el mismo vehículo en dos clases a la misma hora) |
| H3 / S11 | ✅ Corregido | `fix-189-b`: la Agenda muestra los errores de carga (A08 ya no es `knownBug`) |
| H5 / S18 | ✅ Corregido | `hotfix-060-b` (pastilla con color, sin "Clic para agendar") |
| S20 | ✅ Corregido | `fix-224-b` + `fix-226-b`: un vehículo en Mantenimiento o Fuera de servicio no ofrece horarios |
| Otro (tope por día) | ✅ Resuelto | la app lee `courses.max_classes_per_day` (= 1 en los 6 cursos B); ya no aplica un tope 2 propio |
| S6 | ✅ Resuelto | `fix-196-b`: el choque se calcula en `class_b_slot_occupied()` SECURITY DEFINER, sin la RLS de quien lee |
| H4 / S19 | ✅ Corregido (`fix-227-b`, #295) | simulado en una transacción: un instructor + vehículo "Ambas" genera **65 horarios duplicados en 7 días** (una fila por sede con el mismo bloque). Hoy no hay ningún instructor ni vehículo "Ambas" → no se ve en el piloto |
| S2 | ✅ Corregido (`fix-228-b`, #296) — decisión: no ofrecer bloques ya empezados (había 34 al aplicarlo) | la vista no filtra los bloques de hoy que ya pasaron (no se pudo ver a las 07:53: el primero es 08:30) |
| S3 | ✅ Corregido (`fix-228-b`, #296) — decisión: la vista cubre hoy + 4 meses (C06 ya no es `knownBug`) | la vista genera 28 días (hoy: hasta el 13-nov) y la Agenda deja navegar 3 meses (`AgendaSettingsService`); desde la semana 5 no hay "Disponible" |
| S16, S17 | backlog | sin cambios (sin efecto de cara al usuario en el piloto) |

**Regresión encontrada y corregida el mismo día:** `fix-226-b` (#293) — la función nueva de
`fix-224-b` no tenía `GRANT EXECUTE` para `authenticated` y la vista (security_invoker) fallaba con
sesión de admin/secretaria desde el 15-oct: Agenda y elección de horarios caídas ~1 día.

## Segunda tanda (2026-10-19)

`e2e/agenda-2.spec.ts` (solo lectura): **14/14 en verde**. Sin bugs nuevos.

| Casos | Resultado |
|---|---|
| A05, A09 | ✅ primera carga 5,8 s (< 10 s); al volver, grilla al instante |
| B04 | ✅ indicador "ahora" solo en la semana actual y dentro de un bloque (en la pausa de 5 min entre bloques no aparece) |
| B06 | ✅ leyenda con los 5 estados |
| C07 | ✅ con el límite en 2 meses se navegan 8 semanas |
| C11 | ✅ "Ir a fecha" eligiendo hoy desde otra semana vuelve a la actual |
| C13 | ✅ navegar rápido con red lenta termina en la semana pedida |
| D07 | anotado: al salir y volver se conserva el instructor elegido |
| E08 | ✅ Tab + Enter sobre un horario abre el detalle |
| P05, P06 | ✅ barra sin superposiciones a 820 px; con Tab se llega a todos los controles |

## Decisiones del owner (2026-10-19)

| Caso | Decisión | Track |
|---|---|---|
| P03 | En el celular la Agenda abre en el día de hoy | `hotfix-094-b` (#313) |
| E11 | El detalle de una clase tiene "Ver ficha del alumno" | `hotfix-095-b` (#314) |
| B11 | Desactivar un instructor con clases futuras avisa y pide reasignarlas (ya lo hacía `fix-205-b`); además la Agenda mostraba "#id" en sus clases | `hotfix-097-b` (#316) |
| B15 / M09 | Los feriados no ofrecen horarios; lista sincronizada sola (mensual) e incluye el 20 de agosto de Chillán | spec `0052-b` (#318) |
| C08 | El límite de semanas de la Agenda sigue siendo una preferencia por equipo (desde fix-228-b los horarios cubren los 4 meses igual) | — (queda así) |

## Tercera tanda (2026-10-29) — grupo 1 (la Agenda en sí)

Reparto del resto del checklist acordado con el owner: **(1)** la Agenda en sí, **(2)** reprogramar /
reagendar desde la ficha y eliminar / reactivar horario, **(3)** iniciar y finalizar la clase,
**(4)** cron de fin de jornada, **(5)** la matriz Triple Match. Se empieza por el 1 (casi todo de
solo lectura) y se cierra el 5 con referencias.

`e2e/agenda-3.spec.ts`: **5/5 en verde, 2 corridas** (`--workers=1`). Los tests con clases siembran
un alumno E2E- por API y lo borran al terminar; usan un instructor de la sede 1 distinto del 223 de
`agenda.spec.ts` para no chocar con los tests que inician clases. Verificado después de cada
corrida: sin datos E2E- sobrantes.

| Casos | Resultado |
|---|---|
| B05, E06 | ✅ una clase "No asistió" de la semana pasada sale tachada (`slot-block--no_show`, `line-through`) y su detalle dice "No asistió" |
| B07 | ✅ la clase cancelada no aparece y su horario vuelve a ofrecerse como "Disponible" |
| B09 | ✅ un apellido de 45 caracteres no desborda la celda |
| B10 | ✅ la clase sale en la fila de su hora Chile |
| G01 | ✅ con la Agenda abierta (secretaria), una clase agendada desde otra sesión aparece sin recargar |
| G02 | ✅ al iniciarla y cerrarla desde otra sesión, el slot pasa a "En progreso" y luego a "Completada" sin recargar |
| E05 | anotado: el detalle de una clase **en curso no muestra el KM inicial** (solo las completadas muestran KM). Pendiente de decisión del owner |
| A07, E10 | ✅ "Agenda" en las acciones rápidas del dashboard de la secretaria abre la Agenda en el drawer; el detalle de un horario se apila y "Volver" regresa a la grilla |
| C12 | ✅ 8 semanas atrás: "Semana anterior" sigue habilitado (sin tope) y no hay ningún "Disponible" |
| D05 | ✅ el filtro no ofrece instructores teóricos. Hoy **no hay ninguno en la BD**, así que el test queda como protección; el filtro ya excluye `type = 'theory'` en `AgendaFacade` |

**Hallazgo al automatizar (para quien siembre clases cerradas):** completar una clase con `km_end`
sube `vehicles.current_km` (trigger de `fix-222-b`) y le crea un aviso al alumno; sin borrar ese aviso
el alumno E2E- no se puede borrar (FK de `notifications`). El test usa el KM actual del vehículo y
borra el aviso. Una corrida intermedia dejó el alumno 9154 sin borrar: se limpió a mano (aviso +
usuario) y se comprobó que ningún vehículo cambió de KM.

**Grupo 1 cerrado como cubierto por otro track o decidido:**
- B11 → `hotfix-097-b` (nombre del instructor inactivo, no "#id"). B13 → `hotfix-077-b` (patente del
  vehículo "ambas sedes"). B14 → `fix-224-b` + `fix-226-b` (mantención no ofrece horarios). B15 →
  spec `0052-b` (feriados). B16 → `fix-227-b` (un solo "libre" por horario). C08 → decisión del
  2026-10-19 (preferencia por equipo). F05 → `fix-196-b` (choque de la otra sede, test SQL). G03 →
  O06 / test SQL de concurrencia.
- C02 → test C01–C03 de `agenda.spec.ts`. D04 → A02, F01 y F04 de `agenda.spec.ts`.

**Grupo 1 que sigue abierto:** B03 (semana sin clases), B08 (horario `reserved` de un borrador, S14),
B12 (aviso de SOAP vencido: falta un vehículo con documentos vencidos en los datos), C09 / C10 ("Ir a
fecha" a otra semana y fechas bloqueadas), D08 (sede sin instructores: no hay datos), E07, F02, F03,
F06, F07, F08 (sedes y multisede en la Agenda), G04–G07 (ráfagas de recarga, instructor nuevo, canal
al salir, página + drawer a la vez), P07 (tooltips), P08 (animación).

**Grupo 5 — matriz Triple Match, cerrada con referencias:** L01 y L03 (instructor ocupado, alumno
con otra clase) → `supabase/tests/agenda/fix-186-b-triple-match-bd.sql`; L02 (vehículo ocupado) →
`fix-187-b`; L04 y L05 (horario pasado, límite de fecha) → `fix-228-b`; L06 (tope por día) → la app
lee `courses.max_classes_per_day`; L08 y L09 (instructor "ambas sedes", choque en la otra sede) →
spec `0004-m` + `fix-196-b`; L10 (mantención) → `fix-224-b`; L11 (dos secretarias a la vez) → O06.
**L07** (aviso de SOAP / revisión técnica en cada flujo) queda con B12 y con los casos H11 / I12 de
los flujos.

**Casos H (paso 2 de la matrícula presencial):** H08, H10, H13, H14, H16, H18 y H21 pasan a
`fix-058-i` (ASG-i-023, Ignacio), que ya prueba ese flujo.

## Cuarta tanda (2026-10-29) — grupo 4 (cron de fin de jornada)

`supabase/tests/agenda/fix-186-b-cron-fin-de-jornada.sql`: **8/8 reglas en verde** contra la BD de
desarrollo (`skvekggejikzxhzsjmkz`). Llama a `mark_end_of_day_class_b_absences()` (lo que corre
pg_cron a las 21:00 Chile) en vez de esperar a la noche, sobre clases creadas a las 03:07 / 05:07
Chile (fuera de la grilla). Cada caso se deshace solo; verificado después: configuración de
penalización igual que antes (apagada en las 2 sedes), sin feriados, justificaciones ni clases de
prueba.

| Caso | Resultado |
|---|---|
| M01 | ✅ clase de ayer sin iniciar → "No asistió" + asistencia "Ausente" |
| M02 | ✅ clase en progreso sin cerrar → sigue "En progreso" (a propósito; bloquea al instructor, K10) |
| M04 | ✅ clase completada → no la toca |
| M05 | ✅ clase de pasado mañana → no la toca |
| M03 | ✅ 2 faltas seguidas: con la cancelación automática **apagada** (configuración de hoy, spec `0048-b`) no cancela nada; **encendida**, cancela las futuras y marca la penalización en la matrícula |
| M06 | ✅ una sola falta, encendida → no cancela |
| M07 | ✅ una falta justificada en el día + otra falta, encendida → no cancela (la justificada no cuenta) y la justificación queda intacta |
| M08 | cerrado por decisión: es M01 a las 20:00 — el cron marca "No asistió" toda clase no iniciada; desde spec `0048-b` eso ya no cancela la agenda (cancelación apagada en las 2 sedes) |
| M09 | **anotado, decisión del owner:** una clase agendada en un día que después quedó como feriado, si nadie la inicia, **el cron la marca "No asistió"**. Desde spec `0052-b` los feriados no ofrecen horarios, así que solo pasa con clases agendadas antes de que el feriado entrara a la lista |
