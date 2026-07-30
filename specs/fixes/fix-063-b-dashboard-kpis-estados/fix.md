# Fix: Dashboard admin — KPI Vehículos en 0, formato roto Ingresos Mes, estados contradictorios
> id: fix-063-b-dashboard-kpis-estados
> refs: ASG-b-018 (specs/assignments/ASG-b-018-dashboard-kpis-vehiculos-ingresos.md)
> status: done
> closed: 2026-07-28
> created: 2026-07-28

## Root Cause

**H-001 (confirmado):** el dominio real de `vehicles.status` en BD es `'operational' | 'in_use' |
'maintenance' | 'out_of_service' | 'blocked'` (comentario de columna en
`20260301000007_07_vehicles_and_fleet.sql:19`, y el seed de dev inserta siempre `'operational'`).
`dashboard.facade.ts:281` compara `v.status === 'available'` — un valor que NUNCA existe en BD,
así que el KPI "Vehículos" da 0 siempre. `flota.facade.ts` tiene un `resolveStatus()` privado que
mapea a los estados de UI (`VehicleStatus = 'available'|'in_class'|'maintenance'|'out_of_service'`)
pero **no incluye `'operational'`** en su mapa — cae al fallback `?? 'available'`, que "por
casualidad" da el resultado correcto en la tabla de Flota (por eso ese bug quedó invisible ahí),
pero enmascara el mismo desajuste. Además, el propio `kpis` computed de `flota.facade.ts` (líneas
48-56) tiene el MISMO bug: compara `v.status === 'available'` / `'in_class'` directo contra el
valor crudo de BD, sin pasar por `resolveStatus()` — hallado al revisar el archivo declarado en
la asignación, mismo root cause, no es scope nuevo.

**H-002 (confirmado):** el KPI "Ingresos Mes" pasa por `dashboard.facade.ts` → `DashboardKpi`
(que sí tiene `trendSuffix`, pero el KPI `'revenue'` nunca lo setea) → `dashboard.component.ts`
`heroKpis` computed (que ni siquiera **pasa** `trendSuffix` al mapear a `SectionHeroKpi` — ese
modelo no tiene el campo) → `section-hero.component.ts`, cuyo `getTrendDisplay()` solo devuelve
`String(Math.abs(trend))` (sin `%`) y el template concatena
`{{ getTrendDisplay(...) }}{{ kpi.trendLabel ?? '' }}` **sin espacio**. Resultado: `"▼ 60vs mes
pasado"`. `section-hero` es compartido — otras 4 páginas (`dashboard.facade.ts` x2, `admin-
contabilidad-cursos`, `asistencia-clase-b-content`) usan `trendLabel` como frase descriptiva
("vs ayer", "vs mes anterior") con el mismo bug latente de falta de espacio, y
`liquidaciones-content.component.ts:823` usa `trendLabel: '%'` como workaround intencional
(explota la falta de espacio para pegar el símbolo). Cualquier fix debe preservar ese caso.

**H-008 (a confirmar en vivo):** el hallazgo original (`indices/FLOWS-QA-AUDIT.md:325-326`, del
21-07) describe una clase mostrando "Por Iniciar" y "Transcurriendo" a la vez. Revisando
`live-classes-panel.component.ts` (el componente real de "Clases Actuales"), `statusLabel()` y
`getRelativeTime()` son mutuamente excluyentes por status (`'pending'`→"Por Iniciar",
`'in_progress'`→"En Curso"/"Transcurriendo") — no debería poder darse esa combinación literal tal
como está el código hoy. Se verificará en vivo con datos reales de hoy antes de decidir el fix
(dato de hace 7 días, puede haber cambiado o ser un caso borde de clase vencida sin iniciar).

## ACs Afectados
Ninguno — fix autónomo (bug real detectado en Auditoría QA de Flujos, hallazgos H-001/H-002/H-008).

## Cambio
- **Nuevo** `src/app/core/utils/vehicle-status.utils.ts` — extrae `resolveVehicleStatus()` (Núcleo
  Funcional, mismo patrón que `payment-concept.utils.ts` en fix-062), mapeo canónico completo
  incluyendo `'operational'`→`'available'`, `'in_use'`→`'in_class'`, `'blocked'`→`'out_of_service'`.
- `flota.facade.ts`: `resolveStatus()` privado pasa a usar el util nuevo; `kpis` computed usa el
  mapeo canónico en vez de comparar contra el string crudo de BD.
- `dashboard.facade.ts`: KPI `'vehicles'` usa el mismo util para contar `'available'`; KPI
  `'revenue'` agrega `trendSuffix: '%'`.
- `src/app/core/models/ui/section-hero.model.ts`: agrega `trendSuffix?: string` a `SectionHeroKpi`.
- `dashboard.component.ts`: `heroKpis` computed pasa `trendSuffix: k.trendSuffix`.
- `section-hero.component.ts`: template arma el trend como
  `{{ getTrendDisplay(...) }}{{ kpi.trendSuffix ?? '' }}{{ kpi.trendLabel ? ' ' + kpi.trendLabel : '' }}`
  (mismo patrón que ya usa `kpi-card.component.ts`) — corrige el espacio faltante para todas las
  páginas que usan `trendLabel` como frase, sin romper el caso de `liquidaciones-content`.
