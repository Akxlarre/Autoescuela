# Asignación ASG-b-086 — App-like: `/admin/libro-de-clases` + `/secretaria/libro-de-clases`

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

Último paso (17) del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`) — el más costoso de todos
junto con la ficha de alumno (ASG-b-085). **Sugerido como `spec`**, no `fix`.

`LibroDeClasesComponent` (shared admin+secretaria, 874 líneas): **7 `.bento-banner` secuenciales**
(verificado en la auditoría — profesores, alumnos, asistencia semanal, calendario, evaluaciones,
resumen, y una 7ma sin catalogar). Ya tiene `<app-libro-de-clases-subnav>` como navegación
auxiliar — **buena base**, porque la semántica de "secciones nombradas" ya existe. Falta
confirmar si el subnav hoy hace scroll-to-anchor (scrollea la página hasta la sección) o
show/hide real (oculta las demás secciones) — no se verificó en la auditoría.

## Deuda técnica a resolver EN EL MISMO TRACK (no en 2 pasadas separadas)

Esta página tiene un bug de skeleton gap ya documentado (fix-074, ver memoria de proyecto
`project_skeleton_gap_audit_fix074`): 2 loading-flags anidados dejan un gap de `<main>` vacío
~500-900ms, invisible a lectura de código, solo se ve con polling real del DOM. **Conviene
resolver junto con la reestructuración de tabs** para no tocar el componente dos veces — si se
está tocando el ciclo de carga de todas formas al mover a tabs, es el momento de arreglar el
gap.

## Plan

1. Leer las 7 secciones completas y catalogarlas (no asumir cuáles son).
2. Confirmar el comportamiento actual del subnav (scroll-to-anchor vs show/hide).
3. Si es scroll-to-anchor: convertirlo a mostrar/ocultar panel real vía `@switch`, reusando la
   semántica de navegación que el subnav ya tiene (no hay que inventar nombres de sección
   nuevos).
4. Una sección = un `.bento-fill` por tab.
5. Resolver el bug de skeleton gap (fix-074) como parte del mismo track.

## Checklist de cierre (rollout app-like, además de lo normal de una spec)

- [ ] `force-compact` verificado con drawer abierto
- [ ] `.spec.ts` para toda la lógica de tabs/densidad nueva
- [ ] `/verify` en **AMBAS rutas** (admin y secretaria — componente `shared`), 390×844, 1440×900
      y 768 de alto, en CADA tab
- [ ] Confirmar con polling real del DOM (receta reutilizable en la memoria de fix-074) que el
      gap de skeleton quedó resuelto, no solo "se ve bien a simple vista"
- [ ] Ninguna de las 7 secciones perdió funcionalidad al pasar a tabs

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — fila `/admin/libro-de-clases`
- Memoria de proyecto `project_skeleton_gap_audit_fix074` — bug conocido + receta de polling
  Playwright reutilizable

## Archivos involucrados

- `src/app/features/libro-de-clases/libro-de-clases.component.ts`
- `src/app/shared/components/libro-de-clases-subnav/libro-de-clases-subnav.component.ts`
