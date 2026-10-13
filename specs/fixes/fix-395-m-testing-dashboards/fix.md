# Fix: Testing — Dashboards (admin ejecutivo y secretaria)
> id: fix-395-m-testing-dashboards
> refs: ASG-i-030
> status: in_progress
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

## Decisiones de negocio

<!-- Preguntas de §5 del checklist y la respuesta de Matías -->

## Progreso

- [ ] Bloque 1 — Seguridad
- [ ] Bloque 2 — Ejecutivo
- [ ] Bloque 3 — Secretaria
- [ ] Bloque 4 — Alertas, sedes y visual
- [ ] Capa Playwright (`e2e/dashboards.spec.ts`)

## ACs Afectados

- Ninguno propio: este track verifica ACs de `0044-b` y de los fixes citados arriba.

## Regression Test

- Suite `e2e/dashboards.spec.ts` (casos "Auto ✓" del checklist).

## Tracks generados

| Track | Caso / sospecha | Estado |
|---|---|---|
| `fix-396-m-ejecutivo-costo-instructores-mes-en-curso` | C06 / S2 (H5) | Cerrado · migración por aplicar |
| `fix-397-m-ejecutivo-vehiculos-disponibles-estado-available` | I02 (H1) | Cerrado · migración por aplicar |
| `fix-398-m-clases-hoy-secretaria-cuenta-canceladas` | K04, K06, K10 / S5 (H2) | Cerrado |
| `fix-399-m-ingresos-mes-secretaria-formato-y-comparacion` | K07, K08 / S10 (H3) | Cerrado |
| `fix-400-m-porcentajes-kpi-con-punto-decimal` | E01 (H4) | Cerrado |
| `fix-401-m-ir-a-cuadratura-segun-rol` | Q08 / S3 (H6) | Cerrado |
| `fix-402-m-alerta-cuota-2-vencida-nunca-se-dispara` | Q13 / S6 (H7) | Cerrado |
| `fix-403-m-dashboard-secretaria-no-sigue-sede-ni-cierra-realtime` | R02, O05 / S7, S12 (H8, H9) | Cerrado |
| `fix-404-m-dashboard-secretaria-cargas-fuera-de-orden` | R02 / S13a (H11) | Cerrado |
