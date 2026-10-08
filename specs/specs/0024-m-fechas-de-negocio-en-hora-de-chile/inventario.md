# Inventario de zonas horarias — spec 0024-m

> Barrido del 2026-10-08 sobre `src/app` (sin `*.spec.ts`), `supabase/functions` y
> `supabase/migrations`. Reemplaza y amplía `specs/testing-piloto/037-transversal-multisede-shell.md` §1.8.
>
> **Es un inventario por patrón, con conteos de grep.** No clasifica cada ocurrencia como "bug" o
> "segura": esa clasificación la hace el guardrail (ver §6) — cuando la regla esté activa, toda
> ocurrencia que quede es un error de lint o una excepción justificada, y la lista deja de depender
> de que alguien no se salte ninguna.

## 1. App — "hoy" calculado en UTC

Patrón: `toISOString().slice(0, 10)` / `.split('T')[0]` / `.slice(0, 7)`. **43 ocurrencias.**

| Grupo | Archivos |
|---|---|
| Fecha que se **escribe** en la BD | `enrollment-payment.facade:267`, `admin-pre-inscritos.facade:301`, `relatores.facade:173`, `registrar-venta-drawer:274`, `registrar-anticipo-drawer:160`, `registrar-egreso-drawer:596`, `registrar-gasto-fijo-drawer:243`, `maintenance-form-drawer:242,268`, `descuentos-drawer:370` |
| "Hoy" para **filtrar o comparar** | `enrollment-payment.facade:175`, `enrollment.facade:403`, `dashboard-alerts.facade:214,235`, `flota.facade:319`, `instructor-clases.facade:515,524,668`, `student-home.facade:384`, `certificacion-profesional.facade:386`, `servicios-especiales.facade:141` (mes actual), `admin-sesion-drawer:441`, `week-matrix:209`, `instructor-horario.component:118`, `public-personal-data:36,588` |
| Instante de la BD **convertido a día** | `certificacion-clase-b.facade:574`, `instructor-horas.facade:260,359` |
| Fecha derivada de un `Date` local (seguras hoy solo por construcción) | `schedule-grid:368`, `reprogramar-clase-drawer:465`, `libro-de-clases.facade:845`, `asistencia-profesional.facade:815`, `promotion-end-date.utils:16`, `admin-instructor-crear-drawer:627`, `admin-instructor-editar-drawer:753`, `admin-promocion-crear-drawer:42`, `announcement-composer-drawer:47` |
| Solo nombre de archivo descargado | `admin-alumnos.facade:323`, `auditoria.facade:272`, `certificacion-clase-b.facade:434`, `certificacion-profesional.facade:366`, `servicios-especiales.facade:539` |

## 2. App — instantes de la BD cortados a día

Patrón: `.slice(0, 10)` / `.substring(0, 10)` sobre un string que viene de la BD. Da el día UTC del
registro. **60 ocurrencias en 43 archivos** contando las 43 de §1; las restantes (~17) son cortes
sobre strings, entre ellas `admin-alumnos.facade`, `flota-detalle.facade`, `notifications.facade`,
`period-window.utils`, `license-status.utils`, `reportes-contables.utils` (3),
`secretaria-dashboard.component`, `daily-agenda-drawer`, `admin-pre-inscrito-drawer`,
`secretaria-pagos.component`, `admin-pagos.component`, `asistencia-clase-b-content`.

Es seguro solo cuando el string ya es una fecha pura (`date`). Sobre un `timestamptz` es bug.

## 3. App — rangos de día sin zona

Patrón: `` `${fecha}T00:00:00` `` / `T23:59:59` sin offset en `.gte()` / `.lte()`. Postgres lo
interpreta en la zona de la sesión (UTC), así que el "día" queda corrido 3–4 horas.

| Archivo | Columna |
|---|---|
| `dashboard.facade:141,147-148,154-155,395-396,411` | `created_at`, `scheduled_at` |
| `cuadratura.facade:349-350` | rango del día de caja |
| `reportes-contables.facade:367-368,497-498` | `paid_at`, `scheduled_at` |
| `flota.facade:327-328` | `scheduled_at` |
| `auditoria.facade:184,187` | `created_at` |
| `asistencia-clase-b.facade:28` | rango del día consultado |
| `enrollment.facade:862,2122`, `admin-alumno-detalle.facade:1458` | `slot_start` (tope superior) |
| `agenda.facade:317` | `T00:00:00Z` explícito: la semana parte a medianoche UTC |

La util correcta existe (`getChileDateTimeRange`) pero tiene dos bordes propios:

- Calcula el offset a mediodía; el día del cambio de horario la medianoche tiene otro offset.
- El fin es `T23:59:59` con `.lte()`: pierde lo ocurrido en el último segundo. Lo robusto es un
  rango semiabierto `[inicio del día, inicio del día siguiente)`.

## 4. App — aritmética y formato con el reloj del equipo

No es bug con el equipo en hora de Chile; sí lo es en cualquier otra zona. Con "Chile explícito"
(decisión del 2026-10-08) todo esto debe pasar por la util.

