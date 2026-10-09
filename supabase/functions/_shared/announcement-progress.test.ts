// supabase/functions/_shared/announcement-progress.test.ts
//
// Ejecutar:
//   npx --yes deno test --no-lock --node-modules-dir=none supabase/functions/_shared/announcement-progress.test.ts

import { assertEquals } from 'jsr:@std/assert@1';
import {
  CONSENT_REVOKED_MARK,
  DRY_RUN_MARK,
  isDispatchOrphaned,
  isRecipientPending,
  releasedHeartbeat,
  summarizeRecipients,
} from './announcement-progress.ts';

const sent = { email_sent_ok: true, send_error: null };
const untouched = { email_sent_ok: false, send_error: null };
const smtpError = { email_sent_ok: false, send_error: 'Connection timeout' };
const noEmail = { email_sent_ok: false, send_error: 'sin_email' };
const dryRun = { email_sent_ok: false, send_error: DRY_RUN_MARK };
const revoked = { email_sent_ok: false, send_error: CONSENT_REVOKED_MARK };

Deno.test('solo una fila sin enviar y sin error está pendiente', () => {
  assertEquals(isRecipientPending(untouched), true);
  for (const row of [sent, smtpError, noEmail, dryRun, revoked]) {
    assertEquals(isRecipientPending(row), false);
  }
});

Deno.test('fix-361-m · el resumen cuenta el comunicado entero, no la última corrida', () => {
  // 250 destinatarios: 200 salieron en la primera corrida, 50 en la segunda.
  const rows = [...Array(240).fill(sent), ...Array(10).fill(smtpError)];
  assertEquals(summarizeRecipients(rows), { total: 250, ok: 240, failed: 10, pending: 0 });
});

Deno.test('el resumen distingue pendientes, fallas, prueba y consentimiento revocado', () => {
  const rows = [sent, untouched, untouched, smtpError, noEmail, dryRun, revoked];
  assertEquals(summarizeRecipients(rows), { total: 7, ok: 2, failed: 2, pending: 2 });
});

Deno.test('sin destinatarios el resumen queda en cero', () => {
  assertEquals(summarizeRecipients([]), { total: 0, ok: 0, failed: 0, pending: 0 });
});

const now = new Date('2026-10-08T12:00:00Z');

Deno.test(
  'un envío con un lote reciente no está huérfano aunque se haya programado hace horas',
  () => {
    const row = {
      dispatch_heartbeat_at: '2026-10-08T11:50:00Z',
      scheduled_for: '2026-10-08T08:00:00Z',
      created_at: '2026-10-07T10:00:00Z',
    };
    assertEquals(isDispatchOrphaned(row, now), false);
  },
);

Deno.test('sin lotes en 30 minutos está huérfano', () => {
  const row = {
    dispatch_heartbeat_at: '2026-10-08T11:20:00Z',
    scheduled_for: null,
    created_at: '2026-10-08T11:00:00Z',
  };
  assertEquals(isDispatchOrphaned(row, now), true);
});

Deno.test('un envío inmediato sin latido decide por created_at', () => {
  const fresh = {
    dispatch_heartbeat_at: null,
    scheduled_for: null,
    created_at: '2026-10-08T11:45:00Z',
  };
  const stale = {
    dispatch_heartbeat_at: null,
    scheduled_for: null,
    created_at: '2026-10-08T10:00:00Z',
  };
  assertEquals(isDispatchOrphaned(fresh, now), false);
  assertEquals(isDispatchOrphaned(stale, now), true);
});

Deno.test('un programado sin latido decide por scheduled_for (criterio anterior)', () => {
  const row = {
    dispatch_heartbeat_at: null,
    scheduled_for: '2026-10-08T11:00:00Z',
    created_at: '2026-10-01T10:00:00Z',
  };
  assertEquals(isDispatchOrphaned(row, now), true);
});

Deno.test('fix-361-m · un comunicado que el cron soltó a mitad se retoma en la corrida siguiente', () => {
  // El cron corre cada 15 minutos: soltarlo a las 12:00 tiene que dejarlo tomable a las 12:15.
  const row = {
    dispatch_heartbeat_at: releasedHeartbeat(now),
    scheduled_for: '2026-10-08T11:55:00Z',
    created_at: '2026-10-08T11:00:00Z',
  };
  assertEquals(isDispatchOrphaned(row, new Date('2026-10-08T12:15:00Z')), true);
});
