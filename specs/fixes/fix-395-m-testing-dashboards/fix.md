# Fix: Testing — Dashboards (admin ejecutivo y secretaria)
> id: fix-395-m-testing-dashboards
> refs: ASG-i-030
> status: done
> closed: 2026-10-14
> created: 2026-10-13

> **Track de testing, no de corrección.** Acá se registra el resultado de cada caso (✅ / ❌ +
> evidencia). **Cada bug encontrado va a su propio fix/hotfix**; no se corrige dentro de este
> track.
>
> **Checklist que se ejecuta:** `specs/testing-piloto/030-dashboards.md`.

## Root Cause

[Heredado de ASG-i-030, a confirmar]: Los dashboards no generan datos, los agregan: KPIs, clases
en vivo, alertas y actividad reciente salen de todos los demás módulos. Son el lugar donde el
cliente "ve" si el sistema está bien, y el dashboard ejecutivo de admin (spec `0044-b`) es nuevo y
recibió 5 fixes en su primera semana.

**Clasificación:** Integración · dificultad Media · rutas: `/app/admin/dashboard` (ejecutivo) y
`/app/secretaria/dashboard` (operativo).

### Alcance confirmado al reclamar (Matías, 2026-10-13)

Las 3 capas de la ASG entran en este track:

1. **Funcional** — ACs de `0044-b` (28 ACs), `fix-172-b`…`fix-176-b`, `fix-227-m`, `fix-029-m`,
   `fix-006-i` y `ASG-b-018`.
2. **E2E manual** — los casos A…S del checklist, incluidas las sospechas abiertas. Cada número se
   valida contra su módulo de origen.
3. **Playwright** — los casos "Auto ✓" van a la suite de `0019-m` (`e2e/`, `npm run test:e2e`).

Los hallazgos se corrigen en la misma sesión, cada uno en su propio fix/hotfix.

**Estado de las sospechas al reclamar** (leído en código el 2026-10-13, sin navegador):

| Sospecha | Estado | Cómo se ejecuta |
|---|---|---|
| S1 — "Borrar horarios" sin confirmación | Resuelta por `fix-364-m` y `fix-391-m` | Regresión |
| S4 — día consultado en UTC | Resuelta por `0024-m` (`dashboard.facade.ts` usa `chileDayRange`) | Regresión |
| S7 — secretaria con grant no recarga al cambiar de sede | El componente ya tiene `effect` | Confirmar en navegador |
| S13a — alertas sin guard de orden | `DashboardFacade` tiene guard; `DashboardAlertsFacade` no | Abierta (solo alertas) |
| S3 — "Ir a Cuadratura" fijo a la ruta de admin | Sigue igual (`alerts-drawer.component.ts:226`) | Abierta |
| S6 — cuota 2 filtra `'deposit'` | Sigue igual (`dashboard-alerts.facade.ts:587`) | Abierta |
| S12 — canal Realtime sin cerrar | `destroyRealtime()` existe; el componente no lo llama | Abierta |
| S2, S5, S8–S11, S13b–c, S14–S20 | Sin revisar | Abiertas |

**§M no repite lo de `fix-366-m`.** La asistencia vista desde "Clases Actuales" ya se probó en su
sección P, y sus decisiones responden tres preguntas de §5 de este checklist: M08 (C04: se avisa
si el km es raro), M09 (C06: se bloquea el vehículo en uso) y M10 (C08: se permite iniciar antes
de la hora). Acá queda la mecánica del panel: orden, etiquetas, scroll, clase colgada, drawers.

**Orden de ejecución por bloques:**

| Bloque | Secciones | Contenido |
|---|---|---|
| 1 | J07, R05, A03–A05 | Seguridad: RPC `exec_dashboard_*` solo admin, RLS por sede, acceso por rol |
| 2 | A–J | Ejecutivo: carga, período, KPIs contra su fuente, comparaciones, tabs, sede y errores |
| 3 | K–P | Secretaria: hero y KPIs, accesos rápidos, Clases Actuales, Agenda de Hoy, tiempo real, actividad |
| 4 | Q–S | Alertas (cada tipo y drawer), sedes/roles/sesión, visual y accesibilidad |

- **Datos:** sembrados en la BD de dev (D1…D18 del checklist) con montos y fechas conocidas.
- **Casos que piden 2 navegadores o reloj adelantado** (O01–O05, B10, Q02): 2 contextos de
  Playwright o datos sembrados.
- **Decisiones de negocio** (§5 del checklist): no se marcan ✅/❌; se listan abajo y se consultan
  en bloque.

### Fuera de alcance

- Dashboards de instructor y alumno (portales fuera del piloto).
- Los flujos por dentro de Matrícula (`023`), Registrar Pago (`028`), Egreso/Cuadratura (`029`) y
  Asistencia B (`027`): acá solo que se abren desde el dashboard y que su efecto se refleja.

## Resultados

### Bloque 1 — Seguridad (2026-10-13)

Ejecutado por API con las cuentas E2E (`b1-seguridad.cjs` en el scratchpad de la sesión). Solo
lecturas.

