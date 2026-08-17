# Asignación ASG-b-084 — App-like: `/instructor/alumnos/:id/ficha` (piloto del patrón de tabs)

> **status:** reclamada
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** i
> **claimed_at:** 2026-08-17
> **resulting_track:** fix-027-i-app-like-instructor-ficha-tabs

---

## Contexto / Objetivo

Primera mitad del paso 16 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`) —
**intencionalmente ANTES** que la ficha grande de admin/secretaria (ASG-b-085). Es el **piloto de
bajo riesgo** para probar el patrón de reestructuración en tabs recién construido desde cero,
antes de aplicarlo a la página más grande y riesgosa de todo el rollout.

`InstructorFichaComponent` (550 líneas — mucho más chica que `AdminAlumnoDetalleComponent`, 1654
líneas): 4 `.bento-banner` secuenciales + un `.bento-grid` ANIDADO dentro de una de ellas. Mismo
problema de fondo que la ficha grande (secciones secuenciales sin tabs), pero a escala mucho
menor.

## Por qué va primero

Bajo el criterio formal de `.claude/rules/visual-system.md` §"Cuándo NO aplica el patrón",
"múltiples secciones secuenciales" ya no es motivo válido de exclusión — hay que reestructurar
en tabs. Pero construir esa UI de tabs por primera vez en una página de 550 líneas (y de menor
tráfico que la ficha admin/secretaria) es mucho menos riesgoso que hacerlo por primera vez
directo en la página de 1654 líneas y máximo tráfico del sistema.

## Plan

1. Identificar las 4 secciones actuales de `.bento-banner` (leer completo, no asumir cuáles son
   sin verificar — la auditoría no las catalogó una por una).
2. Construir la UI de tabs (usar `<app-tabs>`, el `TabsComponent` compartido — mismo componente
   que ya usa `configuracion-web`, ASG-b-072).
3. Cada sección se vuelve un panel de tab, la tab activa → `bento-fill flex flex-col h-full`.
4. **Documentar el patrón resultante** (qué decisiones se tomaron, qué se aprendió) para que
   ASG-b-085 (la ficha grande) lo reutilice directamente en vez de re-derivarlo.

## Checklist de cierre (rollout app-like)

- [x] `force-compact` cableado (`[class.force-compact]="drawer.isOpen()"`, mismo binding que
      `AdminContabilidadAnticiposComponent`) — sin trigger propio en esta página para probarlo
      end-to-end (no abre drawers desde acá), pero el mecanismo es idéntico al de producción
- [x] Sin lógica nueva de negocio (solo reestructuración visual) — no aplica `.spec.ts` nuevo
- [x] `/verify` en 390×844, 1440×900 y 768 de alto — ambas tabs probadas en los 3
- [x] Confirmado que ninguna acción/funcionalidad existente se perdió al mover contenido a tabs
      (routerLinks de Evaluar/Ver verificados intactos)
- [x] Nota del patrón final dejada en `indices/APP-LIKE-ROLLOUT.md` y en
      `specs/fixes/fix-027-i-app-like-instructor-ficha-tabs/fix.md` (sección Resultado)

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — fila `/instructor/alumnos/:id/ficha`
- `.claude/rules/visual-system.md` §"Cuándo NO aplica el patrón" — criterio que obliga a
  reestructurar en vez de excluir
- `src/app/shared/components/tabs/tabs.component.ts` — `TabsComponent` a reusar

## Archivos involucrados

- `src/app/features/instructor/ficha/instructor-ficha.component.ts`
