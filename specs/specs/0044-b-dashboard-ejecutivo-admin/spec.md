# Spec 0044-b — Dashboard Ejecutivo de Admin (fase 1: Clase B)

> **Status:** draft
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
Hoy admin y secretaria comparten el mismo dashboard (`features/dashboard/`), orientado a operar
el día: 4 KPIs operativos (Alumnos activos, Clases hoy, Ingresos mes, Vehículos) y accesos
rápidos tipo secretaria (Matricular, Registrar pago, Agenda, Registrar egreso). El admin no tiene
una vista de **cómo va el negocio**: ingresos vs. año anterior, margen real, estacionalidad de
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
{{1 frase. Qué creemos que mejora cuando esto exista. Métrica si aplica.}}

---

## 2. User Stories

- **US1**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.
- **US2**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.
- **US3**: …

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given {{precondición}}, When {{acción}}, Then {{resultado observable}}.
- **AC2**: Given {{precondición}}, When {{acción}}, Then {{resultado observable}}.
- **AC3**: …

### Edge cases obligatorios

- **AC-E1**: Given {{caso límite}}, When …, Then …
- **AC-E2**: …

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Cambios al dashboard de Secretaria.
- ❌ KPIs de Clase Profesional (fase posterior).
- ❌ {{otra cosa que NO va}}

---

## 5. Dependencias

### Specs previas
- (IDs de specs que deben estar `done` antes, o "ninguna")

### Capacidades del proyecto que se asumen existentes
- `DashboardFacade` (hoy compartido admin/secretaria), `BranchFacade`, `app-kpi-card`,
  `app-section-hero`, patrón app-like (`.bento-grid--fill-screen*`).
- Tablas: `payments`, `expenses`, `fixed_expenses`, `instructor_monthly_payments`,
  `enrollments`, `class_b_sessions`, `class_b_exam_scores`, `instructors`, `vehicles`.

### Capacidades nuevas requeridas
- {{ej. funciones SQL/vistas de agregación para series 12 meses año actual vs anterior}}

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: …
- Modelos UI nuevos: …
- RLS requerida: …

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): dashboard de admin (`features/dashboard/`, a separar del de secretaria).
- Flujo principal (happy path): …
- Estados especiales (loading, error, vacío): …

---

## 8. Métricas de éxito post-launch

- {{métrica 1}}
- {{métrica 2}}

---

## 9. Notas / decisiones abiertas

- [ ] ¿Cómo se deriva hoy "Pendiente de examen municipal" y "Finalizado/Aprobado" en Clase B?
      Verificar valores reales de `enrollments.status` antes de definir el panel de estado de alumnos.
- [ ] ¿Separar el dashboard admin en un componente propio o bifurcar dentro de `dashboard.component.ts`?
- [ ] ¿Agregaciones en SQL (funciones/vistas) o en el Facade? Relevante para las series de 24 meses.
- [ ] ¿Qué cuenta como "Ingresos": `payments` de matrícula solamente, o también `special_service_sales`?
- Originado de Asignación ASG-m-008 (specs/assignments/ASG-m-008-dashboard-admin-kpis-empresa.md)

---

## Changelog

- 2026-09-27 — draft inicial por Benjamín (reclamada desde ASG-m-008)