| Caso | Res. | Evidencia |
|---|---|---|
| J07 — RPC del ejecutivo solo admin | ✅ | Las 8 funciones (`exec_dashboard_kpis`, `_monthly_series`, `_instructor_hours`, `_receivables`, `_today_ops`, `exec_instructor_accrued_cost`, `_assert_admin`) devuelven `42501 forbidden: executive dashboard is admin-only` a visitante sin sesión, secretaria A, secretaria B, instructor y alumno, con y sin `p_branch_id` de otra sede. Al admin le devuelven datos |
| R05 — RLS por sede | ✅ | Secretaria A lee 0 `class_b_sessions`, 0 `payments`, 0 `enrollments` y 0 `expenses` de la sede 2; secretaria B, lo mismo de la sede 1. `audit_log`: cada una solo lee filas propias (un único `user_id`) |
| A03 — secretaria en `/app/admin/dashboard` | ✅ | Redirige a `/app/secretaria/dashboard` |

Observaciones fuera del módulo (sin track): `vehicles` es legible por todo el personal de ambas
sedes (política `select_vehicles`, por diseño desde `0004-m`); `enrollments` es legible completa
por cualquier instructor (política `select_enrollments`), y el portal Instructor está fuera del
piloto.

### Hallazgos preliminares (lectura de código + primera pasada en pantalla, 2026-10-13)

Pendientes de ejecutar caso por caso; cada uno va a su track.

| # | Caso | Hallazgo | Evidencia |
|---|---|---|---|
| H1 | I02 | El ejecutivo no cuenta como disponibles los vehículos con estado `available` | La RPC `exec_dashboard_today_ops` solo cuenta `operational`/`in_use`. El formulario de vehículo guarda `available` (`vehicle-form-drawer.component.ts:380,462`); 11 de 17 vehículos de dev lo tienen. Sede 1: ejecutivo 4, Flota y secretaria 9. DG-003 quedó desactualizada |
| H2 | K04, K10 / S5 | "Clases Hoy" y el chip "N clases programadas" cuentan canceladas | Secretaria A: KPI 17 y chip "17 clases programadas" con "Sin clases actuales"; las 17 de hoy están canceladas (`dashboard.facade.ts:143-148` no filtra estado) |
| H3 | K07 / S10 | "Ingresos Mes" se muestra `$0M` | Pantalla de secretaria A |
| H4 | E01 | El % de la tira del hero usa punto decimal ("97.1%") | Ejecutivo, "Nuevas matrículas"; las tarjetas grandes usan coma |
| H5 | C06 / S2 | Costo de instructores del mes en curso descontado dos veces | `exec_instructor_accrued_cost`: horas acumuladas a la fecha × fracción de días del mes |
| H6 | Q08 / S3 | "Ir a Cuadratura" navega fijo a la ruta de admin | `alerts-drawer.component.ts:226` |
| H7 | Q13 / S6 | "Cuota 2 vencida" filtra `payment_mode = 'deposit'` | `dashboard-alerts.facade.ts:587` |
| H8 | R02 / S7 | El dashboard de secretaria solo carga en `ngOnInit` | `secretaria-dashboard.component.ts:391-394` (el `effect` que hay es el de la animación) |
| H9 | O05 / S12 | El canal `dashboard-realtime` no se cierra al salir | El componente no llama `destroyRealtime()` |
| H10 | A09 / S15 | Un error de carga se ve como ceros | `fetchRealDashboardData` no mira el `error` de ninguna query |
| H11 | S13a | `DashboardAlertsFacade` sin guard de orden | No usa `createRequestGuard()` |
| H12 | Q14, Q15 / S14 | Alertas sin filtro de sede (asistencia Profesional, instructores sin liquidar) | `checkRedAttendance`, `checkYellowAttendance`, `checkPendingInstructorPayments` |
| H13 | M15 / S20 | Detalle de clase desde el dashboard con `classNumber: 0` | `secretaria-dashboard.component.ts:453` |

### Bloque 2 — Ejecutivo (2026-10-13, primera pasada en navegador)

Admin a 1440 × 900, datos del seed de dev (sin pagos Clase B en octubre). Los casos que comparan
montos contra datos sembrados (C01–C03, C10, D01–D07, E01–E07, H01–H05, I01) quedan para la suite
Playwright.

