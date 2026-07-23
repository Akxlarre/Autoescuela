---
# fix-052-m — Libro de Clases: consolidar duplicado + subnav horizontal adaptativo

## Contexto

Hoy `admin-libro-de-clases.component.ts` (954 líneas) y
`secretaria-libro-de-clases.component.ts` (895 líneas) son **el mismo componente
duplicado** — un diff normalizando nombres de clase/selector confirma que son
idénticos carácter por carácter salvo comentarios y formato de Prettier. Ambos
implementan las mismas 7 secciones como acordeón (`openSections: Set<string>` +
`toggleSection()`), lo cual el dueño reportó como "demasiado scroll, no agradable
a la vista".

Se evaluaron 3 alternativas con mockups interactivos (rail vertical, rail
compacto de íconos, tira horizontal) — ver conversación de diseño previa. Se
eligió la **tira horizontal adaptativa**: reemplaza el acordeón por un subnav de
una sola fila que muestra una sección a la vez, y en vez de depender de scroll
horizontal cuando no caben los 7 ítems, comprime en tiers (`completo` →
`abreviado` → `solo ícono` → `dropdown`) según el ancho real del contenedor —
midiendo con el mismo enfoque de densidad-por-contenedor que ya usa
`LayoutService.tier()` en el patrón App-like. Se comprobó con un simulador de
ancho que, con el sidebar real (220px) restado, el tier "completo" casi nunca
aparece en pantallas de laptop — el tier "abreviado" es el estado de reposo
real en desktop, no una degradación de última instancia.

Dado que el componente está 100% duplicado sin ninguna diferencia de
comportamiento entre admin y secretaria, este fix también consolida ambos en
uno solo antes de tocar la navegación — implementar el subnav dos veces sobre
código idéntico solo perpetuaría la deuda.

## Alcance

### 1. Consolidar el duplicado
- Eliminar `features/admin/libro-de-clases/admin-libro-de-clases.component.ts`
  y `features/secretaria/libro-de-clases/secretaria-libro-de-clases.component.ts`.
- Crear `features/libro-de-clases/libro-de-clases.component.ts` (selector
  `app-libro-de-clases`) con el contenido consolidado.
- Actualizar `app.routes.ts` (rutas `admin/.../libro-de-clases` y
  `secretaria/.../libro-de-clases`, hoy ~líneas 290 y 612) para que ambos
  árboles de ruta hagan lazy-load del mismo archivo.
- `LibroDeClasesFacade` no se toca — sigue siendo el único punto de acceso a
  datos, ya es agnóstico de rol.

### 2. Modelo y utilidad pura (con test — `core/utils` es obligatorio)
- `core/models/ui/libro-clases-subnav.model.ts`:
  ```ts
  export interface LibroClasesSubnavSection {
    id: string;
    label: string;
    shortLabel: string;
    icon: string;
    meta?: string;
  }
  ```
- `core/utils/subnav-tier.utils.ts`:
  ```ts
  export type SubnavTier = 'full' | 'short' | 'icon' | 'select';

  /** Prueba los tiers de mayor a menor densidad y devuelve el primero que cabe. */
  export function pickSubnavTier(
    fitsTier: (tier: 'full' | 'short' | 'icon') => boolean,
  ): SubnavTier {
    const order: Array<'full' | 'short' | 'icon'> = ['full', 'short', 'icon'];
    for (const tier of order) if (fitsTier(tier)) return tier;
    return 'select';
  }
  ```
- `subnav-tier.utils.spec.ts`: casos — cabe en `full`; solo cabe desde `short`;
  solo cabe desde `icon`; no cabe ninguno → `select`.

### 3. Componente compartido `app-libro-de-clases-subnav`
`shared/components/libro-de-clases-subnav/libro-de-clases-subnav.component.ts`:
- Dumb component, `OnPush`, solo `input()`/`output()` (sin Facades).
- `sections = input.required<LibroClasesSubnavSection[]>()`,
  `activeId = input.required<string>()`, `sectionChange = output<string>()`.
