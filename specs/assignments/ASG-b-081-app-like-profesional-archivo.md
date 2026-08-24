# Asignación ASG-b-081 — App-like: `/admin/clase-profesional/archivo` + `/secretaria/profesional/archivo`

> **status:** completada
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** m
> **claimed_at:** 2026-08-10
> **resulting_track:** fix-150-m-app-like-profesional-archivo

---

## Contexto / Objetivo

Paso 13 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`), separada de la matriz de notas
(ASG-b-080) porque **es más simple de lo que sugería la primera pasada del audit** — NO tiene el
modo dual landing/grilla que sí tiene Evaluaciones/Notas.

`AdminProfesionalArchivoComponent` (secretaria wrappea al mismo): filtro (auto) + tabla con
columna "Alumno" YA `sticky-col` + 2 empty-states condicionales, sin paginación.

Plan:
1. Root → `--fill-screen-kpi`: filtro=auto, tabla=fill `.bento-fill`.
2. Wrapper de la tabla → `flex-1 min-h-0 overflow-y-auto` (el `sticky-col` ya existe, NO
   romperlo — verificar después del cambio que la columna sigue pegada al hacer scroll
   horizontal).

## Checklist de cierre (rollout app-like)

- [ ] `force-compact` verificado con drawer abierto
- [ ] Sin `.spec.ts` nuevo obligatorio
- [ ] `/verify` en la ruta admin — `SecretariaProfesionalArchivoComponent` wrappea al de admin,
      así que se resuelve automáticamente, pero igual correr `/verify` en
      `/secretaria/profesional/archivo` para confirmarlo
- [ ] Confirmar que `sticky-col` sigue funcionando con scroll horizontal después del cambio

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — filas `/admin/clase-profesional/archivo` y
  `/secretaria/profesional/archivo`

## Archivos involucrados

- `src/app/features/admin/profesional-archivo/admin-profesional-archivo.component.ts`
