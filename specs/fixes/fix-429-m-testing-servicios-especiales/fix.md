# Fix: Testing — Servicios especiales
> id: fix-429-m-testing-servicios-especiales
> refs: ASG-i-031
> status: in_progress
> created: 2026-10-15

> **Track de testing, no de corrección.** Acá se registra el resultado de cada caso (✅ / ❌ +
> evidencia). **Cada bug encontrado va a su propio fix/hotfix**; no se corrige dentro de este
> track.
>
> **Checklist que se ejecuta:** `specs/testing-piloto/031-servicios-especiales.md`.

## Root Cause

[Heredado de ASG-i-031, a confirmar]: Venta de servicios sueltos (psicotécnico, etc.) a alumnos o
clientes externos. Es un módulo bastante autocontenido; su única conexión fuerte es que la venta
tiene que entrar a caja y reportes.

**Clasificación:** Funcional · dificultad Baja · rutas: `/app/{admin,secretaria}/servicios-especiales`.

### Alcance confirmado al reclamar (Matías, 2026-10-15)

Las 3 capas de la ASG entran en este track:

1. **Funcional** — ACs de `fix-021-i` (app-like), `fix-022-i` (borrar servicio) y `ASG-b-050`
   (borrar/anular ventas).
2. **E2E manual** — los casos A…O del checklist, incluidas las sospechas abiertas.
3. **Playwright** — venta → assert del KPI "Total recaudado", en la suite de `0019-m` (`e2e/`).

Los hallazgos se corrigen en la misma sesión, cada uno en su propio fix/hotfix.

**El checklist es anterior a varios fixes.** Lectura rápida del código al reclamar (sin navegador):

| Sospecha | Estado aparente | Cómo se ejecuta |
|---|---|---|
| S2 — ventas fuera de Reportes/Dashboard | `reportes-contables.facade.ts` y `dashboard.facade.ts` ya leen `special_service_sales` | Regresión |
| S3 — fecha UTC | El facade usa `chileToday()`/`chileMonth()` (`0024-m`) | Regresión |
| S4 — sin medio de pago | Migración `20261012120000_fix047_special_service_sales_payment_method` | Regresión |
| S5 — RLS sin sede | Migración `20261001150000_rls_aislamiento_por_sede` | Regresión |
| S1 — export sin control de acceso | La edge function no llama a `auth.getUser()` | Abierta |
| S7 — límite de 200 ventas | Sigue `.limit(200)` | Abierta |
| S8 — venta a alumno sin vínculo | Sigue `student_id: null` | Abierta (depende de decisión) |
| S6, S9–S16 | Sin revisar | Abiertas |

### Decisiones de negocio (§5 del checklist)

No se marcan ✅/❌. Revisadas contra código y fixes posteriores al checklist el 2026-10-15.

**Ya decididas (se ejecutan como regresión):**

| Caso | Decisión | Origen |
|---|---|---|
| G19 / L02 | La venta registra medio de pago (Efectivo por defecto); la Caja la pone en esa columna | `fix-047-i` |
| L04 / L06 | Suman en Reportes Contables, PDF financiero y Dashboard secretaria; el ejecutivo queda fuera del piloto | `fix-047-i` |
| H08 | Admin en "Todas" → campo Sede obligatorio | `fix-194-b` |
| G13 | El DV del RUT se corrige solo al salir del campo | `fix-064-b` |
| J03 | Solo la caja **cerrada** bloquea borrar una venta; en borrador se puede | `borrarVenta()`, criterio de `ASG-b-037` |

S1 (export sin control de acceso) quedó cerrada por `fix-043-i` (`requireStaff`).

**Decididas por Matías al reclamar (2026-10-15), cada una se implementa en su propio fix:**

| Caso | Decisión |
|---|---|
| H02 / G09 | Si el RUT de la venta es de un alumno, la venta se vincula a él (`student_id`) automáticamente: aparece en su ficha y dispara la notificación. Se elimina el select "Tipo de cliente". |
| L08 / B06 | Revertir una venta desde Caja la **borra** (mismo candado de caja cerrada). No existe estado "pendiente" en el módulo (`fix-025-i`). |
| M08 / D09 / E10 | Catálogo común a las dos sedes. Solo admin crea/edita/borra servicios; la secretaria solo vende (el precio es editable en la venta). |
| I10 | Búsqueda por nombre o RUT del cliente en el Historial (client-side). |
| K04 / K07 | El export respeta filtro de servicio y período, usa el nombre guardado en la venta, agrega N° boleta, medio de pago y total; quita Estado/Pagado. |
| D05 | No se permiten dos servicios con el mismo nombre (sin distinguir mayúsculas); si el duplicado está inactivo, se sugiere reactivarlo. |
| H05 | Toast "Venta registrada" al guardar. |
| E07 | El drawer de editar servicio permite cambiar la descripción. |

### Fuera de alcance

- Los flujos por dentro de Caja Diaria / Cuadratura (`029`) y Reportes: acá solo que la venta se
  refleja en ellos.

## Resultados

### Bloque 1 — Seguridad (2026-10-15)

