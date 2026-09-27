# Spec 0044-b — Dashboard Ejecutivo de Admin (fase 1: Clase B)

> **Status:** approved
> **Created:** 2026-09-27
> **Owner:** Benjamín
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Asignación `ASG-m-008` (creada por `m` el 2026-09-14). Visión confirmada y ajustada
por el owner al reclamarla el 2026-09-27. Referencia visual y de métricas: mock "Dashboard
Ejecutivo" de Jorge Pérez → https://autoescuela-chillan-demo.vercel.app/dashboard

**Persona afectada:** Admin (dueño de la escuela). La Secretaria **no** se ve afectada: mantiene
su dashboard actual sin cambios.

**Problema que resuelve:**
El dashboard de admin (`/admin/dashboard` → `features/dashboard/`) está orientado a operar el
día: 4 KPIs operativos (Alumnos activos, Clases hoy, Ingresos mes, Vehículos) y accesos rápidos
tipo secretaria (Matricular, Registrar pago, Agenda, Registrar egreso). El admin no tiene una
vista de **cómo va el negocio**: ingresos vs. año anterior, margen real, estacionalidad de
matrículas, cartera por cobrar, productividad de instructores. Esa información existe en la BD
pero está repartida en Contabilidad, Pagos y Agenda.

**Alcance de esta fase (fase 1 = Clase B):** en el piloto Clase B se entrega completa y
Profesional queda casi entera oculta, así que la fase 1 cubre solo Clase B. Profesional queda
para una fase posterior.

**Contenido de referencia (extraído del mock, 2026-09-27):**

- **Filtro de período:** Este mes / Mes anterior / Año / Rango personalizado.
- **KPIs (8):** Ingresos/Ventas (Δ vs período anterior) · Gastos registrados · Resultado
  operacional (ingresos − gastos) · Nuevas matrículas (Δ vs período anterior) · Alumnos activos
  · Saldo por cobrar (monto + nº de alumnos con saldo) · Clases realizadas · Clases en agenda.
- **Gráficos:** Evolución de ventas mensuales (año actual vs año anterior, ene–dic) · Evolución
  de matrículas y estacionalidad (año actual vs año anterior, ene–dic).
- **Paneles:** Horas de instrucción por instructor (clases cerradas + horas) · Estado de alumnos
  (nuevos → en curso → pendientes de examen municipal → finalizados/aprobados, + con saldo
  pendiente) · Operación de hoy (programadas, realizadas, canceladas/inasistencias, instructores
  activos, flota disponible, en mantención) · Alertas.

**Ajustes acordados sobre el mock (confirmados por el owner al reclamar):**

1. **Resultado operacional real:** debe restar, además de `expenses`, los gastos fijos
   (`fixed_expenses`) y el pago a instructores (`instructor_monthly_payments`). Tal como está en
   el mock (solo gastos registrados) muestra un margen ~96% que no es real.
2. **Comparación vs. año anterior (YoY)** además de vs. período anterior — el mes vs mes
   anterior mezcla estacionalidad.
3. **Filtro por sede** (`BranchFacade`) — el mock no lo tiene y el sistema es multi-sede.
4. **KPIs de calidad adicionales:** tasa de cancelación/inasistencia, antigüedad de la cartera
   por cobrar, aprobación en ensayos de examen (`class_b_exam_scores`).

"Operación de hoy" y Alertas se mantienen como bloque secundario y compacto; el foco de la
página son los números del negocio.

**Hipótesis de valor:**
Si el dueño ve en una sola pantalla ingresos, margen real y matrículas contra el año anterior,
deja de pedir reportes manuales a la secretaria/contabilidad y detecta caídas de ventas o
cartera morosa en el mismo mes en que ocurren, no al cierre.

---

## 2. User Stories

- **US1**: Como admin, quiero ver ingresos, gastos y resultado operacional real del período
  elegido para saber si la escuela está ganando plata.
- **US2**: Como admin, quiero comparar cada KPI principal contra el período anterior **y** contra
  el mismo período del año anterior para distinguir crecimiento real de estacionalidad.
