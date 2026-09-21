# Hotfix: Al mergear main, el compositor de comunicados (reestructurado en 0043-b) colisiona con hotfix-104-m — portar el tuteo
> id: hotfix-055-b-merge-main-tuteo-compositor-comunicados
> status: done
> closed: 2026-09-21
> created: 2026-09-21

## Problema
`main` incorporó `hotfix-104-m` (voseo → tuteo en Comunicados; la convención del equipo es
español neutro, ver `fix-215-m`). Ese hotfix tocó el template del compositor **tal como era
antes de `0043-b`**. Esta rama lo reestructuró en secciones colapsables, así que git lo marca como
un único conflicto de ~166 líneas: es un artefacto de alineación — el lado de `main` es el
template viejo entero con 3 cambios de tuteo, y el nuestro es el template nuevo.

Resolución: conservar la versión de la rama (estructura de `0043-b`) y portar a mano las frases
de `hotfix-104-m` que **sobreviven** en el template nuevo.

## Cambios
- **Archivo:** `src/app/features/comunicados/announcement-composer-drawer.component.ts` — se
  descarta el lado de `main` (template viejo) y se reaplica el tuteo de `hotfix-104-m` a las
  3 frases que sobreviven: "Elegí el tipo…" (placeholder), "Elegí el tipo de comunicado para ver
  a quién le llegaría." y "Acotá el segmento." → "Elige…" / "Acota…".
- **Archivo:** `supabase/functions/send-announcement/index.ts` — sin cambio propio: el
  "No puedes enviar…" de `main` entró por auto-merge limpio.

## Fuera de alcance
El voseo que esta rama introdujo **después** de `hotfix-104-m` (0042-b, 0043-b, fix-168-b) no se
toca acá: es una limpieza aparte, con su propio alcance porque incluye copy de Edge Functions que
requiere redeploy.
