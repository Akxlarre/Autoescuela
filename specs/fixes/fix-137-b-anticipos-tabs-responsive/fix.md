# Fix: contabilidad/anticipos — tabs (patrón dms-list-content) + cards mobile + @container

> id: fix-137-b-anticipos-tabs-responsive
> refs: —
> status: done
> created: 2026-08-11
> closed: 2026-08-11

## Root Cause

QA visual del usuario sobre `/admin/contabilidad/anticipos` (post fix-133-b) encontró 2
problemas:

1. **Merece tabs, como `asistencia`.** Hoy "Cuenta Corriente por Instructor" e "Historial de
   Anticipos" son 2 filas `--fill-screen-2` siempre visibles simultáneamente (decisión
   original de fix-133-b, cuando el plan de la Asignación no contemplaba tabs). Encontré el
   patrón correcto ya construido y en uso: `dms-list-content.component.ts` usa
   `<app-tabs variant="segmented">` como fila propia (`--fill-screen-kpi`: hero=auto,
   tabs=auto, panel=fill) + `@switch(activeTab())` renderizando el contenido en **una sola
   celda `.bento-fill`**. Es el componente canónico moderno (`shared/components/tabs/`,
   compresión adaptativa por `ResizeObserver`), más recomendable que el tabs hand-rolled de
   `asistencia-clase-b-content` (que predata `app-tabs`).
2. **Sin ningún tratamiento responsive.** A diferencia de `cursos` (que al menos tenía un
   switch roto por `lg:`), `anticipos` no tiene NINGUNA vista mobile — ambas tablas son
   `<table>` HTML crudo con solo `overflow-x-auto`. En mobile y con el drawer abierto, el
   usuario solo puede hacer scroll horizontal.

## ACs Afectados

Ninguno — fix autónomo de UI/UX, no cambia contrato de negocio.

## Cambio

**Archivo:** `src/app/features/admin/contabilidad-anticipos/admin-contabilidad-anticipos.component.ts`

1. Importa `TabsComponent`/`TabOption` (`@shared/components/tabs/tabs.component`).
2. Root: `--fill-screen-2` → `--fill-screen-kpi` (hero=auto, tabs=auto, panel=fill).
3. Nueva fila `<app-tabs class="bento-banner" variant="segmented" [tabs]="tabOptions()"
   [activeId]="activeTab()" (activeIdChange)="activeTab.set($event)" />` entre el hero y el
   panel. 2 tabs: "Cuenta Corriente" (icon `wallet`) e "Historial" (icon `history`, `count`
   = `facade.historial().length` — reemplaza el texto "N registros" que tenía el header viejo).
4. Panel único `.bento-banner.bento-fill` con `@switch(activeTab())`:
   - `'cuenta-corriente'`: header + vista desktop (tabla actual sin cambios de columnas) +
     vista mobile nueva (cards: nombre+tipo+badge estado, grid anticipos totales/saldo
     pendiente, footer con último anticipo + acciones).
   - `'historial'`: header + vista desktop (tabla actual) + vista mobile nueva (cards:
     instructor+fecha+badge estado, motivo, monto) + nota informativa (footer, sin cambios).
   - Dual-viewport (`@container`, `hide-on-squeeze`/`show-on-squeeze`) en ambos casos, mismo
     patrón que `cursos`/`vehicle-maintenances`. Como los 2 casos nunca se muestran a la vez
     (son tabs, no filas apiladas), comparten un solo `dual-viewport-container` en el panel.
5. `activeTab` nuevo `signal<'cuenta-corriente' | 'historial'>('cuenta-corriente')`.

**Ampliación de alcance (pedido explícito del usuario tras revisar los botones de la card
"Cuenta Corriente"):** los 2 botones de acción por fila no hacían lo que aparentaban —
1. **"Ver historial de este instructor"** no tenía ningún `(click)`, botón muerto. Se
   elimina (sin destino claro — no existe hoy una vista de detalle por instructor a la que
   navegar; queda fuera de scope diseñarla).
