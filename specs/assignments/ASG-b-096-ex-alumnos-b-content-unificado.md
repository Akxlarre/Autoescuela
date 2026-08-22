# Asignación ASG-b-096 — Consolidar las 2 páginas duplicadas de ex-alumnos Clase B en un `*-content` compartido

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-08-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Detectado al implementar la spec `0038-b` (ex `fix-147-b`, ASG-b-087): para agregar el selector de período a
ex-alumnos Clase B hay que hacer **el mismo cambio dos veces** en dos archivos casi idénticos.

Medición real (2026-08-22):

| Archivo | Líneas |
|---|---|
| `features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts` | 605 |
| `features/secretaria/ex-alumnos/secretaria-ex-alumnos.component.ts` | 588 |

**573 líneas idénticas** — un `diff` ignorando espacios da solo **77 líneas distintas**, y de
esas la mayoría son formato. Las diferencias **reales** son cuatro, todas triviales:

1. El `selector` del componente.
2. El `basePath` de los `routerLink` (`/app/admin/alumnos` vs `/app/secretaria/alumnos`).
3. Admin inyecta `BranchFacade` (para el `effect()` de cambio de sede); secretaría no.
4. Los imports de los drawers, que secretaría alcanza por ruta relativa hacia la carpeta de
   admin (`../../admin/alumnos/ex-alumnos/components/...`) — un olor de que el dueño real de
   esos drawers no es ninguno de los dos.

Es **~93% de duplicación**, el mismo orden que el ~95% que motivó la spec `0032-b`.

## Precedente a seguir

**`0032-b-pre-inscritos-content-fill-screen`** resolvió exactamente este problema para
pre-inscritos: un Dumb `app-pre-inscritos-content` en `shared/components/`, consumido por
ambos portales, con cada Smart Component reducido a cablear inputs/outputs + drawer + facade.
Leer esa spec **antes** de diseñar — su lista de ACs es reutilizable casi tal cual, incluidos
los edge cases.

El input para la diferencia (2) ya tiene precedente en el proyecto:
`app-alumnos-list-content` expone `basePath = input<string>('/app/secretaria')`. Usar el mismo
patrón, no inventar otro.

## Alcance sugerido

- Nuevo Dumb `app-ex-alumnos-content` en `shared/components/`, con la tabla, el buscador y los
  filtros que hoy están inline y duplicados.
- Ambos Smart Components quedan reducidos a cablear facade + drawers + inputs/outputs.
- Inputs mínimos previstos: `egresados`, `isLoading`, `basePath`, y lo que pida el estado real
  al extraerlo. Outputs para abrir los drawers (tasas, comentarios).
- Resolver de paso la diferencia (4): decidir dónde viven de verdad los drawers de tasas y
  comentarios, en vez de que secretaría los importe por ruta relativa desde la carpeta de admin.
- Evaluar si conviene aprovechar y aplicar app-like/fill-screen en la misma pasada, como hizo
  0032 — pero **solo si no infla el track**; la consolidación es el objetivo, el layout es
  oportunidad.

## Coordinación con la spec `0038-b` — YA NO BLOQUEA (actualizado 2026-08-22)

> El track que originó esta nota era `fix-147-b`, **convertido a la spec
> `0038-b-filtro-periodo-listas-sin-techo`** y ya cerrado (✅ PASA, 2229/2229 tests).
> **El solape dejó de ser un riesgo de coordinación y pasó a ser trabajo concreto a absorber.**

Esa spec agregó `<app-period-selector>` a las dos páginas, **cableado dos veces a sabiendas**:
no se podía bloquear una P1 esperando un refactor sin dueño ni fecha.

Consecuencia concreta para quien reclame esta asignación: al extraer el `*-content`, el
selector de período, el signal `periodWindow`, el `computed` `hasActiveSearch` y la llamada a
`applyPeriodWindow()` **ya están duplicados** en ambos archivos, en bloques idénticos. Hay que
**absorberlos** en el componente unificado, no reimplementarlos ni borrarlos.

Referencias útiles al hacerlo:
- `servicios-especiales-content.component.ts` — cómo quedó el cableado en un `*-content` ya
  compartido (el patrón destino).
- `specs/specs/0038-b-filtro-periodo-listas-sin-techo/acceptance.md` §"Deuda conocida y
  aceptada" — deja registrado que esta duplicación fue una decisión, no un descuido.
- ⚠️ Al mover el template, **cuidado con los backticks** dentro de comentarios del `template`
  literal: terminan el string antes de tiempo. Ya pasó en `secretaria-ex-alumnos` durante la
  `0038-b` y produjo 3 errores de `tsc` en lugares no relacionados.

## Archivos involucrados (para detectar solapes)

- `src/app/features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts`
- `src/app/features/secretaria/ex-alumnos/secretaria-ex-alumnos.component.ts`
- `src/app/features/admin/alumnos/ex-alumnos/components/**` (drawers de tasas y comentarios)
- `src/app/shared/components/ex-alumnos-content/` (nuevo)

⚠️ La spec `0038-b` ya tocó los 2 primeros archivos (selector de período duplicado). No es un bloqueo: es código a absorber — ver la sección de coordinación arriba.

## Notas para quien la reclame

- Marcada como `spec` y no `fix` a propósito: mover ~600 líneas a un componente compartido
  cambia contratos públicos y necesita ACs verificables, igual que 0032.
- El valor no es estético: hoy **todo cambio en ex-alumnos B hay que hacerlo dos veces**, y
  cada vez que alguien lo hace una sola vez las páginas divergen un poco más. La spec `0038-b` es
  el ejemplo en vivo de ese costo.
