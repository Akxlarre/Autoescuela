/**
 * Migración de datos (spec 0007-m, AC5/AC6): mueve los objetos de Storage subidos desde la
 * pestaña DMS bajo `student-docs/{studentId}/...` a `students/{enrollmentId}/...` — la
 * convención que ya usa el flujo de matrícula — actualiza `student_documents.storage_url` a
 * la ruta nueva en la misma fila, y barre cualquier residuo que quede bajo `student-docs/`.
 *
 * NOTA: la limpieza final se hace acá (Storage API), no con una migración SQL — Supabase
 * bloquea el `DELETE` directo sobre `storage.objects` ("Direct deletion from storage tables
 * is not allowed. Use the Storage API instead.", confirmado contra Supabase local).
 *
 * Ejecutar UNA VEZ contra Supabase local o producción.
 *
 * Uso:
 *   node scripts/migrate-student-docs-storage.mjs [--dry-run] [--skip-cleanup]
 *
 * Variables de entorno:
 *   SUPABASE_URL              (opcional, default http://127.0.0.1:54321)
 *   SUPABASE_SERVICE_ROLE_KEY (obligatoria — `npx supabase status` la imprime para local)
 *
 * Flags:
 *   --dry-run       No mueve ni borra nada — solo loguea qué haría.
 *   --skip-cleanup  Migra los documentos reales (fila en student_documents) pero NO borra los
 *                   objetos huérfanos bajo student-docs/ (los que no tienen ninguna fila que los
 *                   referencie). Usar cuando el dry-run muestra huérfanos y se quieren revisar a
 *                   mano antes de decidir si se borran.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'xxxxx';
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Falta SUPABASE_SERVICE_ROLE_KEY. Corre `npx supabase status` para obtenerla (ambiente local) ' +
      'y exportala antes de correr este script.',
  );
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_CLEANUP = process.argv.includes('--skip-cleanup');
const BUCKET = 'documents';
const LEGACY_PREFIX = 'student-docs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Lista recursivamente todos los archivos bajo un prefijo (Storage `.list()` no es recursivo). */
async function listAllFilesUnder(prefix) {
  const { data: entries, error } = await supabase.storage.from(BUCKET).list(prefix);
  if (error || !entries) return [];

  const files = [];
  for (const entry of entries) {
    const fullPath = `${prefix}/${entry.name}`;
    // Las carpetas "virtuales" de Storage no tienen `id`; los archivos sí.
    if (entry.id) {
      files.push(fullPath);
    } else {
      files.push(...(await listAllFilesUnder(fullPath)));
    }
  }
  return files;
}

async function main() {
  console.log(`Migración student-docs/ → students/{enrollmentId}/ ${DRY_RUN ? '(dry-run)' : ''}`);

  const { data: docs, error } = await supabase
    .from('student_documents')
    .select('id, enrollment_id, storage_url')
    .like('storage_url', `${LEGACY_PREFIX}/%`);

  if (error) {
    console.error('Error consultando student_documents:', error.message);
    process.exit(1);
  }

  let moved = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of docs ?? []) {
    const oldPath = doc.storage_url;
    const fileName = oldPath.split('/').pop();
    const newPath = `students/${doc.enrollment_id}/${fileName}`;

    const { data: existingAtDest } = await supabase.storage
      .from(BUCKET)
      .list(`students/${doc.enrollment_id}`);
    const alreadyMoved = existingAtDest?.some((f) => f.name === fileName) ?? false;

    if (alreadyMoved) {
      console.log(`SKIP (ya movido): ${oldPath} -> ${newPath}`);
      skipped++;
    } else if (DRY_RUN) {
      console.log(`DRY-RUN: movería ${oldPath} -> ${newPath}`);
      continue;
    } else {
      const { error: moveError } = await supabase.storage.from(BUCKET).move(oldPath, newPath);
      if (moveError) {
        console.error(`ERROR moviendo ${oldPath}:`, moveError.message);
        failed++;
        continue;
      }
      console.log(`OK: ${oldPath} -> ${newPath}`);
      moved++;
    }

    const { error: updateError } = await supabase
      .from('student_documents')
      .update({ storage_url: newPath })
      .eq('id', doc.id);
    if (updateError) {
      console.error(
        `ERROR actualizando storage_url para student_documents.id=${doc.id}:`,
        updateError.message,
      );
      failed++;
    }
  }

  console.log(`\nMigración de documentos: ${moved} movidos, ${skipped} ya migrados, ${failed} con error.`);

  if (SKIP_CLEANUP) {
    const leftovers = await listAllFilesUnder(LEGACY_PREFIX);
    console.log(
      `\n--skip-cleanup: no se borra nada. Quedan ${leftovers.length} objeto(s) bajo student-docs/ ` +
        '(incluye tanto huérfanos reales como los recién migrados, si corriste sin --dry-run antes ' +
        'ya no deberían aparecer los migrados).',
    );
    leftovers.forEach((f) => console.log(`  - ${f}`));
    if (failed > 0) process.exit(1);
    return;
  }

  // AC6 — barrido final: `.move()` ya remueve el objeto de origen, pero puede haber residuos
  // huérfanos (objetos sin fila en student_documents, ej. de intentos previos fallidos).
  const leftovers = await listAllFilesUnder(LEGACY_PREFIX);
  if (leftovers.length === 0) {
    console.log('Sin residuos bajo student-docs/ — limpieza completa.');
  } else if (DRY_RUN) {
    console.log(`DRY-RUN: quedarían ${leftovers.length} objeto(s) huérfano(s) por eliminar:`);
    leftovers.forEach((f) => console.log(`  - ${f}`));
  } else {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(leftovers);
    if (removeError) {
      console.error('ERROR eliminando residuos de student-docs/:', removeError.message);
      failed++;
    } else {
      console.log(`Eliminados ${leftovers.length} objeto(s) huérfano(s) bajo student-docs/.`);
    }
  }

  if (failed > 0) process.exit(1);
}

main();
