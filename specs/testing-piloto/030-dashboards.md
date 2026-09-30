# Testing — Dashboards (admin ejecutivo y secretaria)

> **Asignación:** `ASG-i-030` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** `/app/admin/dashboard` (Dashboard Ejecutivo, spec `0044-b`), `/app/secretaria/dashboard`
> **Incluye:** dashboard ejecutivo completo (filtro de período con presets y rango personalizado,
> comparación vs período anterior y año anterior, 8 KPIs, tabs Tendencias / Instructores / Alumnos y
> cartera / Operación de hoy, alertas), dashboard de secretaria (KPIs del hero, accesos rápidos
> Matricular / Registrar Pago / Agenda / Registrar Egreso, "Clases Actuales" con iniciar/finalizar
> clase, "Actividad reciente", "Alertas Importantes"), drawers "Agenda de Hoy", "Actividad
> Reciente" y "Todas las Alertas", tiempo real, cambio de sede y grant multi-sede.
> **No incluye:** dashboards de instructor y alumno (portales fuera del piloto), los flujos por
> dentro de Matrícula (`023`), Registrar Pago (`028`), Registrar Egreso/Cuadratura (`029`) y
> Asistencia B (`027`): aquí solo se prueba que se abren bien desde el dashboard y que su efecto
> se refleja en los números.
>
> **Código leído para armar esta lista:**
> `features/dashboard/dashboard.component.ts` (+ `.scss`),
> `features/dashboard/{alerts-drawer,daily-agenda-drawer,recent-activity-drawer}/`,
> `features/secretaria/dashboard/secretaria-dashboard.component.ts`,
> `core/facades/{dashboard,executive-dashboard,dashboard-alerts}.facade.ts`,
> `core/utils/{executive-dashboard,live-class-action,branch-scope,class-b-session,vehicle-status,date}.utils.ts`,
> `shared/components/{exec-period-filter,live-classes-panel,today-ops-strip,receivables-aging-panel,student-stages-panel,instructor-hours-table,line-comparison-chart,section-hero}/`,
> `features/admin/asistencia/admin-{iniciar,finalizar}-clase-drawer.component.ts`,
> `features/agenda/agenda-slot-detail-drawer.component.ts`,
> `supabase/migrations/20260927120000_executive_dashboard_rpcs.sql`,
> `supabase/migrations/20260825210000_audit_log_secretaria_lee_propias_acciones.sql`,
> `supabase/migrations/20260827160000_enable_realtime_students_payments.sql`,
> spec `0044-b` (28 ACs), `fix-172-b`…`fix-176-b`, `fix-227-m`, `fix-029-m`, `fix-006-i`, `ASG-b-018`,
> `indices/DOMAIN-GOTCHAS.md` (DG-003, DG-004, DG-050, DG-071, DG-075), `docs/UAT-PLAN.md` Paquete 4.

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-030`, y **cada bug va a su
  propio fix/hotfix**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`).
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S20)** salen de leer el código, **no están confirmadas** en navegador.
  Confirmarlas o descartarlas es parte del trabajo.
- **Ojo, son dos pantallas distintas.** Desde spec `0044-b`, el dashboard de admin es el
  **ejecutivo** (sin "Clases Actuales" ni accesos rápidos, AC20) y usa `ExecutiveDashboardFacade`
  + funciones SQL `exec_dashboard_*`. El de secretaria es el "operativo" y usa `DashboardFacade`
  con queries directas. **Cada uno define "alumnos activos", "clases de hoy", etc. de forma
  distinta**; varios casos comparan ambos contra su módulo de origen.
- Conviene correr este módulo **al final** de la tanda: los KPIs se validan mejor cuando los otros
  módulos ya generaron datos conocidos.

### Cómo se calcula cada número (referencia rápida)

| Pantalla | Número | Cómo se calcula hoy (código) |
|---|---|---|
| Ejecutivo | Ingresos Clase B | Σ `payments.total_amount`, `status IN ('paid','completado')`, `payment_date` en el período, matrícula `license_group='class_b'` de la sede |
| Ejecutivo | Gastos | `expenses.amount` + `fixed_expenses.amount` (por `date`, de la sede, **todos los cursos**) + costo devengado de instructores (liquidación pagada, o horas × tarifa de la sede), prorrateado por días del mes |
| Ejecutivo | Resultado · margen | Ingresos − Gastos; margen = resultado / ingresos ("sin ingresos" si 0) |
| Ejecutivo | Saldo por cobrar | Σ `pending_balance > 0` de matrículas B no `draft/cancelled/pending_payment` (incluye `completed`); foto de hoy |
| Ejecutivo | Nuevas matrículas | Matrículas B con `created_at` (hora Chile) en el período, no `draft/cancelled/pending_payment` |
| Ejecutivo | Alumnos activos | Matrículas B `status='active'` (foto de hoy) |
| Ejecutivo | Clases realizadas / en agenda | `completed` por `completed_at` en el período / `scheduled` desde ahora hasta el fin del período |
| Ejecutivo | Cancelación e inasistencia | (canceladas por `cancelled_at` + asistencias `absent` por `recorded_at`) / (realizadas + canceladas + inasistencias) |
| Ejecutivo | Operación de hoy | Sesiones B de hoy (Chile) sin `reserved`: programadas = no canceladas/no_show; instructores activos (incl. ambas sedes); vehículos `operational/in_use` y `maintenance` (incl. ambas sedes) |
| Secretaria | Alumnos Activos | `count(enrollments)` con `status='active'` de **cualquier curso** (B y Profesional) de la sede; tendencia = creadas últimos 7 días |
| Secretaria | Clases Hoy | `count(class_b_sessions)` con `scheduled_at` entre `HOY T00:00:00` y `HOY T23:59:59` **sin zona** y **sin filtro de estado**; tendencia = vs ayer |
| Secretaria | Ingresos Mes | Σ `payments.total_amount` con `payment_date >= día 1` (sin filtro de estado ni curso) ÷ 1.000.000; tendencia % vs mes anterior **completo** |
| Secretaria | Vehículos | Vehículos de la sede (`branch_id` exacto) con estado "disponible"; subtítulo "Total flota: N" |
| Secretaria | Clases Actuales | Sesiones de hoy `scheduled/in_progress/completed/no_show` de matrículas activas + sesiones `in_progress` colgadas de días anteriores |

---

