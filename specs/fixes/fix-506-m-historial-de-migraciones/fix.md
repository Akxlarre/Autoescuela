# Fix: historial de migraciones alineado con los archivos y con la BD real
> id: fix-506-m-historial-de-migraciones
> refs: —
> status: done
> closed: 2026-11-20
> created: 2026-11-20

## Root Cause
Desde octubre varias migraciones se aplicaron desde el SQL Editor (no registran nada en
`supabase_migrations.schema_migrations`) o con el MCP (registran con el timestamp del momento, no con
el del archivo), y algunos cambios se hicieron en el SQL Editor sin archivo. Resultado, en DEV y PROD
(PROD nació como copia del esquema de DEV): 238 versiones registradas para 300 archivos, 65 versiones
de archivo sin registro, 3 registros sin archivo y 7 timestamps repetidos entre archivos. Con eso
`supabase db push` no sirve: intentaría reaplicar lo ya aplicado y la CLI rechaza versiones repetidas.
Con dos proyectos, cada migración se aplicaba a mano en ambos, dependiendo de la memoria.

## ACs Afectados
Ninguno — fix autónomo.

- **AC-1:** no hay timestamps repetidos en `supabase/migrations/`.
- **AC-2:** los 3 archivos aplicados con el MCP llevan el timestamp con el que quedaron registrados.
- **AC-3:** los archivos reconstruyen el esquema real: una BD local creada solo desde
  `supabase/migrations/` tiene el mismo esquema que DEV (respaldo del 2026-11-20). Lo que estaba solo
  en la BD real queda en una migración nueva.
- **AC-4:** con los `repair` aplicados, `supabase migration list` no muestra diferencias y
  `supabase db push --dry-run` no tiene nada pendiente, en DEV y en PROD.

## Cambio
- **Archivo:** `supabase/migrations/` — renombres (duplicados y aplicados con MCP) + migración de
  lo aplicado solo en la BD real.
- **Archivo:** `supabase/tests/**` — los tests que nombran un timestamp renombrado.
- **Archivo:** fix.md (sección Aplicación) — los comandos `migration repair` para DEV y PROD (los corre Matías).

## Test de Regresión
- Esquema de la BD local reconstruida == esquema real (diff vacío, salvo ruido documentado) ✓
- `supabase migration list` alineado en DEV y PROD ✓

## Diagnóstico (2026-11-20)
- BD local creada solo desde los archivos vs. respaldo real de DEV: 300 migraciones sin error.
- Los 3 registros sin archivo eran `spec0056`, `spec0057b` y `spec0058b`, aplicadas con el MCP:
  sus archivos se renombraron al timestamp registrado.
- 7 pares de archivos compartían versión. En cada par se registró una; la otra se aplicó desde el
  SQL Editor, salvo **fix444**, que la CLI saltó creyéndola aplicada: su candado nunca llegó a la BD.
- Desde el SQL Editor, sin archivo: `cleanup_expired_public_enrollment` perdió la cancelación de
  `pending_payment` (DG-094 la da por hecha); `student_surveys` con otra estructura y política
  `USING (true)`; `class_b_exam_scores.student_id`; dos columnas nullable; un índice.
- Nuevas: `20261120120000` (alinea los archivos con la BD real; no cambia DEV ni PROD),
  `20261120121000` (encuestas solo staff) y `20261120130000` (restaura la cancelación).
- Guardrail nuevo: ARCH-43 (versión repetida en `supabase/migrations/`).

## Aplicación (la corre Matías, en DEV y después en PROD)
61 versiones ya están en la BD real y se marcan como aplicadas. Quedan 4 por ejecutar:
`20261016120001` (fix444), `20261120120000`, `20261120121000`, `20261120130000`.

```powershell
$V = '20261004120000 20261005120000 20261005130000 20261005140000 20261005150000 20261005160000 20261006160000 20261006170000 20261007130000 20261007140000 20261008120000 20261009120001 20261009121000 20261009122000 20261009140000 20261010121000 20261010140000 20261010160000 20261011120000 20261011130000 20261011140000 20261012120000 20261012125000 20261012130000 20261012140000 20261013120001 20261013130001 20261013140000 20261013150000 20261013160000 20261013161000 20261013162000 20261013163000 20261014120000 20261014180000 20261015120001 20261015130000 20261015140000 20261015150000 20261015160000 20261015170000 20261016130001 20261016150001 20261016170000 20261016180000 20261018120000 20261018130000 20261018140000 20261020140000 20261020150000 20261022120000 20261022130000 20261023120000 20261024120000 20261103120000 20261107120000 20261107200000 20261112120000 20261112200000 20261116120000 20261119120000'.Split(' ')
# DEV (proyecto enlazado)
npx supabase migration repair --status applied @V --linked
npx supabase db push --linked --include-all --dry-run   # debe listar solo las 4
npx supabase db push --linked --include-all
npx supabase db query --linked -f supabase/tests/rls/fix-506-m-student-surveys-y-pending-payment.sql
# PROD (URL del Session pooler de producción)
npx supabase migration repair --status applied @V --db-url $PROD
npx supabase db push --db-url $PROD --include-all --dry-run
npx supabase db push --db-url $PROD --include-all
```

## Progreso
- [x] Renombres, migraciones nuevas, test SQL (7/7 en BD local; control con el estado anterior falla 1, 5 y 6)
- [x] ARCH-43 + regla en database.md; `lint:arch:strict` y `test:scripts` en verde
- [x] Matías: repair + db push en DEV; test contra DEV 7/7 ok
- [x] Matías: repair + db push en PROD; `db push --dry-run`: "Remote database is up to date"
