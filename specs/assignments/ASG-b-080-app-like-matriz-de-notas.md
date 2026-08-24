# Asignación ASG-b-080 — App-like: matriz de notas (`admin/clase-profesional/evaluaciones` + `secretaria/profesional/notas`)

> **status:** completada
> **owner:** m
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** m
> **claimed_at:** 2026-08-10
> **resulting_track:** 0008-m-app-like-matriz-notas-evaluaciones

---

## Contexto / Objetivo

Paso 13 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`). **Sugerido como `spec`, no `fix`**
— a diferencia del resto del rollout, esto NO es una pasada mecánica de clases CSS: requiere
diseño nuevo antes de tocar código.

`AdminProfesionalEvaluacionesComponent` (828 líneas) y `SecretariaProfesionalNotasComponent`
(758 líneas, confirmado casi clon exacto — mismo CSS sticky inline, mismo modo dual) tienen
**dos modos completamente distintos** dentro del mismo componente:

1. **"Aterrizaje"** (sin grilla activa): N grupos de promoción apilados, cada uno su propia
   `.bento-banner` con grid de cursos — cantidad VARIABLE, no acotada por diseño actual.
2. **"Grilla"** (matriz de notas real): ya tiene CSS custom inline sobrescribiendo `.bento-grid`,
   header `sticky` Y columna de alumno `sticky` (scroll bidireccional ya resuelto en parte por
   el equipo).

## Por qué necesita spec, no fix directo

- **Modo aterrizaje:** hoy cada grupo de promoción es su propia celda top-level del grid — para
  que el fill-screen tenga sentido con una cantidad variable de grupos, hay que decidir CÓMO
  envolverlos (¿todos en un único wrapper `.bento-fill` con scroll compartido? ¿algún límite de
  densidad?) — no es una decisión mecánica, afecta cuántas promociones ve el usuario sin
  scrollear.
- **Modo grilla:** ya tiene una base de scroll bidireccional construida a mano (sticky header +
  sticky columna) — hay que integrarla con `--fill-screen-kpi`/`.bento-fill` **sin romper esos
  sticky existentes**, que es fácil de reventar si no se entiende bien el CSS custom actual.
- 828 + 758 líneas no se mapearon en detalle durante la auditoría — la spec debe incluir esa
  lectura completa como primer paso.

## Checklist de cierre (rollout app-like, además de lo normal de una spec)

- [ ] `force-compact` verificado con drawer abierto (ambas páginas), respetando el CSS custom
      existente
- [ ] `.spec.ts` para cualquier lógica de densidad nueva que se agregue en el modo aterrizaje
- [ ] `/verify` en **AMBAS rutas** — casi-clon, pero son 2 archivos distintos —, en 390×844,
      1440×900 y 768 de alto, probando AMBOS modos (aterrizaje y grilla)
- [ ] Verificar que el scroll bidireccional existente (sticky header + sticky columna) sigue
      funcionando después del cambio

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — filas `/admin/clase-profesional/evaluaciones` y
  `/secretaria/profesional/notas`

## Archivos involucrados

- `src/app/features/admin/profesional-evaluaciones/admin-profesional-evaluaciones.component.ts`
- `src/app/features/secretaria/profesional-notas/secretaria-profesional-notas.component.ts`
