# Asignación ASG-b-074 — App-like: `/admin/contabilidad/liquidaciones` + `/secretaria/...`

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

Paso 8 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`). `liquidaciones-content` (shared
admin+secretaria): hero + toolbar de filtros + tabla de instructores hand-rolled **sin
paginación** (muestra todo el período del mes seleccionado). Los botones "Anterior"/"Siguiente"
que tiene son navegación de MES (`mesAnterior`/`mesSiguiente`), no de tabla — no confundir, no
hay que sacar nada de ahí.

3 filas conceptuales = `--fill-screen-kpi` (no `--fill-screen` singular).

Plan:
1. Root → `bento-grid--fill-screen-kpi`.
2. Tabla → `bento-fill flex flex-col h-full`, wrapper `hidden md:block` →
   `flex-1 min-h-0 overflow-y-auto`.
3. Vista mobile (compact-mode / `[class.md:hidden]`) sin cambios.

Sin decisión de paginación pendiente.

## Checklist de cierre (rollout app-like)

- [ ] `force-compact` verificado con drawer abierto (esta página ya tiene manejo de
      `compact-mode` para el drawer — verificar que no choque con `force-compact` nuevo)
- [ ] Sin `.spec.ts` nuevo obligatorio
- [ ] `/verify` en **AMBAS rutas** (admin y secretaria — componente `shared`), 390×844, 1440×900
      y 768 de alto

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — fila `/admin/contabilidad/liquidaciones`

## Archivos involucrados

- `src/app/shared/components/liquidaciones-content/liquidaciones-content.component.ts`
