# Hotfix: la Hoja de Ruta lleva el nombre de la sede del vehículo
> id: hotfix-085-b-hoja-de-ruta-nombre-sede
> refs: ASG-i-032 (checklist 032, P03; decisión del owner 2026-10-16)
> status: open
> created: 2026-10-16

## Problema
El encabezado del PDF de la Hoja de Ruta (`generate-route-sheet-pdf`) decía siempre
"AUTOESCUELA CHILLÁN", también para los vehículos de "Conductores Chillán". Decisión: usar el
nombre de la sede del vehículo.

## Cambios
- **Archivo:** `supabase/functions/generate-route-sheet-pdf/index.ts` — el encabezado es el nombre
  de la sede del vehículo en mayúsculas (para un "Ambas", su sede principal; sin sede,
  "AUTOESCUELA"). El campo "Sede:" no cambia ("Ambas" para los de ambas sedes).

## Verificación
- [ ] Deploy (requiere aprobación del owner) y PDF generado para un vehículo de cada sede.