## 1. Sospechas de bug encontradas en el código

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🔴 Alta | **"Borrar horarios" cancela clases en masa sin confirmación.** La alerta "N alumnos con 2+ clases sin asistir" trae un botón que, con un clic y sin diálogo, pone `status='cancelled'` a **todas** las sesiones `scheduled` (pasadas **y futuras**) de todas las matrículas afectadas. No registra motivo ni `cancelled_at`, no avisa con toast ni pide confirmar. Además, el criterio "2+ sesiones `scheduled` con hora ya pasada" incluye clases de hoy que simplemente aún no se marcan (p. ej. la de las 9:00 a las 10:30). | `dashboard-alerts.facade.ts:126-140,347-389`; `alerts-drawer.component.ts:127-133,208-220` |
| S2 | 🟠 Media-Alta | **Gastos del mes en curso subestimados → Resultado inflado.** "Este mes" va del 1 a hoy; el costo de instructores de un mes no liquidado se calcula con las horas **acumuladas hasta hoy** y además se prorratea por la fracción de días del mes (día 10 de 30 → × 1/3). Se descuenta dos veces el avance del mes. | `migrations/20260927120000_executive_dashboard_rpcs.sql:81-86,97-101`; `executive-dashboard.utils.ts:101-102`; `indices/DATABASE.md:137` (horas = recuento a la fecha) |
| S3 | 🟠 Media | **"Ir a Cuadratura" lleva a la secretaria a una ruta de admin.** El botón de la alerta "Caja sin cerrar" navega fijo a `/app/admin/contabilidad/cuadratura`; la secretaria tiene su propia ruta `/app/secretaria/contabilidad/cuadratura`. Resultado probable: acceso denegado. | `alerts-drawer.component.ts:226-231`; `indices/ROUTES.md:49,83` |
| S4 | 🟠 Media | **"Clases Hoy" y "Clases Actuales" de secretaria usan el día UTC, no el de Chile.** Filtran `scheduled_at` con `HOY T00:00:00`–`T23:59:59` sin zona; PostgREST lo interpreta en UTC. Las clases desde ~20:00/21:00 (hora Chile) no aparecen hoy y las de anoche a esa hora sí. Es exactamente DG-071. | `dashboard.facade.ts:112,144-148,151-155,392-396`; `indices/DOMAIN-GOTCHAS.md` DG-071 |
| S5 | 🟠 Media | **KPI "Clases Hoy" cuenta canceladas y reservas.** La query del KPI no filtra estado (incluye `cancelled` y `reserved` de matrículas en borrador), mientras el panel "Clases Actuales" sí filtra. El chip "N clases programadas" usa el mismo número. Tampoco filtra matrícula activa. | `dashboard.facade.ts:144-148,239-240` vs `:397-398`; DG-050 |
| S6 | 🟠 Media | **La alerta "cuota 2 vencida" nunca se dispara.** Filtra `payment_mode = 'deposit'`, valor que no existe en producción (el real es `'partial'`). | `dashboard-alerts.facade.ts:484-491`; DG-004 |
| S7 | 🟡 Baja-Media | **Secretaria con grant multi-sede: el dashboard no recarga al cambiar de sede.** Solo carga en `ngOnInit`; el de admin sí tiene `effect` sobre la sede. Los KPIs, clases y alertas quedan de la sede anterior hasta salir y volver (o hasta que un evento Realtime refresque solo parte). | `secretaria-dashboard.component.ts:390-393` vs `dashboard.component.ts:361-367` |
| S8 | 🟡 Baja-Media | **"Alumnos Activos" de secretaria no coincide con la Base de Alumnos B.** Cuenta matrículas activas de cualquier curso (incluye Profesional) y cuenta matrículas, no alumnos (un alumno con 2 matrículas activas cuenta 2). La Base B y el KPI ejecutivo solo cuentan Clase B. | `dashboard.facade.ts:131-135` vs `admin-alumnos.facade.ts:74` y `migrations/20260927120000…:218` |
| S9 | 🟡 Baja-Media | **KPI "Vehículos" de secretaria excluye los vehículos "ambas sedes".** Filtra `branch_id` exacto; Flota y "Operación de hoy" del ejecutivo sí incluyen `both_branches`. Además un estado desconocido o `null` cuenta como disponible. | `dashboard.facade.ts:173-174,281`; `flota.facade.ts:165`; `migrations/20260927120000…:463`; `vehicle-status.utils.ts:17` |
| S10 | 🟡 Baja | **"Ingresos Mes" mal formateado y comparado injustamente.** Se muestra como `$0.845M` (punto decimal, sin redondeo: `$1.234567M`), y el % compara el mes **parcial** contra el mes anterior **completo** (a principio de mes casi siempre sale rojo). Tendencia 0 no se muestra. No filtra estado de pago ni curso (incluye Profesional). | `dashboard.facade.ts:159-169,215-220,269-273`; `section-hero.component.ts:609,611` |
| S11 | 🟡 Baja | **Resultado operacional mezcla alcances.** Ingresos son solo Clase B, pero egresos y gastos fijos son de toda la sede (incluidos los de Profesional/servicios). El costo de un instructor "ambas sedes" se carga completo a su sede de origen. | `migrations/20260927120000…:148-166,104-112` |
| S12 | 🟡 Baja | **El canal Realtime del dashboard de secretaria nunca se cierra.** No hay `destroyRealtime()` al salir; el canal escucha `students`, `class_b_sessions` y `payments` **de todas las sedes**, y cada evento dispara ~10 queries en segundo plano aunque la secretaria esté en otra pantalla. | `dashboard.facade.ts:31-59`; `secretaria-dashboard.component.ts:390-393` (sin `onDestroy`) |
| S13 | 🟡 Baja | **Alertas: sin guard de orden, "descartar" demasiado amplio y chip engañoso.** (a) `DashboardAlertsFacade` no usa `createRequestGuard()`: al cambiar de sede rápido pueden quedar las alertas de otra sede. (b) Descartar guarda el id fijo de la alerta 24 h en `localStorage` del navegador (no del usuario): un documento **nuevo** vencido dentro de esas 24 h no se ve, y otro usuario en el mismo PC tampoco la ve. (c) El chip "N alertas urgentes" cuenta también las de tipo éxito/info ("pagos registrados hoy"). | `dashboard-alerts.facade.ts:77-95,113-119,144-170`; `secretaria-dashboard.component.ts:344-350` |
| S14 | 🟡 Baja | **Alertas de Clase Profesional y de otras sedes en el piloto.** P-1…R-6 se muestran aunque Profesional está oculto en el piloto; "asistencia en rojo/amarillo" (R-1/R-2) e "instructores sin liquidar" (F-5) **no filtran sede**. F-5 además aparece todo el mes, porque el mes en curso nunca está liquidado. | `dashboard-alerts.facade.ts:517-550,557-632,641-681`; `app.routes.ts:133` (`pilotPhaseGuard('clase-profesional-recorte')`) |
| S15 | 🟡 Baja | **Un error de carga en el dashboard de secretaria se ve como ceros.** El facade ignora el `error` de cada query y el componente nunca lee `error()`: con red cortada o RLS fallando se ven KPIs en 0 y "Todo en orden". | `dashboard.facade.ts:187-214`; `secretaria-dashboard.component.ts` (no usa `error`) |
| S16 | 🟡 Baja | **"Con saldo" no cuadra entre pantallas.** Cartera del ejecutivo: incluye matrículas `completed` y `pending_docs`, y el nº de alumnos se suma por tramo (un alumno con 2 matrículas en tramos distintos cuenta 2). Alerta "Pagos pendientes": solo `active`, todos los cursos. Base B "Con deuda": solo la matrícula B más reciente. | `migrations/20260927120000…:402-417`; `executive-dashboard.utils.ts:351`; `dashboard-alerts.facade.ts:261-267` |
| S17 | 🟡 Baja | **Fechas fijas o raras en el ejecutivo.** (a) `today` se calcula una sola vez al crear el componente: si la pestaña queda abierta pasada la medianoche, el calendario no deja elegir el día nuevo. (b) "Este año" en enero se compara con diciembre (desde febrero, con el año anterior). (c) Con "Todas las sedes", los textos vacíos dicen "en esta sede". | `dashboard.component.ts:317`; `executive-dashboard.utils.ts:144-147`; `receivables-aging-panel.component.ts:53` |
| S18 | 🟡 Baja | **Alertas con fecha UTC o criterio distinto a su texto.** "Documentos vencidos/por vencer" usa la fecha UTC (desde ~21:00 cuenta como vencido lo que vence hoy); "deuda mayor a 2 meses" mide la antigüedad de la matrícula, no 60 días sin pagar; "Caja sin cerrar" aparece todo el día hasta el cierre, y con "Todas" desaparece si **cualquier** sede cerró. | `dashboard-alerts.facade.ts:213-214,233-235,394-418,423-432` |
| S19 | 🟡 Baja | **Datos del usuario anterior tras cambiar de sesión.** `DashboardFacade` es singleton y no se resetea al cerrar sesión; si entra otra secretaria de la **misma** sede en la misma pestaña, ve por un momento el saludo, KPIs y actividad de la anterior (SWR). | `dashboard.facade.ts:23-24,84-87,237` |
| S20 | 🟡 Baja | **Detalle de clase desde el dashboard incompleto.** Al abrir una clase finalizada/no asistió se pasa `classNumber: 0` (no muestra "Clase N") e ids en 0. | `secretaria-dashboard.component.ts:438-455`; `daily-agenda-drawer.component.ts:59-75` |

