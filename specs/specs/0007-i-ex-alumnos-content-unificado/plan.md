# Plan 0007-i — Consolidar Ex-Alumnos Clase B en un `*-content` compartido

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-08-31

---

## 1. Resumen ejecutivo

Extraer un Dumb `app-ex-alumnos-content` compartido (`shared/components/`) con la tabla,
buscador, filtros y KPIs de Ex-Alumnos Clase B, siguiendo el patrón ya validado en
`servicios-especiales-content` (drawers hermanos) y `alumnos-list-content`
(`basePath` input). `AdminExAlumnosComponent` y `SecretariaExAlumnosComponent` quedan
reducidos a cablear `ExAlumnosFacade` + `BranchFacade` (solo admin) + drawers. Los 2
drawers (Tasas, Comentarios) se mueven a `shared/components/ex-alumnos-content/drawers/`.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/shared/components/ex-alumnos-content/ex-alumnos-content.component.ts` | Dumb puro | Tabla + buscador + `app-period-selector` + KPIs de Ex-Alumnos B, absorbe la lógica hoy duplicada (ver contrato ajustado más abajo — sin `inject()` de Facades, el Architect Guard lo bloquea en `shared/`) |
| `src/app/shared/components/ex-alumnos-content/ex-alumnos-content.component.spec.ts` | Test | Cubre `computed()` de filtrado (búsqueda + período), paginación mobile y el guard de `reEnrollRequested` — obligatorio por `testing-tdd.md` |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts` | Reducir a Smart: inyecta `ExAlumnosFacade` + `BranchFacade` + `LayoutDrawerFacadeService` + `ConfirmModalService` + `Router`/`ActivatedRoute`, mantiene `effect()` de recarga por sede, `handleHeroAction()` y `reEnroll()` (con el guard `selectBranch()`), renderiza `<app-ex-alumnos-content [egresados]="facade.egresadosClaseBList()" [isLoading]="facade.isLoading()" basePath="/app/admin" (reEnrollRequested)="reEnroll($event)" (requestVerTasas)="..." (requestComentario)="..." />` | Elimina la tabla/búsqueda/período/paginación duplicadas (~400 líneas) — el resto (`reEnroll`, hero actions) se queda, es legítimamente Smart |
| `src/app/features/secretaria/ex-alumnos/secretaria-ex-alumnos.component.ts` | Ídem, sin `BranchFacade`; **el import de los 2 drawers pasa de ruta relativa (`../../admin/...`) al alias `@features/admin/alumnos/ex-alumnos/components/...`** (resuelve el "olor" de la diferencia 4 sin mover archivos Facade-injecting a `shared/`, bloqueado por el Architect Guard) | Ídem + AC-E2 |
| `indices/COMPONENTS.md` | Agregar fila `app-ex-alumnos-content` + actualizar filas de los 2 Smart Components | Sync obligatorio |

### Archivos a ELIMINAR

Ninguno. **Corrección de alcance (ver nota del Architect Guard más abajo):** los 2 drawers
(Tasas, Comentarios) y su sub-componente `admin-ex-alumnos-stats.component.ts` **NO se
mueven** — inyectan `ExAlumnosFacade` directamente, y el Architect Guard bloquea cualquier
`.component.ts` en `shared/` que inyecte algo con "Facade" en el nombre (sin excepción para
Organismos, aunque `architecture.md` sí lo permitiría). Se quedan en
`features/admin/alumnos/ex-alumnos/components/` — siguen siendo válidos ahí (Smart, con
Facade, en `features/`). El AC-E2 (imports relativos cruzados) se resuelve con el alias
`@features/` en vez de relocalizar los archivos.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `<app-period-selector>` — ya se usa en ambos Smart Components hoy (agregado por `0038-b`),
  se absorbe tal cual dentro del nuevo `*-content`, sin reimplementar su lógica.
- Patrón `basePath = input<string>('/app/...')` — precedente exacto en
  `alumnos-list-content`, `alumnos-profesional-list-content`, `flota-list-content`,
  `dms-list-content` (ver `indices/COMPONENTS.md`).
- Patrón de drawers hermanos en `<x>-content/drawers/` — precedente exacto en
  `servicios-especiales-content/drawers/` (2 drawers ya viven ahí hoy).