| Caso | Res. | Evidencia |
|---|---|---|
| A01 carga | ✅ | "Dashboard ejecutivo", "Este mes" (1 oct – 13 oct 2026), tab Tendencias, 7 RPC, consola y red limpias |
| A06 volver | ✅ | 0 skeletons al volver desde otra pantalla |
| A07 F5 | ✅ | Carga normal |
| B01 default | ✅ | Hero "Clase B · Todas las escuelas · 1 oct – 13 oct 2026" |
| B02 mes anterior | ✅ | 1 sep – 30 sep 2026; todo recalcula |
| B03 este año | ✅ | 1 ene – 13 oct 2026 |
| B04 una ronda | ✅ | Exactamente 7 RPC por cambio de preset (3 `exec_dashboard_kpis` + 4), sin skeleton |
| B05 personalizado | ✅ | 3–20 sep: sin RPC al elegir el inicio; al "Aplicar", 7 RPC una vez; período anterior 16 ago – 2 sep (mismo largo); la fila no se mueve |
| B06 cancelar | ✅ | El selector vuelve al preset vigente, 0 RPC |
| B07 solo inicio | ✅ | "3 sep 2026" y "Aplicar" habilitado |
| B11 salir y volver | ✅ (decisión) | El rango personalizado se conserva |
| B12 / S17b "Este año" | Obs. | "vs período anterior" y "vs año anterior" comparan contra el mismo tramo (1 ene – 13 oct 2025): dos líneas con el mismo dato |
| C08 resultado | ✅ | Sep: $2.640.000 − $758.500 = $1.881.500, margen 71,3 % |
| C09 sin ingresos | ✅ | Oct: "Resultado · margen sin ingresos", $0 |
| C11 saldo no cambia | ✅ | $6.450.000 · 47 alumnos en los tres presets |
| C12 tooltips | ✅ | Los 4; el de Gastos trae el desglose ($22.000 + $0 + $736.500 en septiembre) |
| D04 activos no cambia | ✅ | 132 en los tres presets |
| D08 sin clases | Obs. | Muestra "0 %" con "Sin clases en el período" |
| E01 formato | ❌→✅ | Punto decimal → `fix-400-m` |
| E03 gastos invertido | ✅ | Gastos ▼ 67,5 % en verde |
| E04 / E05 | ✅ | "Nuevo vs período anterior" / "Sin base el año anterior" |
| F01, F04 gráficos | ✅ | Ene–dic, 2026 hasta octubre, 2025 punteada |
| F03 mes en curso | ✅ | Serie de septiembre = $2.640.000 = Ingresos de "Mes anterior" |
| G01 instructores | ✅ | 18 filas, orden descendente, "196 clases · 147 h 0 min" = Clases realizadas de septiembre |
| H01, H04 | ✅ | Etapas 144 / 8 / 124 / 17 / 47 y cartera $630.000 · 3 + $5.820.000 · 44 = RPC |
| I02 vehículos | ❌ | 6 de 17 → `fix-397-m` |
| I03 | ✅ | La tira de hoy no cambia con el período |
| I05, I07 | ✅ | 5 alertas con ícono; "Ver todas" abre el drawer (7 alertas, orden error → advertencia → éxito) |
| J01 sedes | ✅ | Sep: 72 + 72 = 144 matrículas, 67 + 65 = 132 activos, $1.170.000 + $1.470.000 = $2.640.000, $3.600.000 + $2.850.000 = $6.450.000 |
| J02 cambio rápido | ✅ | 1 → 2 → 1 → 2: termina con los números de la sede 2, 0 skeletons |
| J03 | Obs. | El hero cambia de sede al instante y los números tardan 1–2,5 s, sin indicador de carga |
| J05, J06 | ✅ | Con `exec_dashboard_instructor_hours` bloqueada solo falla ese tab; "Reintentar" lo recupera. Con `exec_dashboard_kpis` bloqueada, mensaje y "Reintentar" en la zona de KPIs |
| J08 app-like | ✅ | El documento no scrollea (900 = 900) |
| J09 drawer | ✅ | La grilla pasa a `force-compact`, sin scroll horizontal |
| C06 / S2 | ❌ | → `fix-396-m` |

### Bloque 3 — Secretaria (2026-10-13, primera pasada)

| Caso | Res. | Evidencia |
|---|---|---|
| A02 carga | ✅ | Saludo, fecha, 4 KPIs, Clases Actuales, Actividad, Alertas; consola limpia |
| K01 | ✅ | "Martes, 13 de octubre de 2026 · ¡Bienvenido, Lola SECRETARIA!" |
| K04, K10 / S5 | ❌ | → `fix-398-m` |
| K07, K08 / S10 | ❌ | → `fix-399-m` |
| K02 / S8 | Decisión | Sede 2: secretaria 130 "Alumnos Activos" vs 65 del ejecutivo; los otros 65 son matrículas Profesional |
| K09 / S9 | ✅ parcial | Sede 1: 9 = Flota. No hay vehículos "ambas sedes" en dev para probar esa parte |
| Q08 / S3 | ❌ | → `fix-401-m` |
| Q13 / S6 | ❌ | → `fix-402-m` |
| R02 / S7 | ❌ | → `fix-403-m` y `fix-404-m` |
| O05 / S12 | ❌ | → `fix-403-m` |

Fuera del módulo (sin track): los KPI de Pagos (admin, secretaria, alumno) abrevian montos con
punto decimal (`1.5M`); es de `ASG-i-028`.

### Bloques 3 y 4 — segunda pasada, con los fixes aplicados (2026-10-13)