---

## 2. Datos de prueba necesarios

Preparar antes de ejecutar (idealmente con el seed de spec `0008-i` + el seed de
`specs/specs/0044-b-dashboard-ejecutivo-admin/qa/seed_exec.sql` como referencia). Anotar acá qué
dato real se usó.

| Dato | Cómo debe estar | Para qué | Dato usado |
|---|---|---|---|
| D1 | Sede A con pagos B `paid` este mes y el mes anterior, montos conocidos | Ingresos, Δ, gráfico | |
| D2 | Pago Profesional y venta de servicio especial en la sede A este mes | Deben NO sumar en Ingresos Clase B | |
| D3 | Matrícula confirmada sin pago inicial (pago placeholder `pending`) | No cuenta como ingreso | |
| D4 | Matrícula online `pending_payment` (checkout abandonado) | No es matrícula nueva ni cartera (fix-172-b) | |
| D5 | Egresos (`expenses`) y gastos fijos del mes, uno "combustible" | Gastos y desglose | |
| D6 | Instructor con clases completadas este mes, mes sin liquidar; otro con mes anterior liquidado | Costo devengado (S2) | |
| D7 | Matrículas B activas: una con `certificate_enabled=true`, una `completed`, una `pending_docs` | Etapas y Alumnos activos | |
| D8 | Alumno con matrícula B + Profesional activas | Alumnos activos (S8) | |
| D9 | Saldos pendientes con matrículas de 10, 45, 75 y 120 días | Tramos de cartera | |
| D10 | Hoy: clase `scheduled` futura, una `in_progress`, una `completed`, una `cancelled`, una `no_show`, una `reserved` (borrador) | Clases Hoy, Clases Actuales, Operación de hoy | |
| D11 | Clase agendada hoy a las 20:30 o más tarde (hora Chile) | Zona horaria (S4) | |
| D12 | Sesión `in_progress` de ayer sin cerrar | "Día Anterior" (fix-131-m) | |
| D13 | Alumno con 2+ sesiones `scheduled` pasadas sin marcar, y clases futuras agendadas | Alerta B-3 y "Borrar horarios" (S1) | |
| D14 | Vehículo `both_branches=true`, uno en `maintenance`, uno con SOAP vencido y otro por vencer | KPI Vehículos, alertas de documentos | |
| D15 | Alumno B que completó clase 6 con saldo; alumno con 12/12 sin certificado | Alertas B-1, B-2 | |
| D16 | Ensayos de examen (`class_b_exam_scores`) aprobados y reprobados en el período | % aprobación | |
| D17 | Sede B con datos distintos a A; una sede sin datos en el período | Filtro de sede, AC-E1 | |
| D18 | Datos del mismo mes del año anterior (pagos y matrículas) | Δ vs año anterior, gráfico | |

**Cuentas:** admin; secretaria sede A; secretaria sede B; secretaria con grant multi-sede
(`can_access_both_branches = true`); secretaria sin sede asignada. Para los casos de 2 sesiones,
2 navegadores o perfiles distintos (2 pestañas del mismo navegador comparten la sesión).

---

## 3. Casos

### A. Carga y acceso

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Admin entra a `/app/admin/dashboard` | Skeleton → "Dashboard ejecutivo", período "Este mes", tab Tendencias. Consola limpia, red sin 4xx/5xx | ✓ | |
| A02 | Secretaria entra a `/app/secretaria/dashboard` | "¡Bienvenido, <nombre>!", fecha de hoy, 4 KPIs, Clases Actuales, Actividad, Alertas | ✓ | |
| A03 | Secretaria escribe `/app/admin/dashboard` | Acceso denegado | ✓ | |
| A04 | Admin escribe `/app/secretaria/dashboard` | Acceso denegado (el admin ya no tiene el dashboard operativo — ver §5) | ✓ | |
| A05 | Login como admin / como secretaria (sin URL) | Cada uno cae en su dashboard | ✓ | |
| A06 | Salir y volver a cada dashboard | Datos al instante, sin skeleton (SWR, AC23) | — | |
| A07 | F5 en cada dashboard | Carga normal | ✓ | |
| A08 | Red lenta (Slow 3G) en la primera carga del ejecutivo | Skeleton se mantiene hasta que llegan los datos (fix-174-b), sin paneles "$0" intermedios | — | |
| A09 | Red cortada en el dashboard de secretaria **(§4)** | Mensaje de error, no KPIs en 0 ni "Todo en orden" (S15) | — | |
| A10 | Menú lateral → Dashboard (ambos roles) | Llega a la pantalla correcta | ✓ | |

### B. Ejecutivo — Filtro de período

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| B01 | Default al entrar | "Este mes" = día 1 → hoy; botón con el rango (p. ej. "1 sep – 29 sep 2026"); hero dice "Clase B · <sede> · <rango>" (AC1) | ✓ | |
| B02 | "Mes anterior" | Mes calendario completo anterior; todo recalcula | ✓ | |
| B03 | "Este año" | 1 ene → hoy | ✓ | |
| B04 | Cambiar de preset | Una sola ronda de 7 RPC en Network (fix-173-b), sin skeleton completo (AC23) | ✓ | |
| B05 | Rango personalizado **(§4)** | Calendario flotante; se emite solo al "Aplicar"; la fila del filtro no cambia de alto (fix-176-b) | ✓ | |
| B06 | Personalizado → "Cancelar" o clic afuera | El selector vuelve al preset vigente; no recarga | ✓ | |
| B07 | Elegir solo la fecha de inicio y "Aplicar" | Rango de un día | — | |
| B08 | Intentar elegir una fecha futura | Deshabilitada (máx. = hoy) | — | |
| B09 | Rango que cruza años (nov → feb) | Δ YoY usa nov → feb del año anterior (AC-E4); gráfico muestra el año del "hasta" | — | |
| B10 | Pestaña abierta al cambiar de mes/día **(§4)** | "Este mes" se re-resuelve al recargar (fix-175-b); ¿el calendario deja elegir el día nuevo? (S17a) | — | |
| B11 | Salir y volver con un rango personalizado aplicado | ¿Se conserva el rango? (facade singleton) — confirmar si es lo deseado | — | |
| B12 | "Este año" estando en enero | Δ "vs período anterior" compara con diciembre, no con el año anterior (S17b) — anotar | — | |

