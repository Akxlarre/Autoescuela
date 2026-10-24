# Fix: Un borrador con pago se pierde o queda a medias, y la auditoría no lo muestra bien
> id: fix-069-i-borrador-con-pago-y-auditoria
> refs: fix-058-i-testing-matricula-presencial (B1-1)
> status: done
> closed: 2026-10-24
> created: 2026-10-24

## Root Cause

1. **La limpieza nocturna borra pagos cobrados.** `cleanup_expired_drafts()` hace DELETE de los
   `payments` de un borrador vencido (B1-1, S8 de `fix-058-i`). La plata se recibió y desaparece.
2. **Descartar un borrador con pago lo deja a medias.** `EnrollmentFacade.discardDraft()` borra
   archivos, contrato, documentos, clases reservadas y descuentos; el DELETE de `payments` es solo
   admin por RLS (0 filas, sin error) y el DELETE de `enrollments` choca con la FK del pago que
   quedó. Igual con un borrador con `consents` (append-only, DG-118).
3. **Solo el admin puede anular** (`guard_anulacion_pago`, `update_payments`): la secretaria no
   tiene cómo cerrar el caso "cobré y el alumno se arrepintió".
4. **Auditoría:**
   - la pantalla y el reporte solo muestran acciones de secretarias (filtro fijo por rol): lo que
     hace el admin (anular un pago) no queda a la vista;
   - sin sesión ni service key (cron), `log_change()` atribuye la fila a `registered_by`: lo que
     borra la limpieza automática aparece hecho por la secretaria que registró el pago;
   - una anulación se ve como un diff crudo (`Estado: Pagado -> anulado; …`).

## Decisiones (Ignacio, 2026-10-24)

- La secretaria puede anular el pago de un borrador de su sede al descartarlo, con motivo, y debe
  verse en la auditoría. Caja del día cerrada → no se anula (lo resuelve el admin).
- El pago queda **anulado** (no borrado) con su motivo, y la matrícula **cancelada**.
- Auditoría es solo para el admin: muestra secretarias, admin y Sistema, con un filtro "Quién".

## ACs Afectados

Ninguno de una spec — bug de testing (`fix-058-i` B1-1). Criterios de este fix:

- **AC-F1:** `cleanup_expired_drafts()` no toca un borrador con un pago no anulado; uno cuyos
  pagos están todos anulados se cancela (no se borra) y conserva sus pagos.
- **AC-F2:** descartar un borrador con pagos o consentimientos lo deja `cancelled`, anula sus pagos
  vivos con el motivo (quién y cuándo los fija la BD) y libera sus clases reservadas, todo en una
  transacción. Sin motivo, o con la caja del día cerrada, no cambia nada.
- **AC-F3:** la secretaria solo puede anular pagos de un borrador de su sede, y solo por ese
  camino (fuera de un borrador sigue siendo solo admin).
- **AC-F4:** un borrador sin pagos ni consentimientos se descarta como hoy (se borra).
- **AC-F5:** la lista de borradores avisa el monto cobrado y "Descartar" pide el motivo cuando hay
  un pago vivo.
- **AC-F6:** en `audit_log`, la anulación queda como "Pago anulado: … — Motivo: … — Anulado por: …"
  a nombre de quien anuló; las filas del cron quedan sin usuario ("Sistema").
- **AC-F7:** Auditoría (pantalla y exportación) filtra por Quién: Todos / Secretarias / Admin /
  Sistema.

## Cambio

- Migración `fix069i`: `guard_anulacion_pago` (excepción secretaria + borrador),
  RPC `descartar_borrador_con_historial`, `cleanup_expired_drafts`, `log_change`.
- `EnrollmentFacade.discardDraft()` + `loadActiveDrafts()`; `DraftSummary`; `DraftListComponent`;
  diálogo de descarte en `secretaria-matricula`.
- `AuditoriaFacade`, `admin-auditoria`, `audit-log-row.model`, edge function `generate-audit-report`.

## Test de Regresión

- `supabase/tests/rls/fix-069-i-borrador-con-pago.sql` (AC-F1–F3, F6).
- Specs de `enrollment.facade`, `auditoria.facade` y utils nuevos (AC-F4, F5, F7).

## Progreso

- [x] SQL mostrado y aprobado; migración aplicada (2026-10-24); test SQL verde 15/15.
- [x] Front: descarte + lista de borradores (tests primero).
- [x] Auditoría: filtro Quién (front + edge function).
- [x] Verificación en navegador, suite completa, `tsc`, `lint:arch`, índices y cierre.
- [ ] Deploy de `generate-audit-report` (pendiente de confirmación de Ignacio; el front nuevo
      funciona con la versión vieja, solo que el Excel/PDF sigue trayendo solo secretarias).

## Verificación

- 2026-10-24, SQL Editor: migración aplicada; `fix-069-i-borrador-con-pago.sql` **15/15 ok**
  (AC-F1, F2, F3, F4 en BD, F6).
- Vitest: `draft-payment.utils` (11), `audit-actor.utils` (7), `enrollment.facade` (+4),
  `secretaria-matricula` (+4), `auditoria.facade` (+4), `admin-auditoria` (+2). Suite completa
  300/301 archivos: el único rojo es `agenda.facade.spec.ts` › hotfix-077-b, que falla igual sin
  este cambio (git stash) — depende de la fecha, no de este fix. `tsc` limpio, `lint:arch` 0 errores,
  `deno check` de `generate-audit-report` sin errores nuevos (queda el `Uint8Array` de antes).
- Playwright, admin, Auditoría: Quién = Todos (77.104) / Administradores (42.432, solo admin) /
  Secretarias (1.737) / Sistema (32.903, filas sin usuario). Primer intento con Administradores
  mostraba secretarias con rol "Sistema": el `.eq('users.roles.name')` sin `roles!inner` solo vacía
  el embed → corregido y cubierto en el spec (AC-F7).
- Playwright, secretaria sede 1, con la red interceptada (sin escribir en la BD): un borrador
  **vencido** con pago se lista con "Pago cobrado $150.000"; "Descartar" abre "¿Descartar matrícula
  con pago?" con motivo obligatorio (botón deshabilitado sin motivo); confirmado → RPC con
  `{p_enrollment_id, p_motivo}`, toast "El pago quedó anulado con su motivo" y la tarjeta sale de
  la lista; con `CAJA_CERRADA` → toast "…Pide a un administrador que lo revise" y la tarjeta queda
  (AC-F5, AC-F2 en la UI).
- 2026-10-24, `generate-audit-report` publicada. Exportar Excel como admin: Quién = Sistema → solo
  filas "Sistema (automático)"; Administradores → solo "PEPITO ADMI (Administrador)" ✅ (AC-F7).
  Nota (de antes de este fix): el reporte trae como mucho 1.000 filas (tope de PostgREST, aunque
  la consulta pide 5.000).
- 2026-10-24, `/verify` antes del commit: Auditoría a 1280×800 sin errores de consola, sin scroll de
  documento ni overflow horizontal; modo oscuro real (botón del topbar) legible. axe: `color-contrast`
  (×6, `text-muted`, ASG-i-065) y `nested-interactive` (×25: la fila `role=button` con el `mailto`
  adentro) — los dos de antes de este fix.