| Caso | Res. | Evidencia |
|---|---|---|
| A09 / S15 error de carga | ❌→✅ | Sin red mostraba 0 alumnos, $0, "Sin clases actuales" y una "Caja sin cerrar" falsa → `fix-405-m`. Ahora "No se pudo cargar el panel" + "Reintentar" |
| K04, K10 | ✅ | Con 3 clases válidas y 1 cancelada sembradas hoy: KPI y chip suben 3 (E2E) |
| K11 / S13c | ❌→✅ | Chip "6 alertas urgentes" con una alerta verde → `fix-412-m` |
| L01, L03, L05, L06 | ✅ | Cada acceso rápido abre su drawer: "Nueva Matrícula", "Registrar Pago", "Agenda Semanal", "Registrar Egreso" (E2E) |
| M01, M03 | ✅ | "Por Iniciar", "Finalizada", "No Asistió"; la cancelada no aparece (E2E) |
| M15, N01, N03 / S20 | ❌→✅ | Detalle sin "Clase N" → `fix-406-m`. Desde "Agenda de Hoy" ahora también permite deshacer la falta |
| O01, O02 | ✅ | Una clase sembrada desde otra sesión aparece "Por Iniciar" sin recargar; al cerrarla pasa a "Finalizada"; un pago de $25.000 sube "Ingresos Mes" ese monto (E2E) |
| O05 / S12 | ❌→✅ | `phx_join` al entrar, `phx_leave` al salir, `phx_join` al volver (E2E) |
| P01, P05 | ✅ | Actividad propia de la secretaria; "Ver toda la actividad" abre el drawer |
| Q05, Q14, Q15 / S14 | ❌→✅ | "Listos para certificar" 184 con 132 alumnos B activos; asistencia Profesional sin filtro de sede → `fix-410-m` |
| Q08 / S3 | ❌→✅ | Secretaria llega a `/app/secretaria/contabilidad/cuadratura` y el drawer se cierra (E2E) |
| Q11 / S18 | ❌→✅ | Texto "60 días sin pagar" para algo que mide antigüedad de matrícula → `hotfix-153-m` |
| Q02 / S18 (fecha UTC) | ✅ | Resuelto por `0024-m`: las alertas usan `todayIso()`, que es el día de Chile |
| Q13 / S6 | ❌→✅ | "9 matrículas con cuota 2 vencida" en la sede 1 (antes nunca aparecía) |
| Q19 | ✅ | Drawer ordenado error → advertencia → info → éxito, con "N alertas activas" (E2E) |
| R01, R02 / S7 | ❌→✅ | Multi-sede: "Todas" 197 alumnos / 17 vehículos → sede 2: 130 / 8 → sede 1: 67 / 9, sin salir (E2E) |
| R05 | ✅ | Ver bloque 1 |
| R06 / S19 | ❌→✅ | Datos del usuario anterior en la misma pestaña → `fix-409-m` (verificado con tests unitarios; en dev no hay dos secretarias con la misma sede activa) |
| S01 modo claro y oscuro | ✅ | Ambos dashboards legibles en los dos modos; sin colores fijos |
| S02 375 / 768 / 1440 px | ✅ | Sin scroll horizontal ni errores de consola en ningún tamaño, ambos dashboards; desktop no scrollea la página |
| S02 (observación) | Obs. | Secretaria a 1440 × 900: "Actividad reciente" y "Alertas Importantes" muestran una fila y media cada una (el resto con scroll), mientras "Clases Actuales" ocupa media pantalla aunque esté vacía |

**Dos hallazgos que no estaban en el checklist** salieron al correr la suite con 4 sesiones a la vez:

- Con eventos Realtime seguidos, ninguna carga del dashboard llegaba a aplicarse y la pantalla
  quedaba solo con el saludo → `fix-407-m`.
- La consulta de "Actividad reciente" tarda 2–4 s para un usuario con pocas acciones propias y da
  timeout con varias sesiones: la política RLS de `audit_log` evalúa sus funciones por fila →
  `fix-408-m`. Medido antes del fix: cargar 4 dashboards de secretaria a la vez deja **todas** las
  consultas en 12–16 s. Es un riesgo de rendimiento para el piloto más allá de este módulo.

### Tercera pasada — números del ejecutivo contra la BD y panel con clases sembradas (2026-10-13)

**Ejecutivo, septiembre 2026, cada sede.** Cada cifra se recalculó con una consulta escrita aparte
(`cross.sql` en el scratchpad) y se comparó con lo que devuelven las funciones `exec_dashboard_*`:

| Caso | Res. | Sede 1 | Sede 2 |
|---|---|---|---|
| C01 ingresos Clase B | ✅ | $1.170.000 | $1.470.000 |
| C02 no suman Profesional ni servicios | ✅ | $20.000 de servicios especiales fuera | $630.000 de pagos Profesional fuera |
| C05 egresos + fijos | ✅ | $2.000 + $0 | $20.000 + $0 |
| C05 sueldos devengados (mes sin liquidar: horas × tarifa) | ✅ | $361.000 | $375.500 |
| D01 nuevas matrículas | ✅ | 72 | 72 |
| D03 alumnos activos | ✅ | 67 | 65 |
| D05 clases realizadas | ✅ | 96 | 100 |
| D07 canceladas / inasistencias | ✅ | 347 / 128 | 326 / 128 |
| G02 horas de instrucción | ✅ | 4.320 min | 4.500 min (147 h en total) |
| C10, H04 cartera | ✅ | $3.600.000 · 25 alumnos | $2.850.000 · 22 alumnos |
| C07 mes liquidado | ✅ | No hay liquidaciones en dev; cubierto en el ensayo de `fix-396-m` (AC4) | |