### C. Ejecutivo — KPIs financieros (fila grande)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | Ingresos Clase B vs datos D1 **(§4)** | Igual a la suma a mano de pagos B `paid` del período en la sede (AC3) | ✓ | |
| C02 | D2 (pago Profesional + servicio especial) | No suman (AC-E5, D4 de la spec) | ✓ | |
| C03 | D3 (placeholder `pending`) | No suma | ✓ | |
| C04 | Ingresos vs Cuadratura/Reportes del mismo rango | Diferencia explicable solo por Profesional/servicios/cursos singulares (§8 de la spec) — anotar partida por partida | — | |
| C05 | Gastos vs D5 + D6 **(§4)** | Egresos + fijos + sueldos devengados; el tooltip muestra el desglose de las 3 fuentes (AC4) | ✓ | |
| C06 | Costo de instructores del mes en curso **(§4)** | Igual a horas del mes × tarifa de la sede (lo que muestra Liquidaciones). Si da una fracción, S2 confirmada | — | |
| C07 | Mes anterior ya liquidado | Usa `base_salary` pagado, no horas × tarifa | — | |
| C08 | Resultado = Ingresos − Gastos | Cuadra; margen % correcto (AC5) | ✓ | |
| C09 | Sede sin ingresos en el período | Margen "sin ingresos" (no `NaN`/`Infinity`), resultado negativo con "-$" y color de error | ✓ | |
| C10 | Saldo por cobrar vs cartera real **(§4)** | Monto y "N alumnos con saldo" iguales a la suma de saldos B (AC6); no incluye D4 (fix-172-b) | ✓ | |
| C11 | Cambiar el período | Saldo por cobrar NO cambia (foto de hoy) | ✓ | |
| C12 | Tooltips de las 4 tarjetas | Presentes y describen la regla real | — | |
| C13 | Montos grandes (> $10.000.000) | Formato `$12.345.678`, sin cortar la tarjeta | — | |

### D. Ejecutivo — KPIs operativos (tira del hero)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | Nuevas matrículas vs matrículas B creadas en el período | Iguales; sin borradores, canceladas ni `pending_payment` (AC7) | ✓ | |
| D02 | Matrícula confirmada a las 23:30 del último día del mes (hora Chile) | Cuenta en ese mes, no en el siguiente | — | |
| D03 | Alumnos activos vs Base de Alumnos B **(§4)** | Coinciden (anotar si difieren por matrículas legacy sin `license_group`) (AC8) | ✓ | |
| D04 | Alumnos activos al cambiar de período | No cambia | ✓ | |
| D05 | Clases realizadas vs Asistencia B del período | Iguales (se fechan por `completed_at`) (AC9) | ✓ | |
| D06 | "N en agenda" con "Este mes" | Clases `scheduled` desde ahora al fin del período; con "Mes anterior" = 0 | ✓ | |
| D07 | Cancelación e inasistencia | (canceladas + ausentes) / (realizadas + canceladas + ausentes); ≥ 20 % se pinta de advertencia | ✓ | |
| D08 | Sin clases en el período | "Sin clases en el período" — hoy muestra "0 %" en vez de "—" (AC10) — confirmar | — | |
| D09 | Clase reagendada por inasistencia (DG-075) | La falta original cuenta como inasistencia | — | |

### E. Ejecutivo — Comparaciones

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | Δ vs período anterior de Ingresos, Resultado y Matrículas **(§4)** | % correcto con 1 decimal y coma; sube verde, baja rojo (AC11) | ✓ | |
| E02 | Δ vs año anterior (D18) | Segundo indicador correcto; en la tira del hero aparece como "+X % vs año ant." | ✓ | |
| E03 | Gastos que suben | Se pinta en rojo (invertido) | ✓ | |
| E04 | Período anterior en 0 y actual > 0 | "Nuevo vs período anterior", nunca `Infinity %` (AC12) | ✓ | |
| E05 | Ambos en 0 | "Sin base…"/"—" | ✓ | |
| E06 | Resultado negativo que mejora (−100 → −50) | Cuenta como mejora (verde) | — | |
| E07 | "Este mes" al día 29 | Se compara con el 1–29 del mes anterior, no con el mes completo | ✓ | |

### F. Ejecutivo — Tab Tendencias

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | Gráfico "Ventas mensuales Clase B" | Ene–dic, 2 líneas (año actual hasta el mes en curso, año anterior completo) (AC13) | ✓ | |
| F02 | Hover sobre un mes | Tooltip con ambos valores; mes futuro "—" | — | |
| F03 | Suma del mes en curso en el gráfico | = Ingresos con "Este mes" | ✓ | |
| F04 | "Matrículas y estacionalidad" | Mismo formato, misma regla que Nuevas matrículas (AC14) | ✓ | |
| F05 | Elegir "Mes anterior" en enero | El gráfico pasa al año anterior completo | — | |
| F06 | Modo claro y oscuro | Líneas y ejes legibles, sin colores fijos (AC15) | ✓ | |
| F07 | Año sin datos | Líneas en 0, sin error | — | |

### G. Ejecutivo — Tab Instructores

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| G01 | Tabla de horas | Cada instructor activo de la sede (incluye "ambas sedes"), clases y "10 h 30 min", orden desc; los de 0 al final (AC16) | ✓ | |
| G02 | Comparar con Liquidaciones del mismo mes | Mismas clases/horas | — | |
| G03 | Instructor inactivo con clases en el período | Aparece igual (sale del "roster" por sus clases) | — | |
| G04 | Sede sin instructores | Estado vacío "Sin instructores activos" | — | |

### H. Ejecutivo — Tab Alumnos y cartera

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| H01 | Etapas vs D7 | Nuevos / En curso / Pendientes de examen municipal / Finalizados / Con saldo correctos (AC17) | ✓ | |
| H02 | "Pendientes de examen" vs alumnos con certificado habilitado | Iguales | — | |
| H03 | Aprobación de ensayos (D16) | aprobados / total del período; sin ensayos "—" (AC18) | ✓ | |
| H04 | Cartera por antigüedad (D9) | 4 tramos 0–30 / 31–60 / 61–90 / +90 con monto y nº; la barra suma el total | ✓ | |
| H05 | Alumno con 2 matrículas con saldo en tramos distintos | ¿Cuenta 1 o 2 alumnos? (S16) | — | |
| H06 | Sin saldos | "Sin saldos pendientes" (con "Todas" dice "en esta sede", S17c) | — | |

### I. Ejecutivo — Tab Operación de hoy y alertas

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| I01 | Tira de hoy vs D10 **(§4)** | Programadas (sin canceladas/no_show/reservadas), realizadas, canceladas/inasistencias correctas (AC19) | ✓ | |
| I02 | Instructores activos y vehículos disponibles / en mantención | Coinciden con Instructores y Flota de la sede (incluye "ambas sedes") | ✓ | |
| I03 | Cambiar el período | La tira de hoy no cambia | ✓ | |
| I04 | Iniciar una clase en otra pestaña | La tira NO se actualiza sola (sin Realtime, por diseño) — confirmar aceptable | — | |
| I05 | Lista de alertas | Máx. 5, icono por severidad; "Ver todas" solo si hay alertas | ✓ | |
| I06 | Clic en una alerta de la lista | No hace nada (ni navega ni descarta) — ver §5 | — | |
| I07 | "Ver todas" | Abre el drawer "Todas las Alertas" (ver Q) | ✓ | |
| I08 | Sin alertas | "Todo en orden" | — | |

