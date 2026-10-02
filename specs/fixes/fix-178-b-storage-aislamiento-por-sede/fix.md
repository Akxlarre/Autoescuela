# Fix: Storage — documentos de otra sede y subida anónima a `website-public`
> id: fix-178-b-storage-aislamiento-por-sede
> refs: ASG-i-046 (complementa spec 0047-b, misma tanda de aislamiento por sede)
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause
[Heredado de ASG-i-046, confirmado contra la BD remota el 2026-10-01 leyendo `pg_policies` de
`storage.objects`.] Las policies del bucket privado `documents` solo miran el **rol**, nunca la
sede que codifica la ruta:

- `documents_authenticated_read` (SELECT): `admin` o `secretary` → cualquier objeto del bucket.
  Una secretaria de la sede A lista y firma URLs de cédulas, contratos, certificados y licencias
  de alumnos de la sede B (confirmado por Ignacio: las 2 secretarias ven las mismas carpetas).
- `documents_auth_insert` / `documents_auth_update`: igual, solo rol. Con `upsert: true` (que usa
  la app) una secretaria puede **reemplazar** el contrato o certificado de otra sede.
- `website_public_seed_insert`: `TO public` sin condición de sesión → cualquiera **sin login**
  sube archivos (incluido SVG, hasta 5 MB) bajo `website-public/seeds/`, servidos públicamente.
- `website_public_update` / `_insert`: una secretaria sobrescribe los logos e imágenes de la web
  de la otra sede (`website-assets/branch-<id>/`).

La sede **sí** está en la ruta; nadie la cruzaba con la del usuario:

| Prefijo (`documents`) | Segmento 2 | Sede |
|---|---|---|
| `students/`, `contracts/`, `certificates/`, `certificates_prof/`, `student-licenses/` | `enrollment_id` | `enrollments.branch_id` |
| `sessions/` | `class_b_sessions.id` | sede de su matrícula |
| `instructor-docs/` | `instructor_id` | sede del usuario del instructor, o "ambas sedes" |
| `class-books/` | `promotion_course_id` | `professional_promotions.branch_id` |
| `website-assets/` | `branch-<id>` | literal |
| `vehicle-docs/` | `vehicle_id` | sin cambio (lectura de flota por rol = decisión `032 · R03`) |
| `school-docs/`, `templates/` | timestamp | sin sede en la ruta (documentos de la escuela / plantillas) |
| `public-uploads/carnet/` | token | carga temporal del wizard público; la mueve la Edge Function con service role |

## ACs Afectados
Ninguno de una spec previa — fix autónomo (origen ASG-i-046). ACs propios:

- **F1 — Lectura por sede:** Given una secretaria sin grant de la sede 1, When lista o firma
  objetos de `documents`, Then solo ve los de matrículas / clases / instructores / libros /
  assets de su sede, más los prefijos sin sede (`school-docs`, `templates`, `vehicle-docs`).
- **F2 — Escritura por sede:** Given la misma secretaria, When intenta subir (INSERT) o sobrescribir
  (UPDATE / upsert) un objeto bajo una ruta de la sede 2, Then la BD lo rechaza (`42501`).
- **F3 — Sede propia y grant intactos:** la secretaria sigue leyendo/subiendo en su sede; la
  secretaria multi-sede y el admin ven y escriben todo, igual que hoy.
- **F4 — Sin subida anónima:** Given un cliente sin sesión (`anon`), When intenta subir a
  `website-public/seeds/…`, Then la BD lo rechaza. La lectura pública del bucket no cambia.
- **F5 — Web por sede:** Given la secretaria de la sede 1, When intenta subir/sobrescribir en
  `website-public/website-assets/branch-2/…`, Then se rechaza; en `branch-1/` funciona.
- **F6 — Sin regresión de otros roles:** las policies de instructor (`sessions/`), alumno
  (certificados propios), `anon` del wizard público (`public-uploads/carnet/`) y el DELETE solo
  admin quedan idénticas.

