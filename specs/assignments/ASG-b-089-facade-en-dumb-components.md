# Asignación ASG-b-089 — Facade inyectado directamente en Dumb Components (`shared/components/**`)

> **status:** completada
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** Media
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-08-15
> **resulting_track:** fix-146-b-facade-en-dumb-components

---

## Contexto / Objetivo

Hallazgo H1 de la auditoría fresca del DS (`indices/DS-AUDIT-2026-08-03.md`). Regla violada:
`.claude/rules/architecture.md` §Smart vs Dumb — "Dumb (`shared/`): Solo `input()` y `output()`.
Sin inyección de Facades." 9 inyecciones de Facade en 7 Dumb Components:

| Archivo | Facade(s) inyectada(s) | Gravedad |
|---|---|---|
| `shared/components/ajustes-drawer/ajustes-drawer.component.ts:382-383` | `AuthFacade` + `BranchFacade` | Alta — consume signals directo en bindings de template |
| `shared/components/logo/logo.component.ts:29-30` | `AuthFacade` + `BranchFacade` | Alta — mismo patrón |
| `shared/components/alumnos-por-vencer-drawer/alumnos-por-vencer-drawer.component.ts:77` | `AdminAlumnosFacade` | Media |
| `shared/components/detalle-cuadratura-modal/detalle-cuadratura-modal.component.ts:278` | `HistorialCuadraturasFacade` | Media |
| `shared/components/pago-instructor-modal/pago-instructor-modal.component.ts:207` | `LiquidacionesFacade` | Media |
| `shared/components/servicios-especiales-content/drawers/agregar-servicio-drawer.component.ts:85` | `ServiciosEspecialesFacade` | Media (ver nota) |
| `shared/components/servicios-especiales-content/drawers/registrar-venta-drawer.component.ts:162` | `ServiciosEspecialesFacade` | Media (ver nota) |

## Alcance sugerido

**No hay una única solución mecánica — cada componente necesita su propio análisis** de cuál es
el camino correcto:

1. **`logo.component.ts`** — probablemente el más simple: expone `branchName`/`branchLogoUrl` (o
   lo que consuma hoy de `AuthFacade`/`BranchFacade`) como `input()`, y el Smart/Layout padre
   (`SidebarComponent`/`TopbarComponent`/`AppShellComponent`) se los pasa. Es un componente
   puramente presentacional, candidato ideal para volver 100% Dumb.
2. **`ajustes-drawer.component.ts`** — usa `branchFacade.selectedBranchId()` directo en bindings
   de template (`[class.bg-brand-muted]`). Evaluar si conviene mover esos `input()` desde el
   padre, o si el drawer en realidad necesita ser promovido a componente "organismo" semi-Smart
   (mismo estatus que los `*-content` documentados en `facades.md` — evaluar con el equipo si
   aplica ese precedente aquí).
3. **Los 5 drawers/modales restantes** (`alumnos-por-vencer-drawer`, `detalle-cuadratura-modal`,
   `pago-instructor-modal`, `agregar-servicio-drawer`, `registrar-venta-drawer`) — patrón típico:
   reciben un `id`/entidad vía `input()` y hoy usan el Facade inyectado para buscar detalle o
   mutar. Refactor esperado: el Smart Component padre pasa la data ya cargada vía `input()`, y el
   drawer emite `output()` para que el padre ejecute la mutación a través del Facade (el padre sí
   puede inyectar Facades legítimamente).
4. **Los 2 drawers de `servicios-especiales-content/`** — caso límite: el propio `*-content` ya
   es un organismo semi-Smart compartido entre portales (patrón documentado). Antes de tocar sus
   drawers, decidir con el equipo si "hereda" el mismo estatus semi-Smart o si debe respetar la
   regla estricta de Dumb — no asumir, esto define el alcance real del punto 4 vs. los 3 primeros.

**Sugerencia de orden:** empezar por `logo.component.ts` (más simple, bajo riesgo, sirve de
precedente) antes de atacar los drawers/modales más grandes.

## Referencias

- `indices/DS-AUDIT-2026-08-03.md` §H1 (hallazgo completo con snippets)
- `.claude/rules/architecture.md` §Smart vs Dumb Components
- `.claude/rules/facades.md` §7 (para el caso límite de `*-content` semi-Smart)

## Archivos involucrados

- `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts`
- `src/app/shared/components/logo/logo.component.ts`
- `src/app/shared/components/alumnos-por-vencer-drawer/alumnos-por-vencer-drawer.component.ts`
- `src/app/shared/components/detalle-cuadratura-modal/detalle-cuadratura-modal.component.ts`
- `src/app/shared/components/pago-instructor-modal/pago-instructor-modal.component.ts`
- `src/app/shared/components/servicios-especiales-content/drawers/agregar-servicio-drawer.component.ts`
- `src/app/shared/components/servicios-especiales-content/drawers/registrar-venta-drawer.component.ts`

## Notas para quien la reclame

- Es un refactor arquitectónico, no un bug visible — bajo riesgo de romper UX si se hace con
  cuidado, pero cada componente puede requerir tocar también a su(s) Smart padre(s) que lo
  invocan (buscar todos los usos con `indices/USAGE-MAP.md` antes de tocar cada uno).
- Candidato a dividirse en varias asignaciones más chicas si un solo dev no quiere tomarlo
  completo (ej. una por componente, o agrupado logo+ajustes-drawer vs. los 5 drawers/modales).
- No es urgente — es deuda arquitectónica real pero sin síntoma visible para el usuario final.

## Resolución (2026-08-15) — el hallazgo era un falso positivo, salvo 1 caso

Reclamada por `b` → `fix-146-b-facade-en-dumb-components`.

> ⚠️ Una nota anterior de este mismo día decía que se cubrían "4 casos mecánicos" y que
> quedaban "3 pendientes". **Eso quedó obsoleto**: se escribió antes de investigar cómo se
> instancian los componentes. El resultado real es distinto y es el que vale.

**La premisa de esta Asignación era incorrecta.** Asumía que el arreglo era "el Smart padre
pasa la data por `input()`". Eso es imposible para 6 de los 7: se abren dinámicamente vía
`LayoutDrawerFacadeService.open(Componente, …)`, que no tiene parámetro de inputs, y se
renderizan con `*ngComponentOutlet` sin binding de `inputs`. No tienen padre en ningún
template.

**Clasificación final:** 1 violación real (`logo` — renderizaba un único string inyectando
`AuthFacade` + `BranchFacade`) y 6 organismos legítimos, cada uno inyectando el Facade de su
propio dominio (`ajustes-drawer` incluido: es el panel de *Ajustes*, auth/sede **son** su
dominio).

**Qué se hizo:** se arregló `logo` y se corrigió la **regla** (`.claude/rules/architecture.md`),
que equiparaba carpeta con rol. Ahora distingue Dumb presentacional (prohibido inyectar) de
Organismo de dominio (puede inyectar el Facade de su dominio, nunca transversales para derivar
algo que el Facade podría exponer), con la señal diagnóstica de apertura dinámica.

→ **ASG-b-089 queda resuelta.** El hallazgo H1 no vuelve a levantarse porque la regla ya no
lo genera. Queda un residuo opcional, que NO bloquea el cierre: mudar los organismos a una
carpeta que refleje su rol (`shared/organisms/` o por dominio). Ver ASG-b-092.
