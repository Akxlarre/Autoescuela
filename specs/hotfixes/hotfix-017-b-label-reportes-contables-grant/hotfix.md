# Hotfix: Label de escuela en reportes-contables ignora el grant multi-sede
> id: hotfix-017-b-label-reportes-contables-grant
> status: done
> created: 2026-06-25
> closed: 2026-08-07 — cierre tardío (el auto-cierre de hotfix no corrió). Verificado en
> `reportes-contables.facade.ts:84` — la rama de sede fija ya excluye a secretarias con grant.

## Problema
`reportes-contables.facade` → `_escuelaLabel` ramifica por `role === 'secretaria'` y muestra
"Mi escuela" aunque la secretaria tenga grant multi-sede (`canAccessBothBranches`) y haya
seleccionado "Todas" en el topbar. Descubierto como D1 en spec 0017.

## Cambios
- **Archivo:** `src/app/core/facades/reportes-contables.facade.ts` — en `_escuelaLabel`, la rama de
  "sede fija" aplica solo a secretaria SIN grant (`role === 'secretaria' && !canAccessBothBranches`);
  con grant cae a la rama del selector (como admin) → "Ambas escuelas" / sede elegida.
