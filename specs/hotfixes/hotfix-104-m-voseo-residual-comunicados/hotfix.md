# Hotfix: Voseo argentino residual en el módulo de Comunicados
> id: hotfix-104-m-voseo-residual-comunicados
> refs: —
> status: done
> closed: 2026-09-10
> created: 2026-09-10

## Problema
spec-0041-b (comunicado global, autor Akxlarre) introdujo copy nuevo con voseo
argentino ("podés", "Elegí", "Acotá") — la app debe usar tuteo/español neutro
(ver `feedback_no_voseo_argentino.md`). fix-215-m ya había limpiado el resto de
la app; esto es voseo nuevo, no reincidencia del mismo código.

## Cambios
- **Archivo:** `supabase/functions/send-announcement/index.ts` — "No podés enviar
  comunicados de otra sede" → "No puedes enviar comunicados de otra sede" (ya aplicado)
- **Archivo:** `src/app/features/comunicados/announcement-composer-drawer.component.ts`
  — "Elegí el tipo…" (placeholder, x2) → "Elige el tipo…"; "Acotá el segmento." → "Acota el segmento."
