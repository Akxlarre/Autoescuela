# Fix: Facade inyectado directamente en Dumb Components (`shared/components/**`)

> id: fix-146-b-facade-en-dumb-components
> refs: ASG-b-089
> status: in_progress
> created: 2026-08-15

## Root Cause

**La causa raíz no es el código: es la regla.** (Corrige la hipótesis heredada de ASG-b-089,
que asumía 7 violaciones reales.)

`.claude/rules/architecture.md` §Smart vs Dumb decía *"Dumb (`shared/`): Solo `input()` y
`output()`. Sin inyección de Facades"*, equiparando **carpeta** con **rol**. Pero `shared/`
guarda dos cosas distintas:

- **UI presentacional real** (`app-icon`, `app-kpi-card`, `app-badge`, `app-skeleton-block`):
  sirve a cualquier caller, no sabe de dominio. Debe ser Dumb estricta.
- **Organismos**: pedazos de feature atados a un dominio, compartidos entre *portales* (admin
  y secretaría usan la misma página). Están en `shared/` por reutilización de portal, no por
  ser genéricos. El equipo ya reconoció esta categoría — es el "organismo semi-Smart" de
  `.claude/rules/facades.md` §7 — pero nunca generalizó el criterio.

El hallazgo H1 de `indices/DS-AUDIT-2026-08-03.md` fue un grep de `inject(*Facade)` sobre
`shared/`, sin mirar el rol ni cómo se instancian los componentes. Marcó 7; al revisarlos uno
por uno, **6 son organismos legítimos y 1 es violación real**.

### Verificación de por qué los 6 no son violaciones

1. **No tienen padre en ningún template.** `AlumnosPorVencerDrawerComponent`,
   `DetalleCuadraturaModalComponent`, `PagoInstructorModalComponent` y `AjustesDrawerComponent`
   se abren con `layoutDrawer.open(Componente, título, ícono)`.
2. **La infraestructura no puede pasarles inputs.** La firma es
   `open(component: Type<any>, title: string, icon?: string, actions?: any[])` — sin parámetro
   de inputs — y el host los renderiza con `*ngComponentOutlet="component()!"` sin binding de
   `inputs` (`src/app/layout/layout-drawer.component.ts:150`). Exigirles "solo `input()`" es
   imposible por construcción.
3. **El equipo ya decidió lo contrario, por escrito y a propósito:**
   - `admin-ex-alumnos-tasas-drawer.component.ts:11` — *"Lee directo de `ExAlumnosFacade`
     (self-sufficient, mismo patrón que `AlumnosPorVencerDrawerComponent`): no requiere inputs
     del componente que lo abre."*
   - `historial-cuadraturas.facade.ts:168` — el `computed` `isAdmin` vive en el Facade *"para
     que `DetalleCuadraturaModalComponent` (shared/) no necesite inyectar `AuthFacade`"*.
   - `historial-cuadraturas.facade.ts:252` — import dinámico en el Facade *"para que el modal no
     necesite inyectar `LayoutDrawerFacadeService`"*.

   Cuando el equipo quiso desacoplar estos modales, movió lógica **hacia** el Facade — nunca
   hacia inputs.

### Clasificación final de los 7

| Componente | Facade inyectada | Veredicto |
|---|---|---|
| `logo` | `AuthFacade` + `BranchFacade` | ❌ **Violación real** — renderiza un único string |
| `ajustes-drawer` | `AuthFacade` + `BranchFacade` | ✅ Organismo — es el panel de *Ajustes*: auth/sede **son** su dominio |
| `alumnos-por-vencer-drawer` | `AdminAlumnosFacade` | ✅ Organismo (Facade de su dominio) |
| `detalle-cuadratura-modal` | `HistorialCuadraturasFacade` | ✅ Organismo |
| `pago-instructor-modal` | `LiquidacionesFacade` | ✅ Organismo |
| `agregar-servicio-drawer` | `ServiciosEspecialesFacade` | ✅ Organismo |
| `registrar-venta-drawer` | `ServiciosEspecialesFacade` | ✅ Organismo |