RLS probada con transacciones que terminan en `RAISE EXCEPTION` (nada se aplica), suplantando a
`secretaria@test.com` (sede 1) y `admin@test.com`. Edge functions llamadas con el token real de
cada cuenta (`sec.cjs`, `sec2.cjs` en el scratchpad).

| Caso | Res. | Evidencia |
|---|---|---|
| M07 — secretaria A lee ventas de B | ✅ | 0 filas |
| M07 — secretaria A inserta / modifica / borra ventas de B | ✅ | INSERT rechazado; UPDATE y DELETE 0 filas; mover una venta propia a B, rechazado |
| H07 — venta sin sede desde la consola | ❌ | La secretaria A inserta `branch_id = NULL` (la policy acepta `branch_id IS NULL`). `fix-194-b` solo lo impide en el formulario. Ya existe 1 venta así (#3) |
| J09 — borrar una venta de un día con caja cerrada desde la consola | ❌ | Admin borra la venta #10 (2026-08-27, sede 2, caja cerrada): 1 fila. `guard_movimiento_caja_cerrada()` no cubre `special_service_sales` |
| M08 — secretaria edita el catálogo | ❌ (por decisión) | UPDATE de `service_catalog` como secretaria: 1 fila. La decisión M08 deja el catálogo solo a admin |
| K09 / S1 — export sin sesión / anon key | ✅ | 401 (`fix-043-i`) |
| K09 — export instructor | ✅ | 403 |
| K09 — secretaria A exporta la sede B | ❌ | 200 con las 4 ventas de la sede 2 (nombre y RUT); con `branch_id: null` trae las 6 de todas las sedes. La función usa la clave de servicio y confía en el `branch_id` del navegador |
| — mismo patrón en otras funciones | ❌ | Con el token de la secretaria A y `branch_id: 2`: `generate-financial-report` (reporte contable de la sede 2), `generate-cash-closing-report` (cuadratura de la sede 2) y `export-certificates-zip` (ZIP con certificados de la sede 2) responden 200 |
| A03 / A04 — acceso por rol | ✅ (código) | `hasRoleGuard(['admin'])` / secretaria en `app.routes.ts`; se confirma en navegador |

### Sospechas revisadas en código (2026-10-15)

| Sospecha | Estado |
|---|---|
| S1 | Resuelta por `fix-043-i` (sin sesión → 401); quedaba la sede → `fix-430-m` |
| S2, S4 | Resueltas por `fix-047-i` (regresión en navegador pendiente: bloque 2) |
| S3 | Resuelta por `0024-m`: venta registrada a las 22:57 del 15-10 (01:57 UTC del 16) quedó con `sale_date` 2026-10-15 ✅ (H06) |
| S5 | Resuelta por spec `0047-b` (M07 ✅); quedaban venta sin sede → `fix-433-m` |
| S6 | ❌ → `fix-435-m` |
| S7 | ❌ → `fix-442-m` |
| S8 | ❌ → `fix-438-m` (decisión H02) |
| S9 | ❌ → `fix-437-m` (decisión L08) |
| S10 | ❌ → `fix-440-m` (decisión K04/K07) |
| S11 | Resuelta por `fix-213-b`: `completeRutDv` solo calcula el DV si falta (`11111111` → `11.111.111-1`) ✅ |
| S12 | Pendiente (bloque 2) |
| S13 | ❌ → `fix-441-m` |
| S14 | `special_service_sales` ya está en `supabase_realtime` (`fix-360-m`); el módulo no tiene canal propio (ver N01) |
| S15 | Decisión M08 → `fix-434-m` |
| S16 | Solo espacios → `fix-436-m`; candado solo en navegador → `fix-432-m`; resto pendiente (bloque 2) |

## Fixes derivados

| Track | Qué corrige | Requiere |
|---|---|---|
| `fix-430-m` | Exportaciones (7 edge functions) validan la sede en el servidor | Deploy de 7 funciones |
| `fix-431-m` | Funciones por matrícula (6 edge functions) validan la sede | Deploy de 6 funciones |
| `fix-432-m` | La BD protege las ventas de un día con caja cerrada (J09) | Migración `20261015130000` |
| `fix-433-m` | La BD exige sede en toda venta (H07) | Migración `20261015140000` |
| `fix-434-m` | Solo el admin administra el catálogo (M08) | Migración `20261015150000` |
| `fix-435-m` | Errores visibles, toast al vender (H05), aviso si la carga falla | — |
| `fix-436-m` | Nombre único (D05), descripción editable (E07), sin solo espacios | Migración `20261015160000` |
| `fix-437-m` | Eliminar desde Caja borra la venta (L08) | — |
| `fix-438-m` | Venta a alumno vinculada por RUT, en su ficha y con notificación (H02/G09) | — |
| `fix-439-m` | Buscador por cliente, RUT o boleta en el Historial (I10) | — |
| `hotfix-157-m` | Filtros del Historial hacen wrap | — |
| `fix-440-m` | El export trae lo que muestra la pantalla (K04/K07) | Deploy de `export-special-services` |
| `fix-441-m` | Recarga al cambiar de sede + guard de respuestas (S13) | — |
| `fix-442-m` | KPIs en la BD sin tope (S7) | Migración `20261015170000` (**la pantalla la necesita**) |

## Test de regresión

Suite e2e del módulo (capa 3).