2. **"Registrar anticipo"** (✓, solo visible si `estado === 'pendiente'`) sí abría el drawer,
   pero `RegistrarAnticipoDrawerComponent` trae su propio selector de instructor **en
   blanco** — perdía el contexto de la fila clickeada. Se agrega `selectedInstructorId` a
   `AnticiposFacade` (mismo patrón que `FlotaDetalleFacade.selectMaintenance()`):
   `onRegistrarAnticipo(instructorId?: number)` llama `facade.selectInstructor(instructorId ??
   null)` antes de abrir el drawer; `RegistrarAnticipoDrawerComponent` inicializa su control
   `instructorId` desde `facade.selectedInstructorId()` (preseleccionado si viene de una fila,
   vacío si viene del botón del hero).

Archivos adicionales tocados por esta ampliación: `src/app/core/facades/anticipos.facade.ts`,
`src/app/features/admin/contabilidad-anticipos/registrar-anticipo-drawer.component.ts`.

**Hallazgo adicional (dentro del mismo archivo, mismo criterio que fix-136-b):** los 4 botones
de acción "Ver historial"/"Registrar anticipo" (2 preexistentes en la tabla desktop, 2 nuevos
en las cards mobile) usaban `btn-ghost p-1.5 rounded-lg` — `.btn-ghost` ya trae su propio
`padding`/`border-radius` (`var(--btn-primary-padding-*)`, `var(--btn-ghost-radius)`), así que
esos overrides ad-hoc disparaban ARCH-16 (ratchet de tamaños sobre `btn-*`, cuota base 2 →
4 con mi duplicado). Corregido a `btn-ghost w-8 h-8` — patrón ya usado en
`drawer.component.ts` para botones ghost cuadrados icon-only.

## Test de Regresión

- Sin `.spec.ts` nuevo — sin `computed()`/lógica de negocio nueva (el signal `activeTab` no
  toma decisiones, solo alterna qué template se muestra; las cards son solo template).
- `npx tsc --noEmit`: sin errores.
- `npm run lint:arch`: exit 0, 0 warnings en el archivo (incluye el fix de ARCH-16 arriba).
- `npm run test:ci`: suite completa verde.
- `/verify` manual en navegador (`ng serve --port 4210`):
  - **Tabs:** cambiar entre "Cuenta Corriente" y "Historial" (con `count`=1 en el badge del
    tab) funciona, cada uno renderiza su tabla/nota correctamente.
  - **Root `--fill-screen-kpi`:** confirmado con `getComputedStyle` — panel real 464px de
    alto, sin scroll de página, a 1440×900.
  - **`@container` (900px):** confirmado resizeando el viewport a 900px — `desktopDisplay:
    'none'`, `mobileDisplay: 'block'`, cards con todos los datos correctos (Cuenta Corriente:
    nombre, tipo, badge estado, anticipos totales, saldo pendiente, último anticipo, acciones;
    Historial: instructor, fecha, badge estado, motivo, monto).
  - **Color de separadores:** `divide-x divide-border-muted` en las cards mobile confirmado
    con `getComputedStyle` → `rgba(9, 9, 11, 0.06)` (correcto).
  - **Limitación de esta sesión (superada):** la corrida anterior no pudo verificar la
    apertura visual del drawer por un problema puntual del `ng serve` de esa sesión. En una
    corrida posterior con el servidor sano, se verificó en navegador real (login SPA
    `admin@test.com`, navegación por click real sobre el `<a href="/app/admin/contabilidad/anticipos">`
    del sidebar para preservar la sesión de Supabase en memoria — un `navigate()` de página
    completa la pierde):
    - **"Ver historial de este instructor" eliminado:** `document.querySelectorAll('button[aria-label="Ver historial de este instructor"]').length === 0` tras la carga de la página.
    - **"Registrar anticipo" precarga el instructor de la fila:** click real (vía dispatch de
      evento) sobre el botón de la fila "Gran Instructor Torres" (única con saldo pendiente)
      abrió el drawer con el combobox de instructor ya mostrando **"Gran Instructor Torres"**
      preseleccionado — confirma `AnticiposFacade.selectInstructor()` +
      `RegistrarAnticipoDrawerComponent` leyendo `facade.selectedInstructorId()` en la
      inicialización del form.
  - **`npm run test:ci` (corrida completa final):** 157 archivos / 1984 tests, **0 fallos**
    (los 2 timeouts esporádicos de corridas anteriores en archivos no relacionados —
    `cuadratura-content.component.spec.ts`, `ciclos-teoricos.facade.spec.ts` — no se
    repitieron; confirma que eran flakiness de entorno, no regresiones).