**Secretaria, con 9 clases sembradas hoy** (exploración con Playwright, ya borrada):

| Caso | Res. | Evidencia |
|---|---|---|
| M02 orden | ✅ | Primero la sesión colgada de ayer, después por hora |
| M04 por iniciar con hora pasada | ✅ | "Debía iniciar hace 22 h" |
| M05 en curso atrasada | ✅ | "Atrasada · Cierre atrasado" |
| M06 colgada de ayer | ✅ | "12-oct · Día Anterior", borde rojo |
| M07 iniciar | ✅ | Drawer "Iniciar Clase Práctica" con clase, alumno, instructor y vehículo; ofrece "Marcar ausente" |
| M11, M13 finalizar | ✅ | Drawer "Finalizar Clase" con km de salida, firmas opcionales y "Cancelar inicio"; también para la colgada de ayer |
| M18 tablet | ✅ | 4 clases + "Ver toda la agenda" |
| N01, N02 | ✅ | "Agenda de Hoy" con las 9; iniciar desde ahí abre el drawer encima |
| L08 egreso dos veces | ✅ | "Combustible" preseleccionado las dos veces |
| P03 textos de actividad | ❌→✅ | "Absence Penalty Applied At" → `fix-413-m`. Sin "undefined" |
| P05 | ✅ | Drawer con el historial; el dashboard pasa a modo compacto sin romperse |
| Q16 descartar | ✅ | Desaparece y sigue oculta al recargar |
| Q17, Q18 / S13b | ❌→✅ | El descarte no distinguía usuario ni casos nuevos → `fix-415-m` |
| S05 teclado | ❌→✅ | Las clases no recibían foco → `fix-414-m` |
| S06 | ✅ | Los botones "X" de alertas tienen `aria-label` y tooltip "Descartar" |

### Casos no ejecutados

Quedaron sin ejecutar en pantalla; no se encontró nada al leer su código:

- Ejecutivo: B08–B10 (fechas futuras, cruce de año, medianoche), C13 (montos > $10 M), D02, D06,
  D09, E02, E06, E07, F02, F05–F07, G03, G04, H02, H03, H05, I01, I04, I08.
- Secretaria: K03, K06, K12, L02, L04, L07, L09, M08–M10 (decididos en `fix-366-m`), M12, M14,
  M16, M17, M19, N04, O03, O04, O06, P02, P04, P06–P10, Q01, Q03, Q04, Q06, Q09, Q12, R03, R04,
  R07, S03, S04, S07.

M12 (km final ≤ inicial) y el flujo completo de iniciar/finalizar están cubiertos por
`e2e/asistencia-clase-b.spec.ts`.

### Segunda pasada (2026-10-14, con las migraciones aplicadas)

| Caso | Res. | Evidencia |
|---|---|---|
| B08 | ✅ | Calendario: del 15 en adelante deshabilitado |
| B09, E02, E06, E07, F05, F07, H03 | ✅ | Tests de `executive-dashboard.utils.spec.ts` (cruce de año, base negativa, mismo tramo, enero → año anterior, meses sin filas, ensayos sin datos); serie 2019 = 24 filas en 0 |
| B10 / S17a | ❌→✅ | Con la pestaña abierta pasada la medianoche no se podía elegir el día nuevo → `fix-418-m` |
| C13 | ✅ | Montos con `toLocaleString('es-CL')`; $6.450.000 cabe con holgura |
| D02 | ✅ | 23:30 del 30-sep hora Chile → `2026-09-30` |
| D06 | ✅ | "En agenda" = 0 en el mes y en septiembre, igual que la BD |
| D09 | ✅ | Inasistencias de septiembre 128 = filas `absent` (incluye archivadas) |
| F02 | ✅ | Tooltip "Sep 2026: $2.640.000 / 2025: $0"; diciembre "—" |
| F06 | ✅ | El gráfico solo usa tokens (`--color-primary`, `--text-muted`, `--border-subtle`) |
| G03 | ✅ | El roster suma a quien tuvo clases (UNION); hoy no hay inactivos con clases |
| G04, I08 | ✅ | Estados vacíos "Sin instructores activos" y "Todo en orden" en el código |
| H02 | ✅ | "Pendientes de examen" 62 = activas con certificado habilitado, por sede |
| H05 | ✅ | Cuenta alumnos distintos por tramo: sede 1 tiene 26 matrículas con saldo de 25 alumnos y muestra 25 |
| I01 | ✅ | Hoy sin clases: 0/0/0 igual que la BD; 18 instructores, 17 vehículos |
| K03 | ❌→✅ | "Nuevos últ. 7 días" contaba 8 días → `hotfix-155-m` |
| K06 | ✅ | Ayer 17 canceladas, hoy 0: tendencia 0 (las canceladas no cuentan) |
| M17 | ✅ | "Sin clases actuales" |
| Q01 | ❌→✅ | Documentos de vehículos de "ambas sedes" no avisaban en la otra sede → `hotfix-156-m` |
| Q03, Q04, Q12, Q13 | ✅ | Sede 1: 22 pagos pendientes, 11 en 6ª clase, 9 con cuota 2 vencida, 0 pagos hoy: iguales a la BD |
| S03 | ✅ | 375 px: el filtro trunca "1 oct – 1…" sin desbordar |
| S04 | ❌→✅ | Tabs solo con ícono y `title` a 375 px (diseño de `app-tabs`); las etiquetas de "Operación de hoy" se cortaban → `hotfix-154-m` |
| S07 | ✅ | `gridAnimated` anima una sola vez |
| O03 / L02 | ❌→✅ | El canal Realtime del dashboard de secretaria no escuchaba `enrollments`, `special_service_sales` ni `vehicles`: activar una matrícula no cambiaba "Alumnos Activos" hasta recargar → `fix-419-m` |