- `liquidaciones-content.component.ts`: migra `trendLabel: '%'` (hack) a `trendSuffix: '%'` (campo
  correcto), sin cambio visual.
- **H-008 (confirmado en vivo, variante distinta a la literal):** con datos reales de hoy
  (2 clases de la mañana, hora actual de la sesión ~17:00), ambas siguen `status='pending'`
  y muestran **"Por Iniciar" + "Hace 6 h"** / **"Hace 5 h"** — no literalmente "Transcurriendo",
  pero la misma contradicción de fondo: una clase "por iniciar" junto con "ya pasó hace 6
  horas" confunde igual. Es el mismo caso borde de `getRelativeTime()` línea 324-329
  (`diffMs <= 0` para status `'pending'`) — clase vencida que nadie marcó `in_progress`.
  `live-classes-panel.component.ts` (`getRelativeTime()`): el texto para ese caso cambia de
  `"Hace X min/h"` a `"Debía iniciar hace X min/h"` — dejó de leerse como si estuviera en
  curso.

## Test de Regresión
- `src/app/core/utils/vehicle-status.utils.spec.ts` (nuevo, 8 casos): los 5 valores de BD +
  case-insensitive + fallback null/undefined/desconocido.
- `flota.facade.spec.ts` + `dashboard.facade.spec.ts`: 17/17 verdes sin cambios (no asumían el
  comportamiento roto).
- `live-classes-panel.component.spec.ts`: 2 casos existentes actualizados al nuevo texto
  ("Debía iniciar hace X min/h"), 9/9 verdes.
- Verificación en vivo (Playwright) del Dashboard admin con datos reales de hoy: KPI Vehículos = 6
  (antes 0), "Ingresos Mes: $0.81M — ▲ 80% vs mes pasado" (antes "▼ 60vs mes pasado" sin espacio ni
  %), "Alumnos Activos"/"Clases Hoy" siguen sin `%` (correcto, son conteos) con espacio correcto,
  "Clases Actuales" ya no muestra "Por Iniciar" + "Hace X h" contradictorio (ahora "Debía iniciar
  hace 6 h" / "Debía iniciar hace 5 h").
- **Liquidaciones (caso `trendSuffix: '%'` sin `trendLabel`, migrado del hack `trendLabel: '%'`) —
  verificado en vivo (post-cierre, a pedido del owner):** el flujo real "Pagar" → "Deshacer" ya
  existe en la UI (`registrarPago()`/`deshacerPago()` en `liquidaciones.facade.ts`), así que se usó
  ese mecanismo oficial en vez de mutar `instructor_monthly_payments` por SQL directo. Se pagó a
  Julio Verstappen (efectivo, $4.000) → KPI "Pagados" pasó de "0 / 4" (sin badge, `trend=0`) a
  **"1 / 4 — ▲ 25%"** (sin espacio antes del `%`, igual que "Ingresos Mes"). Confirmado visualmente
  y sin errores de consola. Se deshizo el pago inmediatamente con el botón "Deshacer" → volvió a
  "0 / 4", fila de Julio Verstappen de nuevo en "Pendiente" con botón "Pagar" — estado restaurado
  sin residuos.
- **H-008 — auditoría exhaustiva de combinaciones (a pedido del owner, no solo el caso observado):**
  `LiveClassModel.status` está tipado a exactamente 3 valores (`'pending' | 'in_progress' |
  'completed'`); `dashboard.facade.ts:362-364` confirma que el mapeo desde `class_b_sessions.status`
  crudo colapsa todo a esos 3 (más `no_show`→`completed`), y `'cancelled'` se filtra antes de llegar
  a la UI (`.neq('status','cancelled')`) — nunca renderiza. Se auditaron las 4 combinaciones posibles
  de `statusLabel()` + `getRelativeTime()` + ícono/color (`live-classes-panel.component.ts:117-202`):
  - `pending` + hora futura → "Por Iniciar" + "En X min/h" — consistente.
  - `pending` + hora pasada → "Por Iniciar" + "Debía iniciar hace X min/h" — **era el bug, ya
    corregido**.
  - `in_progress` (cualquier hora) → "En Curso" + "Transcurriendo", ícono `play` pulsante — consistente.
  - `completed` (cualquier hora) → "Finalizada" + "Concluida", ícono `chevron-right` — consistente.
  No queda ninguna combinación adicional posible dado el dominio de 3 valores — el único caso
  contradictorio era el ya corregido.

## Notas
- H-008 puede terminar siendo "sin bug reproducible hoy" si los datos de clases ya no reproducen
  el estado descrito — se documentará la conclusión en este mismo archivo antes de cerrar.