### Facades/Services existentes que extendemos
- `ExAlumnosFacade` (`core/facades/ex-alumnos.facade.ts`) — **ya es compartida** por ambos
  Smart Components hoy (`protected readonly facade = inject(ExAlumnosFacade)` en los dos
  archivos, `providedIn: 'root'` → misma instancia). **Ya inyecta `BranchFacade`
  internamente** y filtra por `branchFacade.selectedBranchId()` en su propio
  `loadEgresados()` — el filtrado por sede YA es responsabilidad de la Facade, conforme a
  `facades.md` §7. No requiere cambios.
- `egresadosClaseBList` (computed en la Facade) — ya filtra a `licenseGroup === 'class_b'`.
- `LayoutDrawerFacadeService` / `ConfirmModalService` / `Router` / `ActivatedRoute` — sin
  cambios; el Organismo los inyecta directamente (permitido — no son Facades transversales
  de dominio, ver `architecture.md`).

### Corrección tras leer el código completo (no solo el `diff`)

La lectura línea por línea reveló que la duplicación real es **mucho mayor** que "la
tabla": `heroActions`/`handleHeroAction`/`heroChips`/`heroKpis`, `searchTerm`/
`periodWindow`/`hasActiveSearch`/`filteredEgresados`, `mobileShown`/`visibleCards`/
`remainingCards`/`loadMoreCards`, `initials`, `availableYears`, `clearFilters`, y
`reEnroll()` (confirmación + navegación + apertura del wizard) son **100% idénticos**
entre los dos archivos — la ÚNICA línea realmente distinta dentro de toda esa superficie
es `branchFacade.selectBranch(egresado.branchId)` dentro de `reEnroll()`. Como
`ExAlumnosFacade` es su propio dominio, el Organismo puede inyectarla directamente (sin
`input()` de `egresados`/`isLoading`) — así que **todo ese bloque se mueve entero** al
Organismo, no solo el HTML de la tabla. Esto reemplaza el diseño de inputs/outputs
propuesto originalmente en la spec (§9 "Notas/decisiones abiertas") por uno más simple:

### Componentes/Facades que NO existen y debemos crear
- `app-ex-alumnos-content` — no existe un equivalente reutilizable (es exactamente el
  contenido duplicado que motiva esta spec).

### Decisión de diseño: dónde vive el `effect()` de `BranchFacade`

`BranchFacade` es **transversal** — `architecture.md` prohíbe inyectarla en un Dumb/Organismo
para derivar algo que la Facade de dominio ya podría exponer. Como `ExAlumnosFacade` **ya**
resuelve el filtrado por sede internamente, el único rol que le queda al `effect()` en
`AdminExAlumnosComponent` es **disparar el refresh** cuando cambia la sede (mismo patrón que
`facades.md` §7 documenta: "la reactividad es responsabilidad del Smart Component"). Esto
**se queda en `AdminExAlumnosComponent`, sin cambios**. El único output nuevo hacia el
Organismo es `branchReEnrollSelected = output<number>()`, emitido desde `reEnroll()` justo
donde el código actual llama `branchFacade.selectBranch(egresado.branchId)` — solo cuando
`branchId !== null` (guard ya existente, cubre `AC-E1`). `SecretariaExAlumnosComponent`
simplemente no escucha ese output (no tiene `BranchFacade` que llamar).

### ⚠️ Corrección tras chocar con el Architect Guard (hook automático, no negociable)

El diseño de "Organismo que inyecta su propia Facade de dominio" de arriba **es correcto
según `architecture.md`** y tiene precedente real (`servicios-especiales-content/drawers/`
inyecta `ServiciosEspecialesFacade` + `LayoutDrawerFacadeService`) — pero el hook
`pre-write-guard.js` bloquea con un regex ciego (`inject\s*\(\s*\w*Facade`) **cualquier**
`.component.ts` bajo `shared/` que inyecte algo cuyo nombre contenga `Facade`, sin
excepción para Organismos. Esto también atrapa a `LayoutDrawerFacadeService` (contiene
"Facade" en el nombre), así que ni siquiera abrir drawers está permitido inyectando el
servicio directo desde `shared/`. El precedente existente probablemente se escribió antes
de que este guard existiera — es fricción real entre regla-viva y regla-documentada, pero
el hook es innegociable en la sesión actual (no se puede editar `.claude/hooks/`).

**Contrato final, ajustado para pasar el guard (Dumb puro):**

