# Hotfix: Eliminar la Edge Function export-students, que quedó sin uso
> id: hotfix-130-m-eliminar-edge-function-export-students
> refs: ASG-i-024
> status: done
> closed: 2026-10-02
> created: 2026-10-02

## Problema
Desde `fix-281-m` la Base de Alumnos exporta con las filas de la pantalla (Excel en el navegador,
PDF con `export-table-pdf`). `export-students` ya no la llama nadie y conservarla deja una
segunda forma de exportar que vuelve a consultar y filtrar por su cuenta (el origen de B1).

## Cambios
- **Archivo:** `supabase/functions/export-students/` — se elimina la carpeta.
- **Archivo:** `indices/DATABASE.md` — se quita de la lista de funciones que usan `staff-auth`.

**Pendiente fuera del repo (Matías):** borrarla del proyecto desplegado
(`npx supabase functions delete export-students`).