### J. Ejecutivo — Sede, errores y seguridad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| J01 | Cambio de sede (Todas / A / B) **(§4)** | Todo recalcula; "Todas" = A + B en montos y conteos (AC2) | ✓ | |
| J02 | Cambio rápido A→B→A→B **(§4)** | Termina con B, sin datos mezclados ni skeleton pegado (AC-E3) | ✓ | |
| J03 | Cambio de sede con datos ya cargados | Refresco silencioso; el hero muestra la sede nueva mientras los números todavía son de la anterior — anotar cuánto dura | — | |
| J04 | Sede sin datos (D17) | $0/0/"—" y estados vacíos, sin errores de consola (AC-E1) | ✓ | |
| J05 | Falla una sola RPC **(§4)** | Solo esa sección muestra "No se pudo cargar…" + "Reintentar"; el resto se ve (AC-E2) | — | |
| J06 | "Reintentar" | Recarga y la sección vuelve | — | |
| J07 | **Seguridad RPC** **(§4)** | La secretaria no puede ejecutar `exec_dashboard_*` (error 42501) | ✓ | |
| J08 | App-like en desktop 1440 px | La página no scrollea; la celda de tabs scrollea por dentro (AC22) | ✓ | |
| J09 | Drawer abierto (p. ej. "Ver todas") | La grilla pasa a modo compacto sin romperse | — | |

### K. Secretaria — Hero y KPIs

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | Saludo y fecha | Nombre de la secretaria; fecha larga de hoy en español con mayúscula inicial | ✓ | |
| K02 | Alumnos Activos vs Base de Alumnos B **(§4)** | Iguales (S8: hoy incluye Profesional y cuenta matrículas) | ✓ | |
| K03 | Tendencia "nuevos últ. 7 días" | Nº de matrículas activas creadas en los últimos 7 días | — | |
| K04 | Clases Hoy vs Agenda del día **(§4)** | Igual a las clases válidas del día; no cuenta canceladas ni reservadas (S5) | ✓ | |
| K05 | Clase a las 20:30 o más tarde (D11) **(§4)** | Cuenta hoy y aparece en Clases Actuales (S4) | — | |
| K06 | Tendencia "vs ayer" | Diferencia correcta | — | |
| K07 | Ingresos Mes vs Cuadratura/Reportes del mes **(§4)** | Monto igual; formato legible (S10) | ✓ | |
| K08 | "% vs mes pasado" a principio de mes | Anotar si compara mes parcial vs mes completo (S10) | — | |
| K09 | Vehículos vs Flota (D14) | Disponibles y "Total flota" iguales a Flota, incluidos los de "ambas sedes" (S9) | ✓ | |
| K10 | Chip "N clases programadas" | Igual a Clases Hoy | ✓ | |
| K11 | Chip "N alertas urgentes" | ¿Debe contar las alertas verdes/informativas? (S13c) | — | |
| K12 | KPIs en tablet/móvil | Visibles y legibles | — | |

### L. Secretaria — Accesos rápidos

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| L01 | "Matricular" | Drawer "Nueva Matrícula" con el wizard | ✓ | |
| L02 | Completar una matrícula desde el dashboard **(§4)** | Alumnos Activos sube y aparece en Actividad reciente sin recargar | — | |
| L03 | "Registrar Pago" | Drawer "Registrar Pago" sin alumno preseleccionado | ✓ | |
| L04 | Registrar un pago desde el dashboard **(§4)** | Ingresos Mes sube sin recargar; alerta "N pagos registrados hoy" aparece | — | |
| L05 | "Agenda" | Drawer "Agenda Semanal" con la agenda completa usable dentro del drawer | ✓ | |
| L06 | "Registrar Egreso" (fix-006-i) | Drawer "Registrar Egreso" con tipo "Combustible" preseleccionado | ✓ | |
| L07 | Guardar un egreso desde el dashboard | Aparece en Cuadratura del día | — | |
| L08 | Abrir "Registrar Egreso" dos veces seguidas | La 2ª vez también viene con "Combustible" (el preset se consume una vez) | — | |
| L09 | Solo "Matricular" y "Registrar Pago" destacados | Regla 3-2-1 de marca | — | |
| L10 | Secretaria con grant en "Todas": registrar egreso/pago | ¿En qué sede queda? — decisión | — | |

### M. Secretaria — Clases Actuales

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| M01 | Contenido con D10 | Aparecen scheduled/in_progress/completed/no_show; NO canceladas (fix-029-m) ni reservadas | ✓ | |
| M02 | Orden y scroll | Orden por hora; se centra sola la primera en curso o por iniciar | — | |
| M03 | Etiquetas | "Por Iniciar", "En Curso", "Finalizada", "No Asistió"; nunca dos contradictorias (ASG-b-018 H-008) | ✓ | |
| M04 | Clase por iniciar con hora pasada | "Debía iniciar hace X min/h" | — | |
| M05 | Clase en curso pasada su hora + 15 min | "Atrasada / Cierre atrasado" en rojo; se actualiza sola cada minuto | — | |
| M06 | D12 (en curso de ayer) | Borde rojo, fecha corta y "Día Anterior" (fix-131-m) | ✓ | |
| M07 | Clic en "Por Iniciar" → iniciar **(§4)** | Drawer "Iniciar Clase Práctica" con alumno, vehículo preseleccionado y km actual; al iniciar pasa a "En Curso" | ✓ | |
| M08 | Iniciar con un km menor al actual del vehículo | ¿Lo acepta? — decisión | — | |
| M09 | Iniciar una 2ª clase con el mismo instructor/vehículo en curso | Rechazo con mensaje claro (trigger de concurrencia) | — | |
| M10 | Iniciar una clase de las 18:00 a las 9:00 | ¿Lo permite? — decisión | — | |
| M11 | Clic en "En Curso" → finalizar **(§4)** | Drawer "Finalizar Clase"; km final > inicial obligatorio; firmas opcionales; pasa a "Finalizada" | ✓ | |
| M12 | Finalizar con km final ≤ inicial | Botón deshabilitado con mensaje | ✓ | |
| M13 | Finalizar la sesión colgada de ayer (D12) | Se cierra y desaparece de la lista | — | |
| M14 | Km del vehículo tras finalizar | Flota muestra el km nuevo | — | |
| M15 | Clic en "Finalizada"/"No Asistió" | Drawer de detalle solo lectura; ¿muestra "Clase N"? (S20) | — | |
| M16 | Error al iniciar/finalizar (red cortada) | Mensaje en el drawer; el drawer no se cierra | — | |
| M17 | Sin clases hoy | "Sin clases actuales" centrado | — | |
| M18 | Tablet/móvil | Máx. 4 clases + "Ver toda la agenda" | ✓ | |
| M19 | Nombre del alumno | Solo primer nombre + tooltip con el nombre completo — ¿basta para distinguir? | — | |

### N. Drawer "Agenda de Hoy"

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| N01 | "Ver toda la agenda" | Drawer "Agenda de Hoy" con todas las clases del día, sin límite ni footer | ✓ | |
| N02 | Iniciar/finalizar desde el drawer | Abre el drawer de iniciar/finalizar encima (apilado); al terminar se cierra todo y la lista queda actualizada | — | |
| N03 | Detalle de una finalizada desde el drawer → "Cerrar" | Vuelve a "Agenda de Hoy" | — | |
| N04 | Clase iniciada en otra sesión mientras el drawer está abierto | Se actualiza sola | — | |

