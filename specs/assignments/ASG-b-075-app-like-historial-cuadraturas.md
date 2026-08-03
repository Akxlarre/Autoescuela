# Asignación ASG-b-075 — App-like: `/admin/contabilidad/historial-cuadraturas` + `/secretaria/...`

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

Paso 8 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`), junto con liquidaciones
(ASG-b-074). `historial-cuadraturas-content` (shared admin+secretaria): hero + toolbar de mes +
calendario mensual acotado (máx 42 celdas, `hidden lg:grid` + fallback mobile aparte). 3 filas
conceptuales = `--fill-screen-kpi`.

Plan:
1. Root → `bento-grid--fill-screen-kpi`.
2. Calendario → `bento-fill flex flex-col h-full`, el grid `hidden lg:grid...flex-1` → agregar
   `min-h-0 overflow-y-auto` (por si un mes tiene muchos eventos por celda).
3. Fallback mobile sin cambios.

## Checklist de cierre (rollout app-like)

- [ ] `force-compact` verificado con drawer abierto
- [ ] Sin `.spec.ts` nuevo obligatorio
- [ ] `/verify` en **AMBAS rutas** (admin y secretaria — componente `shared`), 390×844, 1440×900
      y 768 de alto

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — fila `/admin/contabilidad/historial-cuadraturas`

## Archivos involucrados

- `src/app/shared/components/historial-cuadraturas-content/historial-cuadraturas-content.component.ts`
