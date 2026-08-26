# Hotfix: Aclarar etiquetas ambiguas en documentos de pre-inscripción profesional
> id: hotfix-089-m-labels-ambiguas-documentos-preinscripcion
> refs: —
> status: done
> created: 2026-08-25
> closed: 2026-08-25

## Problema
En el drawer de pre-inscripción profesional (Documentos), la fecha que se pide junto a
"Hoja de vida del conductor" no tiene label — el usuario no sabe si es fecha de emisión
o de vencimiento. Además "Foto carnet" es ambiguo con "foto cédula de identidad".

## Cambios
- **Archivo:** `src/app/features/admin/alumnos/pre-inscritos/admin-pre-inscrito-drawer.component.ts` — agregar `label="Fecha de emisión"` al `app-date-input` de HVC; aclarar el label de "Foto carnet" a "Foto carnet (para credencial física)".
