// supabase/functions/_shared/zoom-email.ts
//
// Núcleo funcional de `send-zoom-email` (fix-367-m). Sin I/O: recibe las filas que la función ya
// leyó de la BD con la sesión del usuario y decide qué se envía y a quién. Nada de esto viene del
// navegador — el body solo trae `classId` y `enrollmentIds`.

import { formatChileDate } from './chile-time.ts';

/** Fila de `class_b_theory_sessions` que usa el correo. */
export interface ZoomSessionRow {
  id: number;
  cycle_id: number | null;
  class_number: number | null;
  class_date: string | null;
  topic: string | null;
  zoom_link: string | null;
}

/** Fila de `enrollments` con el usuario del alumno embebido. */
export interface ZoomEnrollmentRow {
  id: number;
  theory_cycle_id: number | null;
  status: string | null;
  students: {
    users: {
      first_names: string | null;
      paternal_last_name: string | null;
      email: string | null;
    } | null;
  } | null;
}

export interface ZoomRecipient {
  name: string;
  email: string;
}

export interface ZoomEmailContent {
  subject: string;
  topic: string;
  date: string;
  zoomLink: string;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapa texto para insertarlo en HTML, también dentro de un atributo entre comillas. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Solo enlaces `https://` bien formados. Descarta `javascript:`, `http:`, `data:`, texto suelto. */
export function isSafeZoomLink(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Asunto, tema y fecha del correo a partir de la sesión — mismo texto que armaba el facade antes
 * de fix-367-m ("Clase N — tema" o "Clase Teórica N"; fecha larga en hora de Chile).
 * Devuelve null si la sesión no tiene un enlace válido.
 */
export function buildZoomEmailContent(session: ZoomSessionRow): ZoomEmailContent | null {
  if (!isSafeZoomLink(session.zoom_link)) return null;
  const n = session.class_number ?? '?';
  const topic = session.topic?.trim()
    ? `Clase ${n} — ${session.topic.trim()}`
    : `Clase Teórica ${n}`;
  const date = session.class_date
    ? formatChileDate(session.class_date, { weekday: 'long', day: 'numeric', month: 'long' })
    : '';
  return { subject: `Enlace Zoom · ${topic}`, topic, date, zoomLink: session.zoom_link.trim() };
}

/**
 * Destinatarios: solo matrículas activas del ciclo de la sesión, pedidas en `requestedIds`, con
 * correo. Las filas ya vienen filtradas por la RLS del usuario (sede); esto agrega el ciclo y el
 * estado, y descarta duplicados por correo.
 */
export function selectZoomRecipients(
  rows: readonly ZoomEnrollmentRow[],
  cycleId: number | null,
  requestedIds: readonly number[],
): ZoomRecipient[] {
  const wanted = new Set(requestedIds);
  const seen = new Set<string>();
  const out: ZoomRecipient[] = [];
  for (const row of rows) {
    if (!wanted.has(row.id) || cycleId === null || row.theory_cycle_id !== cycleId) continue;
    if (row.status !== 'active') continue;
    const u = row.students?.users;
    const email = u?.email?.trim();
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    const name = [u?.first_names, u?.paternal_last_name]
      .filter((p) => p?.trim())
      .join(' ')
      .trim();
    out.push({ name: name || 'Alumno', email });
  }
  return out;
}

/** `enrollmentIds` del body: enteros positivos, sin repetir, a lo más `max`. Null si es inválido. */
export function parseEnrollmentIds(value: unknown, max = 500): number[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) return null;
  if (!value.every((v) => Number.isInteger(v) && v > 0)) return null;
  return [...new Set(value as number[])];
}