- **US3**: Como admin, quiero ver la evolución mensual de ventas y matrículas del año actual vs
  el anterior para anticipar temporadas altas/bajas.
- **US4**: Como admin, quiero ver cuánto me deben, quiénes y hace cuánto, para priorizar la
  cobranza.
- **US5**: Como admin, quiero ver clases y horas por instructor, y la tasa de
  cancelación/inasistencia, para evaluar productividad y capacidad.
- **US6**: Como admin, quiero ver en qué etapa están mis alumnos (nuevos, en curso, pendientes
  de examen, finalizados) y cómo les va en los ensayos de examen, para medir el resultado
  formativo.
- **US7**: Como admin multi-sede, quiero filtrar todo el dashboard por sede o ver todas juntas.
- **US8**: Como secretaria, quiero que mi dashboard siga exactamente igual.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.
>
> Convención: "período" = el rango del filtro de período. "Clase B" = `enrollments.license_group
> = 'class_b'`. Montos en CLP formateados `$1.234.567`.

### Filtros

- **AC1 — Filtro de período**: Given el admin en `/admin/dashboard`, When elige "Este mes",
  "Mes anterior", "Este año" o un rango personalizado, Then todos los KPIs, paneles y la
  comparación se recalculan para ese rango; el default al entrar es "Este mes".
- **AC2 — Filtro de sede**: Given un admin con 2+ sedes, When cambia la sede en el selector
  global (`BranchFacade`), Then todos los números se recalculan filtrando por `branch_id`; con
  "Todas las escuelas" no se filtra.

### KPIs financieros

- **AC3 — Ingresos**: Given pagos registrados, Then "Ingresos" = suma de
  `payments.total_amount` con `status IN ('paid', 'completado')` y `payment_date` dentro del
  período, de matrículas Clase B (`enrollments.license_group = 'class_b'`) de la sede filtrada.
  Los placeholders `status = 'pending'` (matrícula confirmada sin pago inicial) **no** cuentan
  (ver D5).
- **AC4 — Gastos**: Then "Gastos" = `expenses.amount` (por `date`) + `fixed_expenses.amount`
  (por `date`) + **costo devengado de instructores** del período (D2), y la tarjeta muestra el
  desglose de las 3 fuentes. Costo devengado por instructor-mes (`period = 'YYYY-MM'`):
  - si existe fila en `instructor_monthly_payments` → su `base_salary` (valor congelado al pagar);
  - si no (mes aún no liquidado) → `instructor_monthly_hours.total_equivalent` × tarifa por hora
    de la sede del instructor (`branch_payroll_config`), igual que calcula `LiquidacionesFacade`.
  - Sede del instructor = `users.branch_id` del instructor (mismo criterio que Liquidaciones).
  - Rangos que no calzan con meses completos: el costo del mes se prorratea por días incluidos.
- **AC5 — Resultado operacional**: Then "Resultado operacional" = Ingresos − Gastos (AC3 − AC4)
  y muestra el margen % (resultado / ingresos). Con ingresos = 0 el margen se muestra "—", no
  `NaN` ni `-Infinity`.
- **AC6 — Saldo por cobrar**: Then muestra la suma de `enrollments.pending_balance > 0` de
  matrículas Clase B no canceladas y el nº de alumnos con saldo, más la distribución por
  antigüedad de la matrícula: 0–30, 31–60, 61–90, +90 días.

### KPIs comerciales y operativos

- **AC7 — Nuevas matrículas**: Then cuenta matrículas Clase B con `created_at` en el período y
  `status` ≠ `draft`/`cancelled`.
- **AC8 — Alumnos activos**: Then cuenta matrículas Clase B con `status = 'active'` (no depende
  del período — es foto del momento).
- **AC9 — Clases realizadas / en agenda**: Then "realizadas" = `class_b_sessions` completadas con
  `scheduled_at` en el período; "en agenda" = sesiones agendadas futuras dentro del período.
