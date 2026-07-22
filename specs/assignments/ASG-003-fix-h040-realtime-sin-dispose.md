# Asignación ASG-003 — Fix H-040: Realtime sin limpiar + polling prohibido en Dashboard

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

7 facades (`dashboard`, `admin-alumnos`, `admin-alumno-detalle`, `flota`, `pagos`, `liquidaciones`, `cuadratura`) abren un canal de Supabase Realtime que ningún Smart Component cierra nunca — quedan vivos toda la sesión aunque el usuario navegue a otra parte de la app. Además, `dashboard.facade.ts` tiene un `setInterval` de 60s que hace fetch real de red para recalcular "clases actuales" — exactamente el anti-patrón que `swr-pattern.md` prohíbe ("NUNCA usar setInterval/polling — Supabase Realtime existe para esto").

## Alcance sugerido

- En cada uno de los 7 Smart Components correspondientes: inyectar `DestroyRef` y llamar al método de limpieza del facade (`destroyRealtime()`/`dispose()`, nombres inconsistentes — ver Notas) en `onDestroy()`. Mismo patrón ya correcto en `admin-agenda.component.ts` y `admin-tareas.component.ts`.
- En `dashboard.facade.ts`: reemplazar el `setInterval` + `fetchLiveClasses()` por un `computed()`/recálculo local contra `Date.now()` sobre los datos ya cargados (las clases "actuales" se derivan de `scheduled_at`/duración sin pedirle nada al servidor).
- Fuera de scope: no es necesario unificar los nombres de método (`dispose` vs `destroyRealtime` vs `disposeRealtime`) en este fix — mencionado como mejora aparte, no bloqueante.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-040 (con líneas exactas de código y la auditoría completa de qué facade está bien y cuál no).
- `.claude/rules/swr-pattern.md`.

## Notas para quien la reclame

- Impacto acotado (cada facade tiene guard contra doble-suscripción), pero es trabajo de fondo/CPU innecesario acumulado durante toda la sesión del usuario.
- Los nombres de método varían: `dashboard`/`admin-alumnos`/`admin-alumno-detalle`/`flota`/`pagos`/`liquidaciones`/`cuadratura` usan `destroyRealtime()`.