```typescript
// shared/components/ex-alumnos-content/ex-alumnos-content.component.ts — SIN inject() de nada Facade
export class ExAlumnosContentComponent {
  readonly egresados = input.required<EgresadoTableRow[]>();
  readonly isLoading = input<boolean>(false);
  readonly basePath = input<string>('/app/secretaria');

  readonly reEnrollRequested = output<EgresadoTableRow>();   // Smart decide confirmar+navegar+abrir drawer
  readonly requestVerTasas = output<void>();
  readonly requestComentario = output<void>();

  // searchTerm/periodWindow/hasActiveSearch/filteredEgresados (derivado de `egresados()`,
  // no de una Facade), mobileShown/visibleCards/remainingCards/loadMoreCards, initials,
  // availableYears (derivado de `egresados()`), clearFilters, heroChips/heroKpis (derivados
  // de `egresados()`, YA NO de `facade.egresadosClaseB()`) — todo esto SÍ se mueve entero:
  // ninguno depende de un servicio/Facade, son cálculos puros sobre el input.
}
```

Cada Smart Component mantiene un `reEnroll()` propio (confirmar + navegar + abrir wizard +,
solo en admin, `branchFacade.selectBranch()`) que escucha `(reEnrollRequested)` — sigue
siendo ~20-30 líneas casi idénticas entre los dos archivos, pero es la porción de lógica
que **legítimamente** pertenece a un Smart Component (orquesta `Router`/`ConfirmModalService`/
`LayoutDrawerFacadeService`/`BranchFacade`), no al Dumb. La parte que SÍ era el dolor real
señalado por la asignación — "agregar el selector de período hay que hacer el cambio dos
veces" — es exactamente la que se unifica al 100% (búsqueda, período, tabla, paginación).

---

## 4. Modelo de datos

N/A — sin cambios de esquema, RLS ni DTOs. Se reutiliza `EgresadoTableRow`
(`core/models/ui/egresado-table.model.ts`), ya expuesto por la Facade.

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
AdminExAlumnosComponent (Smart)                SecretariaExAlumnosComponent (Smart)
  ├─ inject(ExAlumnosFacade)                      ├─ inject(ExAlumnosFacade)
  ├─ inject(BranchFacade)                         │  (sin BranchFacade)
  ├─ effect(): selectedBranchId() → refresh        │
  ├─ inject(LayoutDrawerFacadeService)             ├─ inject(LayoutDrawerFacadeService)
  └─ <app-ex-alumnos-content                       └─ <app-ex-alumnos-content
        [egresados]="facade.egresadosClaseBList()"       [egresados]="facade.egresadosClaseBList()"
        [isLoading]="facade.isLoading()"                 [isLoading]="facade.isLoading()"
        [basePath]="'/app/admin'"                        [basePath]="'/app/secretaria'"
        (rowBranchSelected)="branchFacade.selectBranch($event)"
        (requestVerTasas)="openTasasDrawer($event)"      (requestVerTasas)="openTasasDrawer($event)"
        (requestComentario)="openComentariosDrawer($event)" (requestComentario)="openComentariosDrawer($event)"
      />

app-ex-alumnos-content (Dumb/Organismo, shared/components/)
  ├─ input: egresados, isLoading, basePath
  ├─ output: rowBranchSelected, requestVerTasas, requestComentario
  ├─ <app-period-selector> (absorbido de 0038-b)
  ├─ computed: filtrado por búsqueda + período (mismo orden que hoy: período primero,
  │            búsqueda ignora el período — ver ASG-b-087)
  └─ tabla + KPIs + paginación mobile (mobileShown/CARDS_STEP, igual que hoy)
