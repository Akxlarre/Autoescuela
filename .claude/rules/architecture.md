# Reglas Arquitectónicas

## Estructura de carpetas canónica

```text
src/
├── app/
│   ├── core/         # Facades, Guards, Interceptors, Modelos
│   ├── features/     # Smart Components (páginas enrutables)
│   ├── shared/       # Dumb Components (UI presentacional)
│   └── layout/       # Sidebar, Topbar, Shell
├── styles/
│   ├── tokens/       # SCSS variables — NUNCA hardcodear en componentes
│   └── vendors/      # PrimeNG overrides
supabase/
└── migrations/       # SQL idempotentes — NUNCA alterar BD manualmente
```

## Patrón Facade y Núcleo Funcional (Functional Core)

- La UI **NUNCA** inyecta `SupabaseService`, `HttpClient`, ni clientes REST directamente.
- **SIEMPRE** usar un `*FacadeService` que centraliza estado vía Signals.
- El Facade expone data al template con `toSignal()`.
- **NÚCLEO FUNCIONAL (Functional Core):** No acumules lógica compleja, matemática pesada o transformaciones de datos algorítmicas dentro de la Facade ni en los componentes. Extrae esa inteligencia a **funciones puras** de TypeScript (Data Out, Data In) en `core/utils/` o dominios específicos. Esto permite testear la lógica del negocio instantáneamente sin levantar inyecciones de Angular.

## Detección de cambios

- `changeDetection: ChangeDetectionStrategy.OnPush` en **TODOS** los componentes

## Signals & RxJS

- `signal()` → estado sincrónico UI (contadores, modales, toggles)
- `RxJS` → flujos asíncronos en Servicios
- `toSignal()` → exponer RxJS a templates en el Facade

## Templates

- **PROHIBIDO**: `*ngIf`, `*ngFor`, `ngClass`, `ngStyle`, `@Input()`, `@Output()`
- **OBLIGATORIO**: `@if`, `@for`, `[class.active]`, `[style.width.px]`, `input()`, `output()`

## Smart vs Dumb Components

- **Dumb (presentacional)**: Solo `input()` y `output()`. Sin inyección de Facades.
- **Smart (`features/`)**: Inyectan Facades. Coordinan Dumb Components.
- **Organismo (`shared/`, atado a un dominio)**: puede inyectar **el Facade de su propio
  dominio**. Ver criterio abajo.

### El criterio es el ROL, no la carpeta

`shared/` contiene dos cosas distintas y la regla no puede tratarlas igual:

| Pregunta | Sí → **Dumb** | No → **Organismo** |
|---|---|---|
| ¿Cualquier caller podría usarlo pasándole datos planos, sin conocer su dominio? | `app-icon`, `app-kpi-card`, `app-badge`, `app-skeleton-block`, `app-logo` | `*-content`, drawers/modales de dominio |

- **Dumb** → prohibido inyectar cualquier Facade. Si necesita datos, los recibe por `input()`.
- **Organismo** → puede inyectar el Facade de **su** dominio (`ServiciosEspecialesFacade` en un
  drawer de servicios especiales). Sigue prohibido inyectar Facades **transversales**
  (`AuthFacade`, `BranchFacade`) para derivar algo que el Facade de dominio podría exponer:
  mové ese `computed()` al Facade en vez de inyectar el transversal en el componente.

**Señal de que algo es Organismo y no Dumb:** se abre dinámicamente vía
`LayoutDrawerFacadeService.open(Componente, …)`. Ese servicio no pasa `inputs` — un componente
sin padre en ningún template no puede recibir datos por `input()`, así que exigirle "solo
`input()`/`output()`" es imposible por construcción, no por descuido.

> Hasta fix-146-b esta regla decía `Dumb (shared/)`, equiparando carpeta con rol. Una auditoría
> del DS (H1, 2026-08-03) marcó 7 componentes como violación por eso; al revisarlos, 6 eran
> organismos legítimos y solo `app-logo` era una violación real (renderizaba un único string
> inyectando `AuthFacade` + `BranchFacade`). Se corrigió la regla, no los 6 componentes —
> forzarles `input()` habría requerido extender la infraestructura de drawers para producir
> componentes con 8 inputs que igual solo funcionan en un lugar. Criterio de aplicabilidad:
> **cuando la regla y el código llevan mucho tiempo en desacuerdo y el código es coherente
> consigo mismo, sospechá de la regla antes que del código.**
- **Skeletons**: **NO** se crean componentes `*-skeleton.component.ts` colocados. El estado de
  carga se resuelve **dentro del mismo componente** con `@if (loading())` + `<app-skeleton-block>`.
  Fuente única de esta regla: `visual-system.md` §"Skeletons y Estados de Carga".
  > Hasta fix-077-b esta línea decía lo contrario ("cada Dumb tiene su
  > `{nombre}-skeleton.component.ts` al lado"), contradiciendo a `visual-system.md:91`. Era ley
  > muerta: el único skeleton en `src/app` es `shared/components/skeleton-block/`.

## Clases Semánticas vs Tailwind Genérico

En componentes de presentación (`shared/`), **preferir siempre** las clases semánticas del design system sobre la composición directa de utilities Tailwind:

| Necesidad | CORRECTO | PROHIBIDO |
|---|---|---|
| Número KPI grande | `.kpi-value` | `text-4xl font-bold tracking-tight` |
| Etiqueta de KPI | `.kpi-label` | `text-xs text-gray-500 uppercase` |
| Banner/Hero section | `.surface-hero` | `bg-gradient-to-br from-blue-600 to-purple-600` |
| Overlay glass | `.surface-glass` | `bg-white/90 backdrop-blur-md border` |
| Estado activo/online | `.indicator-live` | `inline-flex gap-2 before:w-2 before:bg-green-500` |

**Regla general**: Tailwind para spacing, sizing y layout (`p-4`, `flex`, `grid`, `w-full`, `gap-3`). Clases semánticas del DS para identidad visual, tipografía dramática y superficies.