- **AC10 — Tasa de cancelación/inasistencia**: Then = (sesiones canceladas + inasistencias) /
  sesiones agendadas del período, en %. Sin sesiones → "—".

### Comparaciones

- **AC11 — Δ doble**: Given Ingresos, Resultado operacional y Nuevas matrículas, Then cada una
  muestra Δ% vs período anterior de igual largo **y** Δ% vs el mismo rango del año anterior, con
  color semántico (sube = success, baja = danger; para Gastos se invierte).
- **AC12 — Base cero**: Given el período de comparación vale 0, Then el Δ se muestra "Nuevo" (o
  "—" si ambos son 0), nunca `+Infinity%`.

### Gráficos

- **AC13 — Ventas mensuales**: Then un gráfico de líneas ene–dic con 2 series: año actual (hasta
  el mes en curso) y año anterior (12 meses), usando la misma definición de ingresos de AC3.
- **AC14 — Matrículas y estacionalidad**: Then mismo formato que AC13 con la definición de AC7.
- **AC15 — Tokens de color**: los gráficos usan tokens del DS (sin hex hardcodeados) y se leen en
  modo claro y oscuro.

### Paneles

- **AC16 — Horas por instructor**: Then una tabla con cada instructor activo de la sede: clases
  completadas en el período y horas (suma de `duration_min`, formato `10 h 30 min`), ordenada
  desc por horas; los instructores con 0 aparecen al final.
- **AC17 — Estado de alumnos (Clase B)**: Then muestra conteos de: nuevos del período (AC7);
  en curso (`status='active'` y `certificate_enabled = false`); pendientes de examen municipal
  (`status='active'` y `certificate_enabled = true`); finalizados (`status='completed'`); con
  saldo pendiente (AC6). Derivación confirmada por el owner (D1).
- **AC18 — Ensayos de examen**: Then % de aprobación = `class_b_exam_scores.passed = true` /
  total de ensayos con `date` en el período. Sin ensayos → "—".
- **AC19 — Operación de hoy (compacto)**: Then un bloque secundario con clases de hoy
  (programadas / realizadas / canceladas), instructores activos, vehículos disponibles y en
  mantención — independiente del filtro de período.

### Alcance de roles y estructura

- **AC20 — Solo admin**: el dashboard ejecutivo solo existe en `/admin/dashboard`. Los accesos
  rápidos tipo secretaria (Matricular, Registrar pago, Agenda, Registrar egreso) ya no aparecen.
- **AC21 — Secretaria intacta**: `/secretaria/dashboard` (`secretaria-dashboard.component`) no
  cambia: mismo template y mismos datos (verificable por diff vacío + `/verify`).
- **AC22 — App-like**: la página cumple el patrón app-like (fill-screen en desktop, scroll nativo
  en mobile) con `.bento-grid` raíz.
- **AC23 — Loading/SWR**: primera carga muestra skeletons; cambiar período o sede con datos ya
  cargados no vuelve a mostrar skeleton completo (refresh silencioso).

### Edge cases obligatorios

- **AC-E1**: Given una sede sin ningún dato en el período, Then todos los KPIs muestran `$0`/`0`
  o "—" y los paneles un `app-empty-state`, sin errores en consola.
- **AC-E2**: Given un error de red en una de las consultas, Then el resto del dashboard se
  renderiza y la sección fallida muestra un estado de error recuperable (el Facade expone
  `error()`), sin romper la página.
- **AC-E3**: Given el admin cambia de sede o período rápido 3 veces seguidas, Then el dashboard
  termina mostrando los datos de la **última** selección (guard `createRequestGuard()`).
- **AC-E4**: Given un rango personalizado que cruza años (ej. nov-2025 → feb-2026), Then la
  comparación YoY usa nov-2024 → feb-2025.
