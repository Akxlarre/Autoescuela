# Asignación ASG-b-083 — App-like: `/alumno/dashboard`

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Paso 15 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`). **Sugerido como `spec`, no
`fix`** — mucho más denso de lo que decía la primera pasada del audit, no alcanzó a mapearse por
completo en esta ronda.

`AlumnoDashboardComponent`: hero + selector-matrícula + 2 `bento-square` + columna izquierda/
derecha de 2 filas cada una (`bento-activity-lg`/`bento-alerts-lg` — esto SÍ confirma que
reutiliza el mismo patrón de 2 columnas que `DashboardComponent` de admin) + OTRA
`.bento-banner` + 2 `bento-square` MÁS al final. **Son ~9 celdas condicionales, no la versión
simplificada (hero + 2 columnas) que asumía el audit original.**

## Qué falta antes de fijar el plan

- Mapear las ~9 celdas en detalle: cuáles son siempre visibles, cuáles condicionales, y si
  pueden coexistir varias condicionales a la vez (mismo problema recurrente que
  `alumno/horario`/`alumno/pagos`, ASG-b-070/079 — puede necesitar el mismo fix de "agrupar en
  un wrapper").
- La base (2 columnas activity/alerts) sí reutiliza `--fill-screen-2` de `DashboardComponent`
  de admin — eso está confirmado y no hace falta reinvestigar.
- Decidir qué pasa con las 4 `bento-square` sueltas y la `.bento-banner` extra: ¿se pliegan en
  la fila de KPIs? ¿necesitan su propia fila? Requiere leer el componente completo.

Portal alumno es mobile-first (el patrón app-like solo aporta en desktop/laptop), así que esta
pieza es de prioridad menor que el resto del rollout — no bloquea nada si queda para el final.

## Checklist de cierre (rollout app-like, además de lo normal de una spec)

- [ ] `force-compact` verificado con drawer abierto
- [ ] `.spec.ts` para cualquier lógica de densidad nueva que se agregue
- [ ] `/verify` en 390×844, 1440×900 y 768 de alto

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — fila `/alumno/dashboard`
- `src/app/features/dashboard/dashboard.component.ts` — referencia del patrón 2 columnas
  (`--fill-screen-2`) ya confirmado como base

## Archivos involucrados

- `src/app/features/alumno/dashboard/alumno-dashboard.component.ts`