## Cambio
- **Archivo:** `supabase/migrations/20261001200000_storage_aislamiento_por_sede.sql` — reescribe
  `documents_authenticated_read`, `documents_auth_insert`, `documents_auth_update`,
  `website_public_insert`, `website_public_update` con el alcance por sede derivado de la ruta
  (mismo patrón inline de 0047-b: InitPlan + `IN (subquery)`, sin funciones por fila — DG-016);
  elimina `website_public_seed_insert`.
- **Prefijos desconocidos:** para la secretaria, un prefijo de `documents` que no esté en la tabla de
  arriba queda **denegado** (lista blanca). El admin no cambia.
- **`upsert: true`:** se mantiene. Con F2 ya no puede pisar archivos de otra sede; dentro de la propia
  sede reemplazar un documento es un flujo legítimo (re-subir cédula). Se documenta, no se toca la app.
- **Sin migración de archivos:** no se reorganizan rutas.

## Test de Regresión
- **Archivo:** `supabase/tests/rls/fix-178-b-storage-por-sede.sql` — impersona secretaria sede 1,
  sede 2, multi-sede, admin y `anon`; verifica F1–F5 sobre `storage.objects` (lectura = conteo por
  prefijo contra la verdad sin RLS; escritura = INSERT/UPDATE dentro de un sub-bloque que siempre se
  deshace).
- **Cómo correrlo:** como `postgres` (SQL editor / MCP). Ensayo: `BEGIN; <migración>; <test>; ROLLBACK;`.

## Resultado (2026-10-01)

**Rojo, BD remota actual — 9 fallos:** secretaria sede 1 lee 213 objetos fuera de su alcance y
sede 2, 198; INSERT en `students/` y `contracts/` de la sede 2 aceptado; prefijo inventado
aceptado; UPDATE de un objeto de la sede 2 → 1 fila; mover un objeto propio a la sede 2 aceptado;
INSERT en `website-assets/branch-2/` aceptado; **INSERT anónimo en `website-public/seeds/`
aceptado** (F4 confirmado en vivo).

**Aplicada en remoto el 2026-10-01** (`supabase db push`, visto bueno del owner, versión `20261001200000`); test re-corrido contra la BD real fuera de transacción: 0 fallos, sin objetos residuales.

**Verde, migración + test en `BEGIN … ROLLBACK` — 0 fallos en 15 casos:** sede 1 ve 14 objetos,
sede 2 ve 29, multi-sede y admin 227 (= total); todas las escrituras ajenas → `42501`; las propias
→ 1 fila; el wizard público (`anon` → `public-uploads/carnet/`) sigue funcionando.

**Por qué la secretaria ve tan pocos objetos:** 157 de los 183 archivos bajo prefijos de matrícula
son **huérfanos** (su `enrollment_id` ya no existe: borradores limpiados por
`cleanup_expired_drafts`, que no borra Storage). Quedan visibles solo para el admin. Se verificó
que **todas** las rutas referenciadas desde la BD (`student_documents.storage_url`,
`digital_contracts.file_url`/`signed_contract_url`, `enrollments.*_pdf_url`) apuntan a
`<prefijo>/<su propia matrícula>/`, así que ningún archivo vigente queda inaccesible para la
secretaria de su sede. Limpiar los huérfanos queda como follow-up (no es parte de este fix).

## Rollback
Policies anteriores (`pg_policies` remoto, 2026-10-01). La cláusula de rol era
`EXISTS (SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id WHERE u.supabase_uid = auth.uid() AND r.name = ANY (…))`:

| Policy | Cmd | Antes |
|---|---|---|
| `documents_authenticated_read` | SELECT | `bucket_id = 'documents'` AND rol ∈ {admin, secretary} |
| `documents_auth_insert` | INSERT | `bucket_id = 'documents'` AND (rol ∈ {secretary, admin} OR instructor dueño de `sessions/<id>`) |
| `documents_auth_update` | UPDATE | ídem en USING y WITH CHECK |
| `website_public_insert` | INSERT | `bucket_id = 'website-public'` AND rol ∈ {admin, secretary} |
| `website_public_update` | UPDATE | ídem (USING) |
| `website_public_seed_insert` | INSERT `TO public` | `bucket_id = 'website-public' AND position('seeds/' in name) = 1` |
