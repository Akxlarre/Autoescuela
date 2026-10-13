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

<!-- Una sección por bloque: tabla Caso | Res. | Evidencia -->

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
