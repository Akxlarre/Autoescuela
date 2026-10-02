# Hotfix: Una inasistencia ya reagendada todavía ofrece "Justificar"
> id: hotfix-128-m-inasistencia-reagendada-sin-justificar
> refs: fix-264-m (caso H06 de `024b`), fix-279-m, fix-191-m, ASG-i-024, ASG-i-027
> status: done
> closed: 2026-10-02
> created: 2026-10-02

## Problema
En el panel "Inasistencias" de la ficha, una inasistencia de clase práctica que ya fue reagendada muestra el badge "Reagendada" y, al lado, el botón "Justificar". Esa inasistencia está archivada: la clase volvió a agendarse y ya no penaliza, así que no queda nada que justificar.

**Decisión del owner (Matías, 2026-10-01):** una inasistencia ya reagendada no se puede justificar.

## Cambios
- **Archivo:** `src/app/core/utils/inasistencia.utils.ts` — función pura `canJustificarInasistencia({ justificada, reagendada })`.
- **Archivo:** `src/app/features/admin/alumno-detalle/inasistencias-drawer/admin-inasistencias-drawer.component.ts` — el botón "Justificar" se muestra solo si esa función lo permite.

## Verificación
Verificado el 2026-10-02: `inasistencia.utils.spec.ts` (3 casos) en verde y, en navegador, el test E2E `F04 · F11 · F13`: tras reprogramar la clase, el panel de inasistencias muestra el badge "Reagendada" y ningún botón "Justificar".