- Mide su propio ancho con `ResizeObserver` (alta en `afterNextRender`, baja
  con `DestroyRef`) y usa `pickSubnavTier()` para decidir el tier, probando
  cada candidato con una medición real (`scrollWidth` vs `clientWidth`) antes
  de aceptarlo — mismo mecanismo validado en el mockup.
- Tiers `full` / `short` / `icon`: fila de chips (`@for`), con
  `data-llm-nav="{{ section.id }}"` en cada uno.
- Tier `select`: botón + menú desplegable con el mismo aspecto que un
  `p-select` (evaluar en implementación si conviene usar `p-select` real de
  PrimeNG en vez de un dropdown custom, para reutilizar overlay/teclado/a11y
  ya resueltos por la librería).
- Skeleton: no aplica (el subnav solo se muestra una vez `facade.hasDatos()`
  es true, igual que hoy el acordeón).

### 4. `libro-de-clases.component.ts` (el único, post-consolidación)
- Reemplaza `openSections` / `toggleSection()` / `allSectionsOpen()` por
  `activeSection = signal<string>('cabecera')`.
- Reemplaza los 7 bloques `<section>` con botón-acordeón por un solo
  `<app-libro-de-clases-subnav>` + un `@switch (activeSection())` (o 7 `@if`)
  que muestra el contenido de la sección activa. El HTML interno de cada
  sección (tablas, formulario editable, grilla de asistencia) no cambia.
- `sections = computed<LibroClasesSubnavSection[]>()` arma el array de
  metadata a partir de los mismos `computed()` que ya existen
  (`facade.profesores().length`, `facade.totalAlumnos()`, etc.) — no se
  duplica data del facade.
- Elimina la acción de hero "Expandir todo / Colapsar todo" (ya no aplica con
  una sola sección visible) — el hero queda solo con "Exportar PDF".
- Quita del `styles` el CSS de `.section-toggle` / `.section-meta` que ya no
  se usa (se movió al componente subnav).

### 5. Índices
- `indices/COMPONENTS.md`: nueva entrada `app-libro-de-clases-subnav`;
  actualizar la entrada de Libro de Clases para apuntar a la ruta
  consolidada `features/libro-de-clases/`.

## Fuera de alcance

- No se toca `LibroDeClasesFacade` (queries, signals, `exportPdf()`,
  `saveClassBookFields()`) — la migración es puramente presentacional.
- No se adopta el subnav en ninguna otra vista de la app en este fix, aunque
  el componente quede genérico y reutilizable.
- No se persiste la sección activa entre recargas (ej. query param) — siempre
  vuelve a `'cabecera'` al entrar. Candidato a fix futuro si se pide.
- No se cambia el contenido/lógica de ninguna de las 7 secciones (tablas,
  formulario SENCE/Horario, grilla de asistencia, evaluaciones) — solo el
  mecanismo de navegación entre ellas.

## Acceptance Criteria

- AC1: Existe un solo componente para Libro de Clases
  (`features/libro-de-clases/libro-de-clases.component.ts`); los duplicados de
  `admin/` y `secretaria/` fueron eliminados; ambas rutas
  (`/app/admin/.../libro-de-clases`, `/app/secretaria/.../libro-de-clases`)
  siguen funcionando cargando el mismo componente.
- AC2: El subnav horizontal reemplaza al acordeón — solo una sección es
  visible a la vez, sin las 7 apiladas con scroll de página.
- AC3: El subnav nunca produce scroll horizontal — degrada
  completo → abreviado → solo-ícono → dropdown según el ancho real del
  contenedor (verificar con `/verify` achicando la ventana y con el drawer
  global abierto, que es el caso real donde `<main>` se angosta).
- AC4: Cada ítem del subnav (en cualquier tier) lleva `data-llm-nav` con el id
  de la sección.
- AC5: `pickSubnavTier()` tiene `.spec.ts` cubriendo los 4 casos
  (full / short / icon / select).
- AC6: `npm run test:ci` en verde; `npm run lint:arch` sin nuevas
  violaciones.
- AC7: `indices/COMPONENTS.md` actualizado con el componente nuevo y la ruta
  consolidada.