### O. Tiempo real (2 sesiones)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| O01 | Iniciar/cerrar clase en A **(§4)** | Clases Actuales en B cambia sin recargar (fix-227-m) | ✓ | |
| O02 | Registrar pago en A | Ingresos Mes en B sube sin recargar | ✓ | |
| O03 | Matricular en A | Alumnos Activos en B sube (el canal escucha `students`, no `enrollments`: ¿la matrícula de un alumno existente lo dispara?) | — | |
| O04 | Cambio en la sede B con la secretaria A abierta | No aparece nada de B (aunque el dashboard recargue) | — | |
| O05 | Salir del dashboard y revisar Network → WS **(§4)** | El canal `dashboard-realtime` debería cerrarse (S12) | — | |
| O06 | Alertas tras un pago que salda la deuda | ¿Se actualizan? (alertas no tienen Realtime; solo al volver) — confirmar | — | |

### P. Actividad reciente

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| P01 | Lista del dashboard | Últimos 6 eventos **de la propia secretaria** (RLS, fix-224-m) con título, detalle y hora | ✓ | |
| P02 | Acción hecha por el admin o una matrícula web | NO aparece para la secretaria — ver §5 | — | |
| P03 | Textos | "Nueva matrícula", "Pago actualizado", "Clase Práctica eliminada"…, género correcto; sin "undefined" | — | |
| P04 | Hora | Hoy "HH:MM"; días anteriores "dd mes HH:MM" | — | |
| P05 | "Ver toda la actividad" | Drawer con hasta 50 eventos | ✓ | |
| P06 | Clic en evento de matrícula/alumno/clase **(§4)** | Cierra el drawer y abre `/app/secretaria/alumnos/:id` del alumno correcto | ✓ | |
| P07 | Clic en evento de pago | Abre Pagos | ✓ | |
| P08 | Evento de un alumno ya eliminado / de un DELETE | No es clicable | — | |
| P09 | Evento de matrícula Profesional (si hay) | ¿A qué ficha lleva en el piloto? | — | |
| P10 | Sin actividad | "Sin actividad reciente" | — | |

### Q. Alertas (cada tipo) y drawer

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| Q01 | Documentos vencidos / por vencer (D14) | Conteos iguales a los documentos de Flota; días del texto = `alert_config` | ✓ | |
| Q02 | Documento que vence hoy, visto a las 21:30 | Sigue "por vencer", no "vencido" (S18) | — | |
| Q03 | "N Pagos pendientes" | Coincide con matrículas activas con saldo de la sede (comparar con Pagos) (S16) | — | |
| Q04 | 6ª clase con saldo (D15) | Aparece | — | |
| Q05 | "Listos para certificar" (D15) | Coincide con Certificación | — | |
| Q06 | "2+ clases sin asistir" (D13) | Conteo correcto; ¿incluye clases de hoy aún no marcadas? | — | |
| Q07 | **"Borrar horarios"** **(§4)** | Debe pedir confirmación y solo afectar lo que corresponde (S1) | — | |
| Q08 | "Caja sin cerrar" → "Ir a Cuadratura" (admin y secretaria) **(§4)** | Lleva a la Cuadratura del rol correcto y cierra el drawer (S3) | ✓ | |
| Q09 | Cerrar la caja | La alerta desaparece al volver al dashboard | — | |
| Q10 | "Caja sin cerrar" con admin en "Todas" y solo una sede cerrada | ¿Debe seguir apareciendo? (S18) | — | |
| Q11 | "Deuda mayor a 2 meses" | Anotar qué mide (antigüedad de matrícula) vs lo que dice (S18) | — | |
| Q12 | "N pagos registrados hoy" | Igual a los pagos del día (hora Chile) | — | |
| Q13 | "Cuota 2 vencida" con un alumno en esa situación **(§4)** | Aparece (S6) | — | |
| Q14 | "Instructores sin liquidar" | ¿Tiene sentido a mitad de mes? ¿Muestra instructores de otra sede? (S14) | — | |
| Q15 | Alertas de Profesional (pre-inscripciones, asistencia, módulos) en el piloto | No deberían mostrarse si Profesional está oculto — decisión (S14) | — | |
| Q16 | Descartar (X) una alerta | Desaparece; vuelve a las 24 h | ✓ | |
| Q17 | Descartar y luego aparece un caso nuevo del mismo tipo **(§4)** | Debería volver a mostrarse (S13b) | — | |
| Q18 | Descartar como admin y entrar como secretaria en el mismo PC | La secretaria debería verla (S13b) | — | |
| Q19 | Drawer "Todas las Alertas" | Orden error → advertencia → info → éxito, "N registros", "N alertas activas" | ✓ | |
| Q20 | Clic en una alerta sin botón (docs vencidos, pagos pendientes…) | No navega (UAT Paquete 5 lo anotó) — ver §5 | — | |

### R. Sedes, roles y sesión

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| R01 | Secretaria sede A vs sede B | Cada una ve solo su sede en KPIs, clases, alertas | ✓ | |
| R02 | Secretaria con grant cambia de sede **(§4)** | Todo recarga sin salir de la pantalla (S7) | — | |
| R03 | Secretaria con grant en "Todas" | KPIs = suma de sedes; clases de ambas | — | |
| R04 | Secretaria sin sede asignada | Todo en 0/vacío, nunca datos de todas las sedes; revisar alertas sin filtro de sede (S14) | — | |
| R05 | **RLS** **(§4)** | La secretaria A no lee sesiones/pagos de B desde la consola | ✓ | |
| R06 | Logout secretaria A → login secretaria A' de la misma sede, misma pestaña **(§4)** | No ve ni un instante el nombre, KPIs ni actividad de la anterior (S19) | — | |
| R07 | Revocar el grant con la sesión abierta | El selector desaparece y el dashboard vuelve a su sede | — | |

### S. Visual y accesibilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| S01 | Modo claro y oscuro, ambos dashboards | Todo legible (KPIs, gráficos, badges, alertas) | ✓ | |
| S02 | 375 / 768 / 1440 px | Sin scroll horizontal; desktop app-like; móvil scroll nativo | ✓ | |
| S03 | Filtro de período en 375 px | Se encoge y trunca sin desbordar | — | |
| S04 | Tabs del ejecutivo en móvil | Etiquetas cortas ("Alumnos", "Hoy") | — | |
| S05 | Solo teclado | Se llega a filtro, tabs, botones, clases y alertas; foco visible | — | |
| S06 | Botones de solo ícono (X de alertas) | Con tooltip/aria-label | — | |
| S07 | Animación de entrada | Una sola vez, sin parpadeos al refrescar | — | |

---

## 4. Casos con pasos numerados

### A09 — Error de carga en el dashboard de secretaria

**Precondición:** sesión secretaria.
1. DevTools → Network → "Offline".
2. Recargar `/app/secretaria/dashboard` (o volver al dashboard desde otra pantalla).
3. Mirar KPIs, Clases Actuales y Alertas.
4. Volver a "No throttling" y recargar.

**Esperado:** en el paso 3 un mensaje de error claro, no KPIs en 0 ni "Todo en orden" (S15). En
el paso 4 todo normal. **Evidencia:** captura del paso 3.

### B05 — Rango personalizado

