# Patrones (qué copiar)

> Las reglas de `.claude/rules/` dicen qué está permitido y qué no. `ANTI-PATTERNS.md` dice qué
> evitar. Este índice dice **de dónde partir**: para cada tipo de cosa que se construye seguido,
> cuál es la implementación de referencia, qué regla la gobierna y qué guard la exige.
>
> **Regla:** antes de planificar una feature, identifica qué arquetipos de esta tabla instancia y
> parte de su referencia. Cuando ninguno calza, dilo en el plan: puede ser un patrón nuevo, y al
> cerrar el track se agrega acá.
>
> **Estado de las referencias:** propuesta inicial, elegida por tamaño y por cumplir las reglas
> vigentes. Las confirma el equipo. Una fila sin referencia limpia lo dice en vez de apuntar a un
> archivo que no conviene copiar.
>
> `npm run lint:arch` (ARCH-38) falla si una ruta citada acá deja de existir.

## Pantallas

| Arquetipo | Cuándo | Referencia | Regla | Guard |
|---|---|---|---|---|
| Lista app-like con KPIs | Página enrutable con hero, fila de KPIs y un listado que scrollea por dentro. Es el default | `src/app/features/secretaria/observaciones/secretaria-observaciones.component.ts` | `visual-system.md` §Patrón App-like | Ninguno |
| Página con tabs | Varias secciones que antes eran bloques secuenciales: cada tab es su propia celda que crece | `src/app/features/admin/tareas/admin-tareas.component.ts` | `visual-system.md` §Cuándo NO aplica el patrón | Ninguno |
| Ficha de detalle | Detalle por `:id` con secciones fijas | Sin referencia limpia: la ficha del alumno tiene casi 2.000 líneas. Partir de "Página con tabs" | `visual-system.md`, `swr-pattern.md` (solo fetch) | Ninguno |
| Wizard de pantalla completa | Flujo por pasos con stepper | `src/app/features/secretaria/matricula/secretaria-matricula.component.scss` | `visual-system.md` §Cuándo NO aplica el patrón | Ninguno |
| Estado de error de carga | Toda pantalla que lee datos: caso A (se retira lo visible, "Reintentar") y caso B (se mantiene, con aviso) | `src/app/features/secretaria/observaciones/secretaria-observaciones.component.ts` | `swr-pattern.md` §Errores de carga | E2E X01 de `e2e/transversal-shell.spec.ts` |
| Estado de carga | Skeleton dentro del mismo componente, nunca un componente aparte | `src/app/shared/components/skeleton-block` | `visual-system.md` §Skeletons | Linter (sin `@keyframes`) |

## Componentes

| Arquetipo | Cuándo | Referencia | Regla | Guard |
|---|---|---|---|---|
| Drawer o modal de dominio (organismo) | Se abre con `LayoutDrawerFacadeService.open()` y no puede recibir `input()` | `src/app/shared/components/servicios-especiales-content/drawers/registrar-venta-drawer.component.ts` | `architecture.md` §El criterio es el ROL | ARCH-24, con `scripts/lib/shared-organisms.allowlist.json` |
| Componente presentacional | Cualquier caller podría usarlo pasándole datos planos | `src/app/shared/components/kpi-card` | `architecture.md` §Smart vs Dumb | ARCH-24 |
| Formulario en drawer | Alta o edición corta sin salir de la lista | `src/app/shared/components/servicios-especiales-content/drawers/registrar-venta-drawer.component.ts` | Skill `form-ux` | Ninguno |

## Datos

| Arquetipo | Cuándo | Referencia | Regla | Guard |
|---|---|---|---|---|
| Facade SWR con sede, guard de orden y Realtime | Datos que persisten entre navegaciones, dependen de la sede y cambian por otros usuarios | `src/app/core/facades/flota.facade.ts` | `facades.md` §7, `swr-pattern.md` | Lecturas y escrituras: `src/app/core/facades/unchecked-reads.guard.spec.ts`. SWR y guard de orden: ninguno |
| Lectura y escritura a la base | Toda llamada a Supabase revisa su error | `src/app/core/utils/db-error.utils.ts` | `facades.md` §4 | `src/app/core/facades/unchecked-reads.guard.spec.ts` y su par de escrituras |
| Respuestas fuera de orden | Un `fetch` que aplica resultados a signals y puede dispararse varias veces | `src/app/core/utils/request-guard.utils.ts` | `facades.md` §Guard contra respuestas fuera de orden | Ninguno |
| Lógica de negocio | Cálculo o transformación: función pura fuera del facade | `src/app/core/utils/chile-time.utils.ts` | `architecture.md` §Núcleo Funcional | Linter (complejidad de facades) |
| Fechas | Todo lo que convierte entre instante y día | `src/app/core/utils/chile-time.utils.ts` | `dates.md` | ARCH-27, ARCH-28 |
| Presupuesto de alto por contenedor | Cuántos ítems caben en una celda que crece | `src/app/core/utils/layout-tier.utils.ts` | `visual-system.md` §Pilar 2 | Ninguno |

## Backend

| Arquetipo | Cuándo | Referencia | Regla | Guard |
|---|---|---|---|---|
| Edge function con guard y test | Función que lee o escribe datos en nombre de un usuario | `supabase/functions/export-special-services/index.ts` | `testing-tdd.md` §Las capas de test | ARCH-36 |
| Regla de negocio en la base, con su test | Candado o permiso que la app no debe poder saltarse | `supabase/migrations/20261016150000_fix445_egresos_caja_cerrada.sql` y `supabase/tests/caja/fix-445-m-egresos-caja-cerrada.sql` | `database.md`, `testing-tdd.md` §Tests SQL | ARCH-37 |

## Guardrails

| Arquetipo | Cuándo | Referencia | Regla | Guard |
|---|---|---|---|---|
| Test que vigila una clase de error | Un bug se repitió en varios archivos: el test recorre el código y falla ante el patrón, no ante un caso | `src/app/core/facades/unchecked-reads.guard.spec.ts` | `facades.md` §4 | — |
| Regla del linter con lista de excepciones | Una regla con casos legítimos que la incumplen | `scripts/lib/shared-roles.js` y `scripts/lib/shared-organisms.allowlist.json` | `architecture.md` §Guardrail | `npm run test:scripts` |

## Convención para agregar o cambiar una fila

Un patrón entra acá si cumple todas:

1. Se va a repetir: ya existe en dos lugares, o el equipo decidió que la próxima vez se hace así.
2. Tiene una implementación que conviene copiar. Si la mejor que hay no conviene, la fila lo dice.
3. Cabe en una fila: cuándo aplica, de dónde partir, qué regla lo explica, qué lo exige.

El porqué y el detalle viven en la regla, no acá. Cuando un track cambia cuál es la mejor
referencia, se reemplaza la ruta: este índice describe el estado vigente.
