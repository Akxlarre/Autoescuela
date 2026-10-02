/**
 * Limpieza de archivos huérfanos del bucket `documents` (hallazgo de fix-178-b).
 *
 * Huérfano = objeto bajo un prefijo de matrícula (students/, contracts/, certificates/,
 * certificates_prof/, student-licenses/) cuyo segundo segmento es un `enrollment_id` que ya no
 * existe — típicamente borradores eliminados por `cleanup_expired_drafts()`, que borra la fila
 * pero no los archivos. Son datos personales (cédulas, contratos) sin dueño: la Ley 21.719 pide
 * no conservarlos sin finalidad.
 *
 * Salvaguardas (se recalculan al momento de correr, no se confía en una lista vieja):
 *   1. La matrícula del segmento 2 no existe en `enrollments`.
 *   2. Ninguna columna de URL/ruta de la BD referencia el archivo (lista REF_COLUMNS).
 * Si cualquiera de las dos falla, el archivo NO se borra.
 *
 * Por defecto es un DRY-RUN: solo lista. Borra únicamente con --apply.
 * Borrado vía Storage API (Supabase bloquea DELETE directo sobre storage.objects).
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup-orphan-storage-docs.mjs
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup-orphan-storage-docs.mjs --apply
 *
 * La service role key está en Supabase Dashboard → Project Settings → API. No la commitees.
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const BUCKET = 'documents';
const ENROLLMENT_PREFIXES = ['students', 'contracts', 'certificates', 'certificates_prof', 'student-licenses'];
const REF_COLUMNS = [
  ['absence_evidence', 'file_url'],
  ['class_b_practice_attendance', 'evidence_url'],
  ['class_book', 'pdf_url'],
  ['digital_contracts', 'file_url'],
  ['digital_contracts', 'signed_contract_url'],
  ['enrollments', 'certificate_b_pdf_url'],
  ['enrollments', 'certificate_professional_pdf_url'],
  ['enrollments', 'license_full_url'],
  ['enrollments', 'license_initial_url'],
  ['enrollments', 'license_pdf_url'],
  ['expenses', 'receipt_url'],
  ['instructor_documents', 'storage_url'],
  ['payments', 'receipt_url'],
  ['route_incidents', 'evidence_url'],
  ['school_documents', 'storage_url'],
  ['student_documents', 'storage_url'],
  ['vehicle_documents', 'file_url'],
];

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Trae todas las filas de una columna paginando (PostgREST corta en 1000). */
async function fetchAll(table, columns) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}.${columns}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

/** Lista recursivamente los archivos bajo un prefijo (la API devuelve carpetas con id null). */
async function listFiles(prefix) {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list ${prefix}: ${error.message}`);
    for (const item of data) {
      const path = `${prefix}/${item.name}`;
      if (item.id === null) files.push(...(await listFiles(path)));
      else files.push({ path, size: item.metadata?.size ?? 0 });
    }
    if (data.length < 1000) return files;
  }
}

/** Normaliza una URL o ruta guardada en la BD a la ruta dentro del bucket. */
function toBucketPath(value) {
  if (!value) return null;
  const marker = `/${BUCKET}/`;
  const i = value.indexOf(marker);
  return (i >= 0 ? value.slice(i + marker.length) : value).split('?')[0];
}

const enrollmentIds = new Set((await fetchAll('enrollments', 'id')).map((r) => String(r.id)));

const referenced = new Set();
for (const [table, column] of REF_COLUMNS) {
  for (const row of await fetchAll(table, column)) {
    const p = toBucketPath(row[column]);
    if (p) referenced.add(p);
  }
}

const orphans = [];
let skippedReferenced = 0;
for (const prefix of ENROLLMENT_PREFIXES) {
  for (const f of await listFiles(prefix)) {
    const enrollmentId = f.path.split('/')[1];
    if (enrollmentIds.has(enrollmentId)) continue;
    if (referenced.has(f.path)) { skippedReferenced++; continue; }
    orphans.push(f);
  }
}

const totalMb = (orphans.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1);
for (const prefix of ENROLLMENT_PREFIXES) {
  const n = orphans.filter((f) => f.path.startsWith(`${prefix}/`)).length;
  if (n) console.log(`  ${prefix}/: ${n}`);
}
console.log(`\nHuérfanos: ${orphans.length} archivos (${totalMb} MB).` +
  (skippedReferenced ? ` ${skippedReferenced} sin matrícula pero referenciados en la BD → se conservan.` : ''));

if (!APPLY) {
  console.log('\nDRY-RUN: no se borró nada. Revisa la lista y corre de nuevo con --apply para borrar.');
  for (const f of orphans) console.log(`  - ${f.path}`);
  process.exit(0);
}

let deleted = 0;
for (let i = 0; i < orphans.length; i += 100) {
  const batch = orphans.slice(i, i + 100).map((f) => f.path);
  const { data, error } = await supabase.storage.from(BUCKET).remove(batch);
  if (error) { console.error(`Error borrando lote ${i / 100 + 1}: ${error.message}`); process.exit(1); }
  deleted += data.length;
}
console.log(`\nBorrados: ${deleted} de ${orphans.length}.`);