**Precondición:** admin en el ejecutivo con datos cargados; Network abierto.
1. Selector de período → "Personalizado".
2. Verificar que se abre el calendario y que la fila del filtro y las tarjetas no se movieron.
3. Clic en una fecha de inicio → verificar que NO hay peticiones `exec_dashboard_*` todavía.
4. Clic en una fecha de término → texto con el rango elegido.
5. "Aplicar".
6. Contar las peticiones `exec_dashboard_kpis` nuevas.

**Esperado:** exactamente 3 `exec_dashboard_kpis` (actual, anterior, año anterior) + 4 RPC más,
una sola vez; el botón y el hero muestran el rango nuevo; sin skeleton completo.

### B10 — La pestaña queda abierta al cambiar de día

**Precondición:** ejecutivo abierto antes de la medianoche (o cambiar la hora del PC).
1. Dejar la pestaña abierta pasada la medianoche.
2. Cambiar de tab o de sede para forzar una recarga → mirar el rango del botón.
3. Abrir el calendario personalizado → intentar elegir el día nuevo.

**Esperado:** "Este mes" termina en el día nuevo (fix-175-b); el día nuevo es elegible en el
calendario (si no, S17a).

### C01 — Ingresos contra los pagos reales

**Precondición:** D1, D2, D3 en la sede A; admin con sede A y "Este mes".
1. En Pagos, filtrar la sede A y el mes en curso; sumar a mano los pagos de matrículas Clase B.
2. Anotar el pago Profesional y la venta de servicio especial por separado.
3. Comparar con "Ingresos Clase B".
4. Cambiar a "Mes anterior" y repetir.

**Esperado:** coincide exactamente; D2 y D3 no suman.

### C05 / C06 — Gastos y costo de instructores

**Precondición:** D5 y D6; admin con sede A.
1. Con "Este mes", pasar el mouse por "Gastos" → anotar egresos, fijos e instructores.
2. Comparar egresos y fijos con Cuadratura/Gastos fijos del mes.
3. En Liquidaciones, anotar las horas del mes de cada instructor de la sede y la tarifa por hora.
4. Calcular a mano horas × tarifa y comparar con "sueldos devengados".
5. Cambiar a "Mes anterior" (liquidado) y comparar con lo pagado.

**Esperado:** pasos 2, 4 y 5 cuadran. Si en el paso 4 el dashboard da una fracción de lo calculado
(p. ej. un tercio el día 10), S2 confirmada.

### C10 — Saldo por cobrar

**Precondición:** D4 y D9.
1. Anotar monto y "N alumnos con saldo".
2. En Pagos, sumar los saldos pendientes de matrículas B de la sede (sin D4).
3. Tab "Alumnos y cartera" → revisar los 4 tramos contra la fecha de cada matrícula.

**Esperado:** coinciden; D4 no aparece. Anotar si se incluyen matrículas finalizadas con saldo.

### D03 / K02 — Alumnos activos contra la Base de Alumnos B

**Precondición:** D7 y D8 en la sede A.
1. En la Base de Alumnos B de la sede A, anotar el KPI "Activos" y el total.
2. En el ejecutivo (admin, sede A) anotar "Alumnos activos".
3. En el dashboard de la secretaria de A anotar "Alumnos Activos".

**Esperado:** los 3 cuentan lo mismo o la diferencia se explica. Si el de secretaria suma a D8 dos
veces o incluye Profesional, S8 confirmada.

### E01 — Comparación contra el período anterior

**Precondición:** D1 y D18 con montos conocidos.
1. "Este mes" (1 → hoy) → anotar Ingresos y los dos Δ.
2. Calcular a mano: (actual − mismo tramo del mes anterior) / tramo anterior × 100.
3. Calcular igual contra el mismo tramo del año anterior.
4. Repetir con Nuevas matrículas y Resultado.

**Esperado:** % iguales con 1 decimal y coma; colores correctos.

### I01 — Operación de hoy

**Precondición:** D10 en la sede A.
1. Admin, sede A, tab "Operación de hoy".
2. Comparar programadas / realizadas / canceladas-inasistencias con la Agenda del día.
3. En el dashboard de secretaria de A, comparar con "Clases Hoy" y con la lista de Clases Actuales.

**Esperado:** el ejecutivo no cuenta la reservada ni las canceladas como programadas. Anotar la
diferencia con el KPI de secretaria (S5).

### J01 — Cambio de sede en el ejecutivo

**Precondición:** D17; admin.
1. "Todas" → anotar los 8 KPIs.
2. Sede A → anotar.
3. Sede B → anotar.

**Esperado:** recarga sola cada vez; montos y conteos de "Todas" = A + B (salvo Alumnos activos si
hay matrículas en ambas, y costo de instructores "ambas sedes", S11).

### J02 — Cambio rápido de sede

**Precondición:** Slow 3G; admin.
1. Elegir A, B, A y B sin esperar.
2. Esperar a que termine todo.

**Esperado:** números de B, iguales a los de J01 paso 3; sin skeleton pegado ni paneles vacíos.

### J05 — Falla de una sección

1. DevTools → Network → bloquear la URL `rpc/exec_dashboard_instructor_hours` ("Block request URL").
2. Recargar el ejecutivo.
3. Ir a cada tab.
4. Desbloquear y clic en "Reintentar".

**Esperado:** solo "Instructores" muestra el error; el resto normal; "Reintentar" lo recupera.

### J07 — Seguridad de las funciones del ejecutivo

**Precondición:** sesión de secretaria; una petición `rpc/exec_dashboard_kpis` copiada desde la
sesión de admin ("Copy as fetch").
1. Con la sesión de la secretaria abierta, en Console, pegar la petición reemplazando el token
   `Authorization` por el de la secretaria (copiarlo de cualquier petición suya en Network).
2. Ejecutar. Repetir con `exec_dashboard_receivables` y `p_branch_id` de otra sede.

**Esperado:** error 42501 "forbidden: executive dashboard is admin-only", nunca datos. Si devuelve
números, **P0 inmediato**.

### K04 / K05 — Clases de hoy y zona horaria

**Precondición:** D10 y D11 en la sede A.
1. Anotar las clases del día en la Agenda de la sede A (sin canceladas).
2. En el dashboard de secretaria, anotar "Clases Hoy" y contar la lista de Clases Actuales.
3. Verificar si D11 (20:30 o más tarde) aparece.
4. Si es posible, repetir después de las 21:00 hora Chile.

**Esperado:** Clases Hoy = Agenda; D11 aparece; ninguna cancelada/reservada suma. Anotar la
diferencia (S4, S5).

### K07 — Ingresos Mes contra Cuadratura

1. Anotar el KPI "Ingresos Mes" y su %.
2. En Contabilidad → Reportes/Cuadratura, sumar los ingresos del mes de la sede.
3. Sumar el mes anterior completo y recalcular el %.

**Esperado:** mismo monto; formato legible (no `$1.234567M`). Anotar si el % compara contra el
mes completo (S10).

### L02 — Matricular desde el dashboard

1. Anotar Alumnos Activos.
2. "Matricular" → completar una matrícula Clase B → cerrar el drawer.

**Esperado:** Alumnos Activos +1 y "Nueva matrícula" en Actividad reciente, sin recargar.

### L04 — Pago desde el dashboard

1. Anotar Ingresos Mes.
2. "Registrar Pago" → elegir alumno con saldo → pagar $10.000 → cerrar.
3. Abrir "Ver todas las alertas".

**Esperado:** Ingresos Mes sube exactamente $10.000 sin recargar; aparece "N pagos registrados hoy".

### M07 — Iniciar una clase desde el dashboard

