# Fix: Dos certificados generados a la vez chocan en el folio (o se duplican)
> id: fix-461-m-folio-certificado-atomico
> refs: fix-447-m-testing-documentos-certificacion (S18, casos M14 / Q04)
> status: done
> closed: 2026-10-19
> created: 2026-10-18

## Root Cause

`generate-certificate-b-pdf` y `generate-certificate-professional-pdf` emiten el registro de
`certificates` así: buscan uno existente para (matrícula, tipo); si no hay, leen `max(folio)`,
suman 1 e insertan. Todo fuera de una transacción y sin lock:

- Dos generaciones a la vez de alumnos distintos leen el mismo máximo → la segunda choca con
  `certificates_folio_key` (UNIQUE global). El error **se ignora**: el PDF queda subido y la
  matrícula marcada "Generado", pero sin registro ni folio; después el correo falla con "No se
  encontró el registro del certificado".
- Dos generaciones a la vez de la **misma** matrícula (dos sesiones, doble clic) no ven el registro
  de la otra y crean dos certificados: `(enrollment_id, type)` no es único.

## ACs Afectados

- AC propio — generaciones simultáneas obtienen folios distintos y consecutivos, sin errores.
- AC propio — una matrícula tiene a lo sumo un certificado por tipo; regenerar devuelve el mismo
  (mismo folio).
- AC propio — si emitir el registro falla, la función responde error (no deja un PDF "Generado"
  sin certificado).

## Cambio

- Migración `20261018140000_fix461_issue_certificate_atomico.sql`:
  `issue_certificate(enrollment_id, student_id, type, issued_by)` — `pg_advisory_xact_lock`
  serializa la emisión; devuelve el certificado existente o inserta con `max(folio)+1` y
  `chile_today()`. Índice único `(enrollment_id, type)`. Solo `service_role` puede ejecutarla.
- Las dos edge functions llaman a la RPC y responden 500 si falla.

## Test de regresión

- `supabase/tests/rls/fix-461-m-issue-certificate.sql` — emitir dos veces la misma matrícula
  devuelve el mismo id; dos matrículas distintas → folios consecutivos; índice único presente
  (dentro de una transacción que aborta).
- Tras el deploy: generar un certificado real desde Certificación y ver folio + email.

## Progreso

- [x] Migración + test SQL. Antes de la migración el test falla (la RPC no existe). Ensayo
  migración + test con rollback → I1–I4 ok (folios de prueba 3 → 4); después la BD sigue sin la
  RPC ni el índice.
- [x] Edge functions B y Profesional llaman a `issue_certificate` y responden 500 si falla.
  `lint:arch` 0 errores (`deno check` no corre en este equipo por dependencias npm, igual que en
  fix-448-m).
- [x] Matías aplicó `20261018140000_fix461_issue_certificate_atomico.sql` y desplegó
  `generate-certificate-b-pdf` (v29) y `generate-certificate-professional-pdf` (v24) (2026-10-19).
- [x] Test SQL contra la BD real: pasa (I1–I4).
- [x] Generación real como admin, tres llamadas simultáneas (#0005 dos veces, #0006 una): las tres
  responden 200; queda un solo certificado por matrícula (#0006 folio 3, #0005 folio 4, ambos
  `issued_date` 2026-10-19), y #0005 tiene 2 entradas en `certificate_issuance_log`. Antes, la
  doble llamada habría creado dos certificados y la otra habría chocado con el folio.
- [x] `send-certificate-email` para ambas: 200 (encuentra el registro). Alumnos sembrados
  (`@test-data.local`); los certificados de prueba quedan en la BD de dev.
- Profesional no se ejerció en vivo (oculto en el piloto); usa la misma RPC y el mismo manejo de
  error.