| K12 | ✅ | 768 y 375 px: los 4 KPIs legibles, sin scroll horizontal |
| L04 / O06 | ❌→✅ | Un pago subía "Ingresos Mes" pero las alertas ("pagos registrados hoy", "pagos pendientes") y el chip seguían igual hasta salir y volver → `fix-420-m` |
| L07 | ✅ | Egreso "Gastos varios" de $1.234 desde el dashboard: aparece en Caja Diaria del día (efectivo). Borrado después |
| L09 | ✅ | Solo "Matricular" y "Registrar Pago" van rellenos con el color de marca; "Agenda" y "Registrar Egreso" son secundarios |
| M14 | ✅ | E2E `M14 · M16`: finalizar desde "Clases Actuales" deja `vehicles.current_km` en el km de retorno |
| M16 | ✅ | Mismo E2E: con la escritura cortada, "No se pudo finalizar la clase…" dentro del drawer, que sigue abierto; al reintentar con red, finaliza |
| N04 | ✅ | El drawer no se actualiza solo, pero no pisa el inicio de otra persona: avisa "ya fue iniciada" al confirmar (`fix-388-m`, E2E N03 de asistencia; es el mismo drawer) |
| O04 | ✅ | E2E: una matrícula activada en la sede B no cambia "Alumnos Activos" de la secretaria A; la de su sede sí (+1, no +2) |
| P04 | ✅ | Hoy "12:31"; días anteriores `formatChileDate` con día, mes corto y hora |
| P06 | ❌→✅ | Abre la ficha del alumno correcto (2824) y cierra el drawer, pero los eventos no se alcanzaban con el teclado → `fix-421-m` |
| P07, P08 | ✅ | Pagos → `/app/{rol}/pagos`; DELETE o alumno ya borrado: sin rol de botón ni foco (test de `fix-421-m`; los 50 eventos de la secretaria de prueba eran de datos E2E borrados y ninguno quedó clicable) |
| P09 | ✅ | Una matrícula Profesional lleva a `/app/secretaria/alumnos/:id`, la misma ficha (`AdminAlumnoDetalleComponent`) que muestra ambos cursos; esa ruta no está bloqueada en el piloto |
| P10 | ✅ | "Sin actividad reciente" en el panel y "No hay actividad reciente para mostrar." en el drawer |
| Q06 | ✅ | Solo cuenta faltas registradas (`absent`/`no_show`) vigentes de matrículas activas: una clase de hoy sin marcar no cuenta (`fix-364-m`, `fix-391-m`) |
| Q09 | ✅ | Al volver al dashboard `initialize()` refresca las alertas: la de caja desaparece con el cierre |
| R03 | ✅ | E2E: en "Todas", "Alumnos Activos" = sede 1 + sede 2 según la BD |
| R04 | ✅ | No se puede producir desde la app: `create-secretary` y `update-secretary` exigen sede, y hoy ninguna secretaria está sin sede. Si pasara, `resolveBranchScope` usa la sede `-1` y las 17 revisiones de alertas filtran por ella |
| R07 | ❌→✅ | Al quitarle el acceso con "Todas" elegida, el selector desaparecía pero seguía viendo las dos sedes (197 en vez de 67) → `fix-422-m` |

Todos los casos del checklist quedaron ejecutados. M19 es una pregunta (ver "Pendientes de Matías").

## Decisiones de negocio

Decididas por Matías el 2026-10-14:

