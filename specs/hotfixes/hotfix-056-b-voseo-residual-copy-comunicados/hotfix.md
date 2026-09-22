# Hotfix: Voseo residual en el copy de comunicados (0042-b, 0043-b y fix-168-b)
> id: hotfix-056-b-voseo-residual-copy-comunicados
> status: done
> closed: 2026-09-21
> created: 2026-09-21

## Problema
La convención del equipo es tuteo / español neutro (`fix-002-i`, `fix-215-m`, `hotfix-104-m`).
Esta rama volvió a introducir voseo en copy visible **después** de `hotfix-104-m`, que había
corregido exactamente lo mismo en `0041-b`. Un escaneo de las líneas nuevas de la rama frente a
`main` (sin comentarios ni tests) encontró 7 líneas en 4 archivos de `src/`; ninguna en Edge
Functions, así que no requiere redeploy. Detalle en `hotfix-055-b`.

## Cambios
- **Archivo:** `src/app/core/facades/announcements.facade.ts` — 3 mensajes: "Pedile a
  administración" → "Pídele a administración"; "Escribí el asunto" → "Escribe el asunto";
  "usá" → "usa".
- **Archivo:** `src/app/core/facades/notification-templates.facade.ts` — "Completá nombre…" →
  "Completa nombre…".
- **Archivo:** `src/app/features/comunicados/announcement-composer-drawer.component.ts` —
  "Podés editar el texto" → "Puedes editar el texto".
- **Archivo:** `src/app/features/comunicados/template-manager-drawer.component.ts` — "Si escribís
  una" → "Si escribes una"; "Creá una para…" → "Crea una para…".

## Verificación
Copy puro, sin lógica de decisión: no aplica test nuevo. Se comprueba que ningún test cita los
textos viejos, que los specs de los dos facades siguen verdes y que el escaneo de voseo sobre las
líneas nuevas de la rama da 0 hallazgos.
