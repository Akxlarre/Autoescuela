# Hotfix: `repurpose_document_templates` no es re-ejecutable y traba el `db push` del equipo
> id: hotfix-058-b-migracion-document-templates-no-reejecutable
> status: done
> closed: 2026-09-23
> created: 2026-09-23

## Problema

`20260916000000_repurpose_document_templates.sql` (spec `0016-m`, autor `m`) agrega dos
constraints sin guarda:

```sql
alter table document_templates
  add constraint document_templates_document_type_check check (...);

alter table document_templates
  add constraint uq_document_templates_branch_type unique (branch_id, document_type);
```

Si la migración se corre sobre una base donde ya se aplicó —o donde el DDL llegó por otra vía—
Postgres aborta con:

```
ERROR: 42710: constraint "document_templates_document_type_check" for relation
"document_templates" already exists
```

y **corta el `db push` entero**, dejando sin aplicar todo lo que viniera después.

Encontrado el 2026-09-22 al intentar aplicar `20260922000000_create_class_b_topics_table.sql`: el
push murió acá y la migración de `class_b_topics` nunca llegó a correr. Se destrabó con
`migration repair --status applied 20260916000000`, que arregla **el registro, no el archivo** —
así que en un entorno nuevo vuelve a romper exactamente igual.

El resto del archivo ya es idempotente: las policies tienen su `drop policy if exists`, los
`insert` usan `on conflict do nothing`, y los `add column` / `drop column` llevan `if exists` /
`if not exists`. Solo faltan estas dos.

## Cambios

- **Archivo:** `supabase/migrations/20260916000000_repurpose_document_templates.sql` — se agrega
  `drop constraint if exists` antes de cada uno de los dos `add constraint`, siguiendo el mismo
  patrón que el propio archivo ya usa para las policies. No cambia el esquema resultante ni el
  contenido sembrado: una base ya migrada queda exactamente igual.

## Verificación

Contra la base de desarrollo real —que ya tiene la migración aplicada—, en transacción revertida:

| Prueba | Resultado |
|---|---|
| Las dos sentencias **con** guarda, corridas **dos veces seguidas** | pasa; quedan las 2 constraints |
| Control negativo: un `add constraint` **sin** guarda, dos veces | falla con `42710: already exists` |

El control negativo importa: demuestra que la prueba mide lo que dice medir y no pasa por
casualidad. Nada quedó comiteado en la base — la transacción se abortó a propósito.

## Nota

El archivo es de `m`. Se toca solo para volverlo re-ejecutable, sin alterar su intención ni su
contenido — la regla del proyecto (`.claude/rules/database.md`) pide que las migraciones sean
idempotentes, y mientras no lo sea nadie del equipo puede correr `db push` desde una base limpia.