| Patrón | Tamaño |
|---|---|
| `getFullYear/getMonth/getDate/getDay/getHours`, `setHours/setDate/setMonth` | 177 ocurrencias en 52 archivos |
| `toLocaleDateString/TimeString`, `Intl.DateTimeFormat`, pipe `date` (incluye formato de números, a descontar) | 136 ocurrencias en 74 archivos |
| `todayIso()` / `toISODate()` (hora local del navegador) | 68 usos en 26 archivos — se corrigen cambiando la util |
| `new Date(fecha + 'T00:00:00')` (medianoche local) | `promociones.facade:678`, `admin-promocion-editar-drawer:345,375`, `enrollment.facade:1142-1143`, `admin-alumno-detalle.facade:1222`, `student-home.facade:499` |

En `date.utils.ts`: `to24hTime` ya fija `America/Santiago`; `formatChileanDate` y `buildDayLabel`
no fijan zona.

## 5. Edge functions (el reloj siempre es UTC)

| Patrón | Dónde |
|---|---|
| "Hoy" en UTC que **se escribe** | `create-instructor:345,366`, `update-instructor:303,314`, `generate-certificate-b-pdf:261`, `generate-certificate-professional-pdf:213` (`issued_date`) |
| "Hoy" en UTC como **default de reporte** | `generate-cash-closing-report:59`, `generate-financial-report:78`, `generate-payroll-report:144-145`, `generate-cash-history-report:58-59` |
| "Hoy" en UTC en nombre de archivo o folio | `generate-audit-report:281,332`, `export-certificates-zip:178`, `generate-contract-pdf:173`, `export-certificates-zip:135-136`, `send-certificate-email:200-201` |
| Fecha y hora **impresas** sin zona | `generate-cash-history-report:563,572`, `generate-cash-closing-report:965,975,983`, `generate-payment-report:703,712`, `generate-financial-report:1005,1014,1028`, `generate-payroll-report:310,346,438`, `generate-audit-report:304,423`, `generate-enrollment-sheet:619`, `generate-class-book-pdf:328,333`, `_shared/contract-pdf:108,115`, `generate-certificate-b-pdf:378,401`, `generate-certificate-professional-pdf:329,352`, `auto-create-next-promotions:80` |
| Comparaciones con `setHours(0,0,0,0)` / edad | `create-instructor:160-162`, `update-instructor:57-59`, `public-enrollment:2139-2141` |
| Ya correctos (modelo a copiar) | `student-payment:781+`, `public-enrollment:2172+`, `generate-audit-report:103,108`, `_shared/enrollment-sheet-format`, `_shared/ficha-tecnica-pdf`, `generate-student-license-pdf` |

## 6. SQL

`CURRENT_DATE` / `now()::date`: **46 ocurrencias en 23 migraciones**. Muchas son definiciones ya
reemplazadas; lo que cuenta es la definición vigente de cada objeto, que hay que leer del esquema
real y no de la historia de migraciones.

| Objeto | Uso | Migración más reciente vista |
|---|---|---|
| Policy `cash_closings` de la secretaria | `date >= CURRENT_DATE - 2 days` | `20260301000011:749` |
| Vista de disponibilidad de agenda Clase B | `CURRENT_DATE::TIMESTAMP` y `+ 28 days` | `20261007120000_fix196:85-86` |
| RPC confirmar matrícula con pago | `payment_date = CURRENT_DATE` | `20261006150000_fix191:127` |
| Triggers de vencimiento (documentos, licencia) | `expiry_date < CURRENT_DATE` | `20260301000008:210-212,297-300` |
| `auto_transition_promotion_status` | `start_date`/`end_date` vs `CURRENT_DATE` | `20260330100000:25,32-33` |
| `auto_transition_standalone_course_status` | `start_date <= CURRENT_DATE` | `20260615120000:17` |
| `auto_transition_theory_cycle_status`, `ensure_theory_cycle` | `end_date < CURRENT_DATE` | `20260630000000:230,252` |
| `notify_vehicle_document_expiry` | `expiry_date = CURRENT_DATE` | `20260710010000:28-32` |
| CHECK de edad mínima en `users` | `birth_date <= CURRENT_DATE - 17 years` | `20260301000001:102` |

**Tipos de columna:** el grep no encontró columnas `timestamp` sin zona, solo casts
(`::timestamp` en la vista de agenda, en `executive_dashboard_rpcs:76-77` y en un backfill).
A confirmar contra `information_schema.columns` en la BD real.

**Cron (`pg_cron`, siempre en UTC):**

| Job | Horario UTC | Hora Chile | Riesgo |
|---|---|---|---|
| `mark-end-of-day-class-b-absences` | 01:00 | 21:00 invierno / 22:00 verano | Corre con el día UTC ya cambiado; el corte se mueve una hora con el cambio de horario |
| `auto-transition-promotion-status`, `…standalone-course…`, `…theory-cycle…`, `notify-vehicle-document-expiry`, `auto-create-next-promotions` | 06:00 | 02:00 / 03:00 | Mismo día en UTC y en Chile: sin cruce |
| `cleanup-expired-enrollment-drafts` | 03:00 | 23:00 / 00:00 | Limpieza por antigüedad, no por día |
| `cleanup-expired-public-enrollment`, `dispatch-scheduled-announcements` | cada 30 / 15 min | — | Trabajan con instantes, no con días |

## 7. Tests existentes

- `e2e/transversal-shell.spec.ts` `T02` (15:00 control, 23:30 marcado `knownBug('ASG-i-054 …')`).