### Por qué NO se fuerzan los 6

Cumplir la letra exigiría extender `LayoutDrawerFacadeService` para pasar inputs y luego
producir componentes de 6-8 inputs que **igual solo funcionan en un lugar**, más boilerplate en
cada padre: un Smart component disfrazado de Dumb. El lint pasaría y el código quedaría peor.
El principio dice *"lo presentacional no agarra estado global"*, no *"nada fuera de `features/`
puede inyectar"*.

## ACs Afectados

Ninguno — refactor arquitectónico, no cambia contrato de negocio ni UX observable.

## Cambio

### 1. `logo.component.ts` → Dumb puro (la violación real)

- **Archivo:** `src/app/shared/components/logo/logo.component.ts`
- Elimina `inject(AuthFacade)` + `inject(BranchFacade)`. Ahora recibe
  `brandText = input.required<string>()` y solo renderiza.

### 2. Núcleo funcional puro (nuevo)

- **Archivo:** `src/app/core/utils/brand-text.utils.ts`
- `resolveBrandText(role, selectedBranchId, userBranchId, branches)` — la decisión de qué
  sede mostrar, extraída del `computed()` que vivía en el componente. Testeable sin Angular
  (`architecture.md` §Núcleo Funcional).

### 3. `sidebar.component.ts` → resuelve y pasa

- **Archivo:** `src/app/layout/sidebar.component.ts`
- Único consumidor de `<app-logo>` (confirmado en `indices/USAGE-MAP.md`). Ya inyectaba ambos
  Facades y está en `layout/`, donde inyectar es legítimo. Agrega el `computed` `brandText`
  delegando en `resolveBrandText()` y lo pasa: `<app-logo [brandText]="brandText()" />`.

### 4. `.claude/rules/architecture.md` → corregir la regla (el cambio de fondo)

- Reemplaza `Dumb (shared/)` por el criterio de **rol**: Dumb presentacional (prohibido
  inyectar) vs Organismo de dominio (puede inyectar el Facade de su dominio; sigue prohibido
  inyectar transversales como `AuthFacade`/`BranchFacade` para derivar algo que el Facade de
  dominio podría exponer).
- Documenta la señal diagnóstica: si se abre vía `LayoutDrawerFacadeService.open()`, es
  Organismo por construcción.

## Test de Regresión

- **Nuevo:** `src/app/core/utils/brand-text.utils.spec.ts` — 7 casos cubriendo admin con y sin
  sede filtrada, secretaria anclada a la suya (ignorando el filtro global), roles sin scope,
  usuario ausente, sede no encontrada en la lista y lista vacía.
- `npx tsc --noEmit`
- `npm run test:ci`
- `npm run lint:arch`

> Sin `/verify` en navegador: la sesión corre en entorno remoto y el usuario no tiene acceso
> visual. El riesgo visual es acotado — el único cambio renderizable es el mismo `<span>` con
> el mismo texto, ahora recibido por `input()` en lugar de calculado internamente; la lógica
> que lo produce quedó cubierta por tests unitarios.

## Fuera de alcance

Mudar físicamente los organismos (`shared/organisms/` o por dominio) para que la carpeta
refleje el rol. Es mover muchos archivos y toca a los 3 devs → ASG aparte.

## Referencias

- `indices/DS-AUDIT-2026-08-03.md` §H1 (hallazgo original, con la clasificación ahora corregida)
- `.claude/rules/architecture.md` §Smart vs Dumb Components
- `.claude/rules/facades.md` §7 (precedente `*-content` semi-Smart que este fix generaliza)
- Originado de Asignación ASG-b-089 (`specs/assignments/ASG-b-089-facade-en-dumb-components.md`)