- **AC-E5**: Given matrículas o pagos de Clase Profesional en la sede, Then no se suman en
  ningún KPI de esta fase.

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Cambios al dashboard de Secretaria.
- ❌ KPIs de Clase Profesional (fase posterior).
- ❌ Exportar el dashboard a PDF/Excel.
- ❌ Metas/presupuesto por mes (comparar contra objetivo, no solo contra el pasado).
- ❌ Embudo de interesados → matriculados (no existe tabla de interesados para Clase B).
- ❌ Aprobación real del examen municipal (no hay dato oficial; `student_surveys.obtained_license`
  es autodeclarado — se deja para una iteración futura).
- ❌ Rediseñar Contabilidad/Reportes (`admin/contabilidad-reportes`).
- ❌ Ventas de servicios especiales (`special_service_sales`) en "Ingresos" (D4).
- ❌ Cursos singulares (`standalone_course_enrollments`) — no son Clase B.

---

## 5. Dependencias

### Specs previas
- Ninguna bloqueante.

### Capacidades del proyecto que se asumen existentes
- `DashboardFacade` (hoy alimenta `/admin/dashboard`), `DashboardAlertsFacade`, `BranchFacade`,
  `createRequestGuard()`, `app-kpi-card`, `app-section-hero`, `app-empty-state`,
  `app-skeleton-block`, patrón app-like (`.bento-grid--fill-screen*`).
- Tablas: `payments`, `expenses`, `fixed_expenses`, `instructor_monthly_payments`,
  `enrollments`, `class_b_sessions`, `class_b_exam_scores`, `instructors`, `vehicles`.
- El dashboard de secretaria ya es un componente separado
  (`features/secretaria/dashboard/secretaria-dashboard.component.ts`, ruta
  `/secretaria/dashboard`) → **no hace falta dividir componentes** para aislar a la secretaria.

### Capacidades nuevas requeridas
- Funciones SQL/RPC de agregación (decisión D3) para KPIs, series de 24 meses (año actual +
  anterior), cartera por antigüedad y horas por instructor — sin traer filas crudas al cliente.
- Librería/componente de gráficos de líneas (verificar en `indices/COMPONENTS.md` si ya existe
  uno; si no, evaluar Chart.js vía PrimeNG `p-chart`).

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna tabla nueva. Funciones SQL/RPC de agregación nuevas (D3), vía migración idempotente.
- Modelos UI nuevos: `ExecutiveKpi` (valor + Δ período + Δ YoY), `MonthlySeries`,
  `InstructorHoursRow`, `StudentStageCounts`, `ReceivableAging` en `core/models/ui/`.
- RLS requerida: las agregaciones deben respetar RLS (`security_invoker` / `SECURITY INVOKER`) y
  ser solo-admin.

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): `/admin/dashboard` (`features/dashboard/dashboard.component.ts`).
- Estructura propuesta (orden de lectura):
  1. Hero con filtro de período (+ sede global del shell).
  2. Fila de KPIs financieros: Ingresos · Gastos · Resultado operacional · Saldo por cobrar.
  3. Fila de KPIs comerciales/operativos: Nuevas matrículas · Alumnos activos · Clases
     realizadas · Tasa de cancelación.
  4. Gráficos: Ventas mensuales | Matrículas y estacionalidad.
  5. Paneles: Horas por instructor | Estado de alumnos + ensayos de examen | Cartera por antigüedad.
  6. Bloque compacto: Operación de hoy + Alertas.
- Estados especiales: skeleton en primera carga; SWR en cambios de filtro; `app-empty-state` sin
  datos; error por sección.

---

## 8. Métricas de éxito post-launch

- El admin abre `/admin/dashboard` al menos 3 veces por semana (medible vía `audit_log`/analytics
  si existe).
- Los KPIs financieros declaran explícitamente su alcance ("Solo Clase B", "incluye sueldos
  devengados de instructores") y la diferencia con Reportes Contables (que suma todos los cursos
  y no incluye sueldos de instructores) es explicable partida por partida en el primer cierre de
  mes con el dueño. Alinear Reportes Contables queda fuera de esta spec (ticket aparte).

---

## 9. Notas / decisiones abiertas