| Caso | Pregunta | Decisión |
|---|---|---|
| K02 / S8 | ¿"Alumnos Activos" de secretaria cuenta solo Clase B? | Cuenta B y Profesional si la sede tiene ambos: sin cambio |
| Q15 / S14 | ¿Se muestran alertas de Clase Profesional durante el piloto? | No, mientras sus vistas estén bloqueadas → `fix-416-m` |
| Q14 | ¿"Instructores sin liquidar" revisa el mes en curso o el anterior? | El mes anterior → `fix-417-m` |
| C04 / S11 | ¿El Resultado resta solo gastos de Clase B? | Lo cubre `ASG-i-061` (después del piloto): sin cambio |
| P02 | ¿La secretaria ve la actividad de toda su sede? | Solo sus propias acciones, por ahora |
| I04 | ¿"Operación de hoy" del ejecutivo en tiempo real? | No: se actualiza al recargar o cambiar de sede |
| I06 / Q20 | ¿Las alertas llevan a su módulo? | Sí, después del piloto. Hoy solo "Caja sin cerrar" navega |
| Q10 | "Caja sin cerrar" con "Todas" | Decir explícitamente qué sede falta por cerrar, o que faltan ambas → `fix-423-m` |
| D08 | Sin clases en el período | "—" en vez de "0 %" → `fix-425-m` |
| A04 | ¿El admin necesita "Clases Actuales" y "Registrar Egreso"? | No: sin cambio |
| L10 | Sede de un pago o egreso de una secretaria multi-sede en "Todas" | Revisado, sin cambio: el pago no tiene sede propia (va a la de su matrícula) y el egreso la saca del vehículo (combustible) o del instructor (anticipo), y en "gastos varios" la exige (`fix-243-m`). Obs.: el combustible de un vehículo de "ambas sedes" va a su sede de origen |
| S02 (obs.) | "Actividad" y "Alertas" con fila y media a 1440 × 900 | Aceptable: sin cambio |
| M19 | ¿Basta el primer nombre en "Clases Actuales"? | No: el Nº de matrícula es lo principal, por sobre el nombre → `fix-424-m` |
| J03 (obs.) | Números viejos 1–2,5 s al cambiar de sede en el ejecutivo | Mostrar un indicador de carga → `fix-427-m` |
| H05 / Q03 / S16 | Número oficial de "alumnos con saldo" | Todo el saldo pendiente, incluidos egresados, en todos lados (propuesta de Matías) → `fix-428-m` (migración `20261014120000` aplicada y verificada). Base B "Con deuda" sin cambio: es la lista de alumnos vigentes |
| B12 / S17b | "Este año": dos comparaciones contra el mismo tramo, y en enero contra diciembre | Una sola, siempre "vs año anterior", también en enero → `fix-426-m` |

Decididas sin consultar, por ser la lectura obvia (se pueden revertir):

- K08: "Ingresos Mes" en pesos completos y comparado con el mismo tramo del mes anterior, como el
  ejecutivo (`fix-399-m`).
- K11: el chip "alertas urgentes" cuenta solo errores y advertencias (`fix-412-m`).
- Q13: "cuota 2 vencida" = clase 7+ tomada con saldo, cualquier modalidad, alineado con `0010-i`
  (`fix-402-m`).
- M08, M09, M10: resueltas en `fix-366-m` (C04, C06, C08).
- B11: el rango personalizado se conserva al salir y volver.

## Rendimiento (para el piloto)

Medido el 2026-10-13 contra la BD de dev: un dashboard de secretaria hace unas 34 consultas. Con
una sesión carga en 3–6 s; con 4 cargando a la vez, todas las consultas tardan 12–16 s y aparecen
timeouts (`57014`), también al sembrar y limpiar datos en otras suites E2E. `fix-408-m` quita la
consulta más cara y `fix-407-m` evita recargas en cadena, pero el dashboard sigue siendo caro: si
la BD de producción es del mismo tamaño, conviene medirlo con la migración aplicada.

## Progreso

- [x] Bloque 1 — Seguridad
- [x] Bloque 2 — Ejecutivo
- [x] Bloque 3 — Secretaria
- [x] Bloque 4 — Alertas, sedes y visual
- [x] Capa Playwright (`e2e/dashboards.spec.ts`, 22 tests)
- [x] Matías aplicó las 4 migraciones (2026-10-14), verificadas en la BD de dev
- [x] Decisiones de negocio principales (K02, Q14, Q15, C04, P02); quedan las menores de la tabla
- [x] Casos no ejecutados: segunda pasada terminada (2026-10-14), ver "Segunda pasada"

## ACs Afectados

- Ninguno propio: este track verifica ACs de `0044-b` y de los fixes citados arriba.

## Regression Test

- Suite `e2e/dashboards.spec.ts` (22 tests: casos "Auto ✓" del checklist y regresión de los fixes 396 a 415).
- Con `e2e/asistencia-clase-b.spec.ts` en paralelo: 43 en verde. Hasta aplicar `fix-408-m`, la BD de
  dev puede responder con timeout al sembrar o limpiar cuando corren varias suites a la vez.
- Con las migraciones aplicadas (2026-10-14): dashboards 20 + 2 saltados; asistencia 26 + 1; las dos
  juntas 42 + 3 saltados, 0 fallos. Los 2 tests que siembran clases de hoy ya ocurridas se saltan
  antes de las 07:00 hora Chile (`saltarDeMadrugada()`): `seedClase` las pone entre la 01:00 y las
  06:59 y de madrugada todavía son futuras.
- Segunda pasada (2026-10-14, 13:00 hora Chile): la suite suma O03 · L02, L04 · O06, O04, R03, R07 y
  M14 · M16. Corrida completa con un worker: 24/24, sin saltados (4 de sesión aparte). Unit de
  facades y dashboards: 1845/1845. `--repeat-each` necesita `--workers=1`: dos copias del mismo
  test siembran la misma hora y chocan.

## Tracks generados