```

### Capas tocadas

- **Smart**: `features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts`,
  `features/secretaria/ex-alumnos/secretaria-ex-alumnos.component.ts`
- **Organismo (Dumb con drawers propios de dominio)**: `shared/components/ex-alumnos-content/`
- **Facade**: `core/facades/ex-alumnos.facade.ts` (sin cambios)
- **Migration**: N/A

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Organismo (no Dumb puro): puede tener sus propios drawers de
  dominio, pero NO inyecta `BranchFacade` (transversal) — ver decisión de diseño arriba.
- [x] `facades.md` — Branch-scoped: `ExAlumnosFacade` ya cumple (inyecta `BranchFacade`,
  filtra en `loadEgresados()`); el `effect()` de reactividad se queda en el Smart Component.
- [ ] `models.md` — sin modelos nuevos, se reutiliza `EgresadoTableRow`.
- [x] `visual-system.md` — sin cambios visuales; si se evalúa app-like es oportunidad, no
  requisito (ver spec.md §4 Out of scope).
- [ ] `swr-pattern.md` — sin cambios al patrón SWR de la Facade.
- [ ] `notifications.md` — sin toasts/notificaciones nuevas.
- [x] `testing-tdd.md` — `app-ex-alumnos-content` tiene `computed()` de filtrado → `.spec.ts`
  obligatorio. Drawers movidos conservan su spec existente (comentarios) / no tenían (tasas,
  sin lógica derivada propia más allá de mostrar datos de la Facade).
- [ ] `ai-readability.md` — los `data-llm-*` existentes en los templates originales se
  preservan al mover/extraer, sin agregar nuevos (fuera de scope).

---

## 7. Plan de testing

- **Unitarios (obligatorio):** `.spec.ts` de `app-ex-alumnos-content` cubre: filtrado por
  búsqueda, filtrado por período, orden período-antes-que-búsqueda (AC6), paginación mobile
  (`mobileShown`/`CARDS_STEP`).
- **Movidos:** `admin-ex-alumnos-comentarios-drawer.component.spec.ts` se traslada y debe
  seguir pasando sin cambios de lógica (solo import paths).
- **QA manual (`/verify`):** AC1-AC6 y AC-E1/AC-E2 de `spec.md`, en ambas rutas
  (`/app/admin/ex-alumnos`, `/app/secretaria/ex-alumnos`), con foco en:
  - Los 2 drawers abren y muestran datos reales desde ambos portales.
  - Cambio de sede (solo admin) sigue refiltrando la lista.
  - `routerLink` de cada fila apunta al portal correcto.
  - Auditoría de imports: ningún archivo importa un drawer por ruta relativa cruzada entre
    portales (AC-E2).

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Backtick dentro de un comentario del `template` literal al mover el HTML (ya pasó una vez en `secretaria-ex-alumnos` durante `0038-b`, según nota de la propia asignación) | Media | Revisar cada comentario movido antes de guardar; si nombra una clase/selector, escribirlo sin comillas invertidas (gotcha documentado en `visual-system.md`) |
| Perder el guard `if (egresado.branchId !== null)` antes de `selectBranch()` al extraer la lógica al output | Baja | Cubierto explícitamente por AC-E1; el guard se queda en el Smart Component (dueño de `BranchFacade`), no en el Dumb |
| Que el `*-content` termine inyectando `BranchFacade` "para simplificar" y viole `architecture.md` | Media | Decisión de diseño ya fijada en este plan (sección 3): el filtrado ya lo hace la Facade, el Dumb solo emite `rowBranchSelected` |
| Carpeta `features/admin/alumnos/ex-alumnos/components/` queda con archivos huérfanos si se olvida borrar algo | Baja | Checklist explícito en "Archivos a ELIMINAR" arriba |

---

## 9. Orden de implementación

1. Crear `app-ex-alumnos-content` con su `.spec.ts` (TDD: tests primero, cubriendo
   filtrado + período + paginación mobile), absorbiendo el HTML/lógica ya existente en
   `admin-ex-alumnos.component.ts` (es la copia con `BranchFacade`, así que hay que quitarle
   esa parte al extraer, no al de secretaría).
2. Mover los 2 drawers (+ sub-componente `ex-alumnos-stats`) a
   `shared/components/ex-alumnos-content/drawers/`, actualizando imports.
3. Reducir `AdminExAlumnosComponent` a Smart puro, cableando `app-ex-alumnos-content` +
   `BranchFacade` + drawers.
4. Reducir `SecretariaExAlumnosComponent` a Smart puro (mismo cableado, sin `BranchFacade`).
5. Borrar los archivos originales de drawers en `features/admin/.../components/`.
6. `npm run lint:arch` + `npm run test:ci` + `/verify` en ambas rutas.
7. Actualizar `indices/COMPONENTS.md`.

---

## 10. Estimación

M (1-2 días) — es una extracción mecánica de código ya escrito, no lógica nueva, pero toca
2 Smart Components + 3 archivos de drawer + 1 componente nuevo con tests.

---

## Changelog

- 2026-08-31 — plan generado vía /spec-plan