- [x] ~~¿Separar el dashboard admin del de secretaria?~~ **Resuelto:** ya son componentes y rutas
      separadas (`/admin/dashboard` vs `/secretaria/dashboard`). Se rediseña solo el de admin.
- [x] **D1 — Etapas de alumno. Resuelto (owner, 2026-09-27):** `enrollments.status` solo tiene
      `draft | pending_docs | active | completed | cancelled`. "Pendiente de examen municipal" =
      `status='active'` y `certificate_enabled = true` (lo pone el trigger
      `verify_class_b_certificate_enablement` al completar clase 12 + 100% teoría).
- [x] **D2 — Costo de instructores. Resuelto (owner, 2026-09-27):** los sueldos de instructores
      viven **solo en Liquidaciones** (no en `fixed_expenses`, sin doble conteo) y se cuenta lo
      **devengado**, no lo pagado. Regla de cálculo en AC4.
      - Hallazgo: `instructor_monthly_payments` solo tiene fila cuando el mes ya se pagó
        (`LiquidacionesFacade.registrarPago()`), por eso el mes en curso se calcula en vivo.
      - ⚠️ Riesgo conocido: meses pasados no liquidados se valorizan con la tarifa **actual** de la
        sede (no hay historial de tarifas). Aceptable para fase 1; documentar en el tooltip.
      - Supuesto: la categoría "sueldos" de `fixed_expenses` corresponde a otro personal
        (secretarias, etc.), así que se suma completa.
- [x] **D3 — Dónde se agrega. Resuelto (owner, 2026-09-27):** funciones SQL/RPC. El Facade solo
      llama a las RPC y mapea DTO → modelo UI; la matemática de Δ% y formato va en funciones puras
      de `core/utils/` (testeables sin Angular).
- [x] **D4 — Servicios especiales. Resuelto (owner, 2026-09-27):** **no** se incluyen en
      "Ingresos" en esta fase (ver Out of scope).
- [x] **D5 — Pagos a contar. Resuelto (investigado en código, 2026-09-27):** contar
      `status IN ('paid', 'completado')`.
      - `'paid'` es lo que escriben todos los flujos reales (`PagosFacade.registrarNuevoPago()` y
        la RPC `confirm_enrollment_with_payment`), y es lo que suma `recalculate_enrollment_balance`
        para el saldo del alumno.
      - `'pending'` solo lo produce la RPC al confirmar una matrícula **sin pago inicial**: es un
        placeholder de deuda con $0 recibido y `payment_date = NULL` (fix-135-m). No es ingreso.
      - `'completado'` no lo escribe ningún flujo actual, pero `CuadraturaFacade` lo incluye
        (`.in('status', ['paid','completado'])`). Se incluye igual para que el dashboard **cuadre
        con Cuadratura** si existen filas legacy.
      - No existe estado "anulado": anular un pago es `DELETE` (solo admin), así que la fila
        desaparece sola.
      - Hallazgo lateral: el `DashboardFacade` actual y `ReportesContablesFacade` **no filtran por
        status**; hoy no suman placeholders solo porque `payment_date` es `NULL` y cae fuera del
        rango de fechas. Las RPC nuevas filtran explícito para no depender de eso.
- Originado de Asignación ASG-m-008 (specs/assignments/ASG-m-008-dashboard-admin-kpis-empresa.md)

---

## Changelog

- 2026-09-27 — draft inicial por Benjamín (reclamada desde ASG-m-008)
- 2026-09-27 — borrador de US (8) y ACs (23 + 5 edge cases); decisiones D1–D5 abiertas
- 2026-09-27 — D1 y D3 resueltas por el owner; D5 resuelta investigando el código. Quedan D2 y D4.
- 2026-09-27 — D2 (liquidaciones, devengado) y D4 (sin servicios especiales) resueltas. Status → approved.
- 2026-09-27 — métrica de éxito §8 ajustada: el dashboard no cuadra 1:1 con Reportes Contables por diseño (alcance Clase B + sueldos).
