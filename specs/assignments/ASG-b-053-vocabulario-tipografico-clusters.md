# Asignación ASG-b-053 — Vocabulario tipográfico: promover los clusters repetidos a clases del DS

> **status:** completada
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-07-31
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-07-31
> **resulting_track:** fix-078-b-vocabulario-tipografico-ds

---

## Contexto / Objetivo

El DS tiene tokens de color blindados (ARCH-11 a ARCH-18) pero **no tiene vocabulario
tipográfico**. El resultado está medido por el propio auto-index de
`indices/STYLES.md` (sección "Clusters repetidos"): la misma intención visual se escribe
de N formas distintas, con tamaños, pesos y trackings que divergen.

El caso más grave es el **micro-label overline**. Estas cinco filas del índice no son
cinco cosas — son *una*, escrita de cinco maneras:

| Repeticiones | Cluster |
|---|---|
| 27 | `text-xs font-semibold uppercase tracking-wide text-text-muted` |
| 15 | `text-2xs font-bold text-text-muted uppercase tracking-wider` |
| 15 | `text-xs font-semibold text-text-muted uppercase tracking-wider` |
| 14 | `text-xs font-bold text-text-muted uppercase tracking-widest` |
| 10 | `text-xs font-bold uppercase tracking-wide text-text-muted` |

**81 instancias, 2 tamaños, 2 pesos, 3 trackings.** Nadie eligió esas diferencias: son
deriva por copiar del componente de al lado.

El segundo caso es el **título de fila/ítem** (título de una card, fila de tabla o
elemento de lista):

| Repeticiones | Cluster |
|---|---|
| 54 | `text-sm font-semibold text-text-primary` |
| 40 | `text-sm font-bold text-text-primary` |
| 15 | `font-bold text-sm text-text-primary truncate` |
| 14 | `text-sm font-semibold truncate text-text-primary` |
| 13 | `text-sm font-semibold text-text-primary m-0` |

**136 instancias** oscilando entre `semibold` y `bold` para el mismo rol semántico.

> Esto es exactamente el mismo problema que `.kpi-value`/`.kpi-label` ya resolvieron para
> los datos numéricos — solo que para el resto de la tipografía nunca se hizo.

## Alcance sugerido

1. **Decidir el vocabulario** (esto es la parte de diseño, no de código). Propuesta de
   partida, a validar:
   - `.overline` — micro-label de sección/campo. Un solo tamaño, un solo peso, un solo
     tracking. Reemplaza los 81 de arriba. **Ojo:** no confundir con `.kpi-label` (que es
     específicamente para etiquetas de dato numérico) ni con `.section-eyebrow` (contexto
     pre-título, sin uppercase). Si al definirlo resulta que `.overline` y `.kpi-label`
     son lo mismo, **fusionarlos** — ver ASG-b-057.
   - `.item-title` — título de fila/card/ítem de lista. Resuelve el debate
     `semibold` vs `bold` de una vez.
   - `.item-meta` — texto secundario que acompaña a un `.item-title`.
2. **Migrar los usos** con un codemod, no a mano. `scripts/` ya tiene precedente: el lote
   de fix-042-m migró 30 pills en 24 archivos con un matcher ad-hoc + `--dry` antes de
   aplicar + Prettier después. Mismo patrón acá.
3. **Ratchet nuevo** (¿ARCH-19?) que congele el baseline de clusters: si alguien vuelve a
   escribir `text-xs font-semibold uppercase tracking-*` a mano, falla. Sin esto, la
   deriva vuelve en dos meses — es lo que pasó con `color-mix()` (ver ASG-b-034: el script
   corrió una sola vez en mayo y 11 archivos nuevos reintrodujeron el patrón).

## Por qué vale la pena

Es la deuda de DS con **mayor retorno visual por unidad de esfuerzo** que queda hoy:
~217 instancias, mecánicamente migrables, y ataca la divergencia que efectivamente se
*ve* en pantalla (labels que no matchean entre dos páginas contiguas). El resto del
backlog de DS es higiene interna; esto lo nota el usuario.

## Referencias

- `indices/STYLES.md` §"Tipografía — drift de utilidades" y §"Clusters repetidos" —
  los conteos de arriba salen de ahí y se regeneran con `npm run indices:sync`.
- `src/styles/tokens/_variables.scss` — donde viven `.kpi-value`/`.kpi-label`/
  `.section-eyebrow`; las clases nuevas van al lado.
- `docs/BACKLOG-DEUDA-TECNICA.md` — precedente de fases 1-5 del roadmap de botones.
- Codemod de referencia: el de fix-042-m (badges, lote 1).

## Notas para quien la reclame

- **El paso 1 es una decisión de diseño y bloquea a los otros dos.** No arranques el
  codemod sin haber fijado los valores exactos — migrar 217 usos a una escala que después
  se cambia es peor que no migrar.
- El conteo de `font-bold/semibold` (1192) que aparece en el índice **no es deuda**: el
  peso de fuente es legítimo en botones y headers. La señal accionable son solo los
  clusters repetidos, no el conteo crudo.
- Verificación proporcional al riesgo: harness CSS de las clases nuevas + `ng build` + 2-3
  páginas reales con `/verify`, no Playwright por archivo.
