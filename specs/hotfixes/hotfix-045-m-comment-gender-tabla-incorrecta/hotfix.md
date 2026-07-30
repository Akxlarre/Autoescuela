# Hotfix: COMMENT ON COLUMN users.gender apunta a tabla equivocada
> id: hotfix-045-m-comment-gender-tabla-incorrecta
> status: done
> closed: 2026-07-24
> created: 2026-07-23

## Problema
<!-- Qué está roto o mal. Una línea clara. -->
`supabase/migrations/20260612120000_users_gender_comment.sql` ejecuta `COMMENT ON COLUMN users.gender ...`, pero la columna `gender` vive en `students` (definida en `20260301000001_01_users_and_branches.sql:85`), no en `users`. En un replay completo bloquea con `ERROR: column "gender" of relation "users" does not exist (SQLSTATE 42703)`. Es un typo de nombre de tabla en una migración de solo metadatos (COMMENT), no afecta datos ni estructura.

## Cambios
<!-- Listar todos los archivos afectados. Sin límite, pero cada línea debe ser obvia. -->
- **Archivo:** `supabase/migrations/20260612120000_users_gender_comment.sql` — cambiar `COMMENT ON COLUMN users.gender` por `COMMENT ON COLUMN students.gender` (la segunda línea, sobre `professional_pre_registrations.gender`, ya estaba correcta y no se toca).