**Precondición:** clase de hoy "Por Iniciar" con vehículo asignado.
1. Clic en la clase.
2. Verificar alumno, instructor, hora, vehículo preseleccionado y km actual del vehículo.
3. Cambiar de vehículo → el km cambia al del nuevo.
4. Volver al original, "Iniciar".

**Esperado:** el drawer se cierra, la clase pasa a "En Curso" al instante; en Asistencia B figura
iniciada con ese km.

### M11 — Finalizar una clase desde el dashboard

**Precondición:** clase "En Curso" de M07.
1. Clic en la clase → drawer "Finalizar Clase".
2. Poner km final igual al inicial → botón deshabilitado.
3. Poner km final mayor, firmar alumno e instructor → "Finalizar".

**Esperado:** la clase queda "Finalizada"; Asistencia B, Ficha del alumno y Flota (km) reflejan el
cierre.

### O01 — Tiempo real de Clases Actuales

**Precondición:** 2 navegadores con la misma sede: A = secretaria (o admin en Asistencia B),
B = dashboard de secretaria.
1. En A, iniciar una clase.
2. Sin tocar B, esperar 5 s.
3. En A, finalizarla.

**Esperado:** B cambia "Por Iniciar" → "En Curso" → "Finalizada" sin recargar. Si no, recargar B
para separar "no llegó el evento" de "no se guardó".

### O05 — El canal Realtime queda abierto

1. Abrir el dashboard de secretaria; DevTools → Network → WS → mensajes del socket de Realtime.
2. Ir a otra pantalla (p. ej. Alumnos).
3. Desde otra sesión, registrar un pago.
4. Mirar en Network si la pestaña hace peticiones a `enrollments`/`class_b_sessions`/`audit_log`.

**Esperado:** no debería haber peticiones del dashboard al estar en otra pantalla (S12).

### P06 — Navegar desde la actividad

1. "Ver toda la actividad".
2. Clic en un evento de matrícula, en uno de clase práctica y en uno de pago.

**Esperado:** el drawer se cierra y abre la ficha del alumno correcto (o Pagos); los eventos de
eliminación no son clicables.

### Q07 — "Borrar horarios" (S1)

**Precondición:** D13 **en un ambiente de prueba**; anotar todas las sesiones del alumno.
1. Abrir "Ver todas las alertas" → alerta "N alumnos con 2+ clases sin asistir".
2. Clic en "Borrar horarios".
3. Revisar en la Agenda y en la ficha del alumno qué sesiones quedaron canceladas.
4. Revisar Auditoría y notificaciones.

**Esperado:** antes del paso 3 debería pedirse confirmación mostrando qué alumnos y cuántas clases
se cancelarán. Anotar si canceló también clases **futuras**, si quedó motivo/fecha de cancelación,
si hubo aviso de éxito y si el alumno/instructor fueron notificados. Si cancela sin preguntar,
S1 confirmada → prioridad alta.

### Q08 — "Ir a Cuadratura"

1. Como secretaria, sin cierre de caja hoy → "Ver todas las alertas" → "Ir a Cuadratura".
2. Repetir como admin.

**Esperado:** cada uno llega a su Cuadratura y el drawer se cierra. Si la secretaria ve acceso
denegado, S3 confirmada.

### Q13 — Cuota 2 vencida

**Precondición:** matrícula activa pagada en modalidad parcial (abono), con saldo, que ya pasó la
clase 6.
1. Abrir "Ver todas las alertas".

**Esperado:** aparece "1 matrícula con cuota 2 vencida". Si no aparece, S6 confirmada.

### Q17 — Descartar no debe ocultar casos nuevos

1. Con 1 documento vencido, descartar la alerta.
2. Cargar otro documento de vehículo ya vencido.
3. Volver al dashboard.

**Esperado:** la alerta reaparece con "2 Documentos vencidos". Si sigue oculta, S13b confirmada.

### R02 — Secretaria con grant cambia de sede

**Precondición:** secretaria con `can_access_both_branches = true`, sedes con datos distintos.
1. Anotar KPIs, clases y alertas en la sede A.
2. Cambiar a B en el selector sin salir del dashboard.
3. Cambiar a "Todas".

**Esperado:** recarga en los pasos 2 y 3. Si los números no cambian hasta salir y volver, S7
confirmada.

### R05 — RLS por sede

**Precondición:** secretaria sede A; id de una sesión de clase de la sede B.
1. Copiar desde Network una petición a `class_b_sessions` del dashboard ("Copy as fetch").
2. Quitar el filtro `enrollments.branch_id` o pedir el id de B; ejecutar.
3. Repetir con `payments`.

**Esperado:** 0 filas de B. Si aparecen, **P0 inmediato**.

### R06 — Cambio de usuario en la misma pestaña

**Precondición:** 2 secretarias de la misma sede.
1. Entrar como secretaria 1 y abrir el dashboard.
2. Cerrar sesión; entrar como secretaria 2 en la misma pestaña.
3. Mirar el saludo y Actividad reciente apenas carga (grabar pantalla si hace falta).

**Esperado:** nunca se ve el nombre ni las acciones de la secretaria 1 (S19).

---

## 5. Decisiones de negocio pendientes

No se pueden marcar ✅/❌ hasta que alguien defina la regla:

| Caso | Pregunta |
|---|---|
| A04 | Desde `0044-b` el admin no tiene "Clases Actuales" ni accesos rápidos (incluido el "Registrar Egreso" que pidió el cliente en fix-006-i). ¿El admin necesita iniciar/cerrar clases o registrar egresos desde su dashboard? |
| C04 / S11 | ¿El Resultado debe restar solo gastos atribuibles a Clase B, o todos los de la sede? ¿Cómo se reparte un instructor "ambas sedes"? |
| D08 | ¿Tasa de cancelación sin clases: "0 %" o "—"? ¿Denominador = realizadas+canceladas+ausentes (código) o "agendadas del período" (AC10)? |
| B11 | ¿El rango personalizado se conserva al salir y volver? |
| I04 | ¿"Operación de hoy" debe actualizarse en tiempo real? |
| I06 / Q20 | ¿Las alertas deben llevar a su módulo (Flota, Pagos, Certificación…)? |
| K02 | ¿"Alumnos Activos" de secretaria debe contar solo Clase B y alumnos (no matrículas)? |
| K08 | ¿"Ingresos Mes" se compara con el mismo tramo del mes anterior? ¿Formato en millones o monto completo? |
| K11 | ¿"Alertas urgentes" debe contar solo error/advertencia? |
| L10 | ¿En qué sede queda un pago/egreso registrado por una secretaria con grant en "Todas"? |
| M08 / M10 | ¿Se puede iniciar con km menor al del vehículo? ¿Hasta cuánto antes/después de la hora se puede iniciar? |
| P02 | ¿La secretaria debe ver la actividad de toda su sede (incluido admin y matrículas web) o solo la suya? |
| Q07 | ¿"Borrar horarios" debe cancelar también las clases futuras? ¿Con confirmación, motivo y aviso al alumno? |
| Q10 | ¿"Caja sin cerrar" con "Todas" debe exigir el cierre de cada sede? ¿Desde qué hora se muestra? |
| Q14 / Q15 | ¿Mostrar alertas de liquidación del mes en curso y de Clase Profesional durante el piloto? |
| H05 / Q03 | ¿Qué número de "alumnos con saldo" es el oficial (ejecutivo, alerta o Base B)? |