| Track | Caso / sospecha | Estado |
|---|---|---|
| `fix-396-m-ejecutivo-costo-instructores-mes-en-curso` | C06 / S2 (H5) | Cerrado · migración aplicada |
| `fix-397-m-ejecutivo-vehiculos-disponibles-estado-available` | I02 (H1) | Cerrado · migración aplicada |
| `fix-398-m-clases-hoy-secretaria-cuenta-canceladas` | K04, K06, K10 / S5 (H2) | Cerrado |
| `fix-399-m-ingresos-mes-secretaria-formato-y-comparacion` | K07, K08 / S10 (H3) | Cerrado |
| `fix-400-m-porcentajes-kpi-con-punto-decimal` | E01 (H4) | Cerrado |
| `fix-401-m-ir-a-cuadratura-segun-rol` | Q08 / S3 (H6) | Cerrado |
| `fix-402-m-alerta-cuota-2-vencida-nunca-se-dispara` | Q13 / S6 (H7) | Cerrado |
| `fix-403-m-dashboard-secretaria-no-sigue-sede-ni-cierra-realtime` | R02, O05 / S7, S12 (H8, H9) | Cerrado |
| `fix-404-m-dashboard-secretaria-cargas-fuera-de-orden` | R02 / S13a (H11) | Cerrado |
| `fix-405-m-dashboard-secretaria-error-de-carga-como-ceros` | A09 / S15 (H10) | Cerrado |
| `fix-406-m-detalle-de-clase-desde-dashboard-incompleto` | M15, N03 / S20 (H13) | Cerrado |
| `fix-407-m-dashboard-secretaria-sin-datos-con-eventos-seguidos` | A02, O01, O02 (nuevo, visto en la suite E2E) | Cerrado |
| `fix-408-m-actividad-reciente-lenta-rls-audit-log` | A02, P01 (nuevo, visto en la suite E2E) | Cerrado · migración aplicada |
| `fix-409-m-dashboard-secretaria-datos-del-usuario-anterior` | R06 / S19 | Cerrado |
| `fix-410-m-alertas-con-alcance-equivocado` | Q05, Q14, Q15 / S14 (H12) | Cerrado |
| `fix-411-m-kpi-vehiculos-secretaria-sin-ambas-sedes` | K09 / S9 | Cerrado |
| `fix-412-m-chip-alertas-urgentes-cuenta-informativas` | K11 / S13c | Cerrado |
| `hotfix-153-m-textos-de-los-dashboards` | Q11, H06, G04 / S17c, S18 | Cerrado |
| `fix-413-m-actividad-columnas-nuevas-sin-etiqueta` | P03 | Cerrado · migración aplicada |
| `fix-414-m-clases-actuales-sin-teclado` | S05 | Cerrado |
| `fix-415-m-descartar-alerta-oculta-casos-nuevos` | Q16–Q18 / S13b | Cerrado |
| `fix-416-m-alertas-de-vistas-bloqueadas-en-el-piloto` | Q15 / S14 (decisión) | Cerrado |
| `fix-417-m-instructores-sin-liquidar-revisa-el-mes-en-curso` | Q14 (decisión) | Cerrado |
| `fix-418-m-ejecutivo-calendario-no-avanza-al-cambiar-de-dia` | B10 / S17a | Cerrado |
| `hotfix-154-m-operacion-de-hoy-etiquetas-cortadas-en-movil` | S04 | Cerrado |
| `hotfix-155-m-nuevos-ultimos-7-dias-cuenta-8` | K03 | Cerrado |
| `hotfix-156-m-alerta-documentos-sin-vehiculos-de-ambas-sedes` | Q01 | Cerrado |
| `fix-419-m-dashboard-secretaria-realtime-sin-matriculas` | O03, L02 | Cerrado |
| `fix-420-m-alertas-del-dashboard-no-siguen-el-tiempo-real` | L04, O06 | Cerrado |
| `fix-421-m-actividad-reciente-sin-teclado` | P06–P08 | Cerrado |
| `fix-422-m-revocar-ambas-sedes-no-recarga-con-todas` | R07 | Cerrado |
| `fix-423-m-caja-sin-cerrar-dice-que-sede` | Q10 (decisión) | Cerrado |
| `fix-424-m-clases-actuales-sin-numero-de-matricula` | M19 (decisión) | Cerrado |
| `fix-425-m-cancelacion-sin-clases-muestra-guion` | D08 (decisión) | Cerrado |
| `fix-426-m-este-anio-una-sola-comparacion` | B12 (decisión) | Cerrado |
| `fix-427-m-ejecutivo-sin-indicador-al-recargar` | J03 (decisión) | Cerrado |
| `fix-428-m-saldo-pendiente-mismo-criterio` | H05, Q03 / S16 (decisión) | Cerrado · migración aplicada |

### Migraciones (aplicadas por Matías el 2026-10-14)

| Archivo | Fix |
|---|---|
| `20261013160000_fix396_exec_costo_instructores_mes_en_curso.sql` | `fix-396-m` |
| `20261013161000_fix397_exec_today_ops_vehiculos_available.sql` | `fix-397-m` |
| `20261013162000_fix408_audit_log_policy_initplan.sql` | `fix-408-m` |
| `20261013163000_fix413_audit_humanize_columnas_nuevas.sql` | `fix-413-m` |
| `20261014120000_fix428_exec_receivables_alumnos_total.sql` | `fix-428-m` (aplicada el 2026-10-14) |

Las cuatro se ensayaron contra la BD de dev en una transacción que se revierte.
