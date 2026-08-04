# Asignación ASG-b-065 — App-like: `/secretaria/dashboard` (portar `--fill-screen-2` desde admin)

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Primera pieza del rollout del patrón app-like documentado en `indices/APP-LIKE-ROLLOUT.md`
(auditoría completa de los 4 portales, 2026-08-02/03). `/admin/dashboard` (`DashboardComponent`,
`src/app/features/dashboard/dashboard.component.ts`) ya es 100% app-like — `/secretaria/dashboard`
(`SecretariaDashboardComponent`) tiene el mismo layout conceptual (hero + KPIs +
`app-live-classes-panel` + Actividad reciente + Alertas) pero nunca portó el patrón.

**No es un gap de una línea** (así lo describía la primera pasada del audit) — son 4 cambios
reales, todos ya verificados contra el código de admin:

1. Root `<section>`: agregar `bento-grid--fill-screen-2` + `[class.force-compact]="isDrawerOpen()"`
   (agregar el computed `isDrawerOpen`, `layoutDrawer` ya está inyectado).
2. `<app-live-classes-panel>`: agregar clase `bento-fill` (hoy falta — confirmado leyendo
   `live-classes-panel.component.ts:35-36`, el comentario dice explícitamente "el consumidor la
   pone" y acá no está puesta), `[maxItems]="liveClassesBudget()"`, `(viewAllClick)="openAgenda()"`.
3. Cards "Actividad reciente" / "Alertas Importantes": agregar `bento-fill h-full overflow-hidden`
   a las clases existentes.
4. Densidad adaptativa: portar `LayoutService` + `isDesktopTier` + `sliceByBudget()` para
   `visibleActivities`/`visibleAlerts` (hoy hardcodeado a `.slice(0,4)`/`.slice(0,3)` fijo, sin
   adaptar por tier). Copiar literal el patrón de `dashboard.component.ts:371-380`.

Detalle menor a decidir libremente: admin no tiene botón "Ver todo" en el header de cada card (lo
movió al footer de la lista, dentro del scroll); secretaria sí lo tiene en el header. Unificar al
patrón de admin (footer) para no tener 2 UX del mismo widget — no bloqueante si se decide dejarlo.

## Checklist de cierre (aplica a TODO el rollout app-like, no solo esta pieza)

- [ ] `force-compact` verificado con un drawer abierto (ítem 2 de "Edge cases estresados" en
      `indices/APP-LIKE-ROLLOUT.md`)
- [ ] `.spec.ts` para los `computed()` de densidad nuevos (`isDesktopTier`, `visibleActivities`,
      `visibleAlerts`, `liveClassesBudget`) — obligatorio por `.claude/rules/testing-tdd.md`
- [ ] `/verify` en 390×844, 1440×900 **y 768 de alto** (ítem 5 del mismo checklist)
- [ ] Reventar la caché SWR / probar refresh silencioso no pierde posición de scroll si aplica
      Realtime en esta página

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — fila `/secretaria/dashboard` en "Candidatas" (sección Secretaria)
- `src/app/features/dashboard/dashboard.component.ts` — referencia canónica a copiar
- `.claude/rules/visual-system.md` §"Patrón App-like" — canon del patrón

## Archivos involucrados

- `src/app/features/secretaria/dashboard/secretaria-dashboard.component.ts`
