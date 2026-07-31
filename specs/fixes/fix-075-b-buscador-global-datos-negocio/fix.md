# Fix: H-031 — buscador global (Ctrl+K) no indexa alumnos ni instructores
> id: fix-075-b-buscador-global-datos-negocio
> refs: ASG-b-024
> status: done
> closed: 2026-07-31
> created: 2026-07-31

## Root Cause

**Confirmado, 3 causas independientes dentro del mismo track absorbido de ASG-b-024:**

1. **Sin datos de negocio (bug original H-031):** `GlobalSearchFacade.alumnoResults` ya leía
   `AdminAlumnosFacade.alumnos()`, pero nada disparaba jamás `AdminAlumnosFacade.initialize()`
   desde el buscador — el signal quedaba en `[]` salvo que el usuario ya hubiera visitado
   "Base Alumnos B" en la misma sesión. De ahí "Sin resultados" para un alumno real y visible.
   Tampoco existía indexación de instructores en absoluto.
2. **Sin scope por rol/sede (ampliación cliente 2026-07-28):** al corregir (1) ingenuamente
   (llamar `AdminAlumnosFacade.initialize()` para cualquier rol), un instructor habría visto
   **todos** los alumnos de su sede vía `resolveBranchScope()` (que trata a cualquier no-admin
   como "anclado a su branchId", no a sus propios alumnos) — exactamente la fuga que el cliente
   pidió evitar: *"un instructor podría buscar cosas que no le corresponden"*.
3. **Bug de arranque, confirmado con Playwright real (no solo lectura de código):** el
   `<input autofocus>` del panel nunca recibía el foco al abrir con Ctrl+K.
   `document.activeElement` quedaba en `<main>` y las primeras teclas se perdían. Causa: el
   panel se inserta vía `@if (search.isOpen())` tras un signal write — la re-renderización de
   Angular ocurre en un microtask fuera de la pila de llamadas síncrona del evento de teclado
   que originó el Ctrl+K, y Chromium exige activación transitoria vigente para que el atributo
   HTML `autofocus` tome efecto en una inserción dinámica. Verificado clic manual + tipeo sí
   funcionaba (foco correcto), confirmando que el problema era puramente de foco, no de lógica.

⚠️ Solapa con ASG-b-049 (número de matrícula como dato principal): si el número de matrícula pasa
a ser el identificador operativo del alumno, el buscador debe encontrarlo también por ese número
(fuera de este track — pendiente para cuando ASG-b-049 se resuelva).

## Archivos involucrados

- `src/app/core/facades/global-search.facade.ts` — orquestación, scope por rol, carga SWR.
- `src/app/core/facades/global-search.facade.spec.ts` — cobertura nueva.
- `src/app/core/models/ui/global-search.model.ts` — tipo `InstructorResult` nuevo.
- `src/app/shared/components/search-panel/search-panel.component.ts` — render de instructores
  + fix de foco.
- `src/app/core/services/ui/search-panel.service.ts` — **investigado, sin cambios**: solo
  gestiona el signal `isOpen`/`anchor`, no participaba del bug de foco.

## ACs Afectados
Ninguno — fix autónomo, sin AC de spec previa. Referencia: `indices/FLOWS-QA-AUDIT.md`, hallazgo H-031.

## Cambio

- **`GlobalSearchFacade`**: `setQuery()` dispara (una sola vez por apertura del panel, no en
  cada keystroke) la carga SWR de datos de negocio según el rol activo:
  admin/secretaria → `AdminAlumnosFacade.loadAlumnos()` + `InstructoresFacade.initialize()`;
  instructor → `InstructorAlumnosFacade.initialize()` (ya scopeado por `instructor_id`, nunca
  toca `AdminAlumnosFacade`); alumno/desconocido → nada.
- `alumnoResults` y el nuevo `instructorResults` (computed) filtran por rol usando las Facades
  ya scopeadas existentes (`resolveBranchScope` para admin/secretaria, `instructor_id` para
  instructor) — sin queries nuevas, sin duplicar lógica de sede.
- `buildAlumnoQuickActions()` ahora acepta un `role` opcional: para `instructor` devuelve solo
  "Ver Ficha" (las otras 3 rutas —`/pagos`, `/agenda`, `/matricula`— no existen bajo
  `/app/instructor/*`); el resto de roles mantiene las 4 acciones originales (sin cambio de
  comportamiento, tests preexistentes intactos).
- `SearchResult` gana la variante `InstructorResult`; el template de `search-panel.component.ts`
  renderiza un nuevo grupo "Instructores encontrados" (icono `user-check`), fila simple sin
  acciones rápidas — no existe ruta de detalle de instructor todavía, navega al listado.
- `search-panel.component.ts`: se reemplazó el atributo HTML `autofocus` por un `viewChild` +
  `afterNextRender(() => input.focus())` explícito, inmune a la ventana de activación transitoria.

## Test de Regresión

- `global-search.facade.spec.ts`: 51 tests (25 nuevos) — cubren scope por rol para
  `alumnoResults`/`instructorResults`, `buildAlumnoQuickActions` con `role='instructor'`, y el
  disparo/no-re-disparo de `loadBusinessData()` (una vez por apertura, se resetea en `reset()`).
  `npx vitest run src/app/core/facades/global-search.facade.spec.ts` → **51/51 verde**.
- `npm run lint:arch` → exit 0, 0 errores (165 warnings preexistentes, ninguno en archivos
  tocados).
- `ng build` → build exitoso (solo warning preexistente de bundle budget, no relacionado).
- **Verificación real end-to-end con Playwright** (`ng serve` local, no solo lectura de código),
  las 3 causas confirmadas y corregidas en vivo:
  - Admin: Ctrl+K → tipeo inmediato de "gonza"/"an" cae correctamente en el input
    (`document.activeElement` = `.search-panel__input`, antes quedaba en `<main>`). Búsqueda de
    "juan" devuelve "Juan Carlos González Soto" en ambos grupos "Alumnos encontrados" e
    "Instructores encontrados" (coincidencia real del seed).
  - Instructor: mismo fix de foco confirmado; búsqueda de "an" devuelve solo su propio alumno
    ("Juan Carlos González") con **una única** acción "Ver Ficha", sin grupo de instructores.
  - Alumno: búsqueda de "juan" → "Sin resultados" (sin acceso a datos de otros alumnos ni
    instructores, tal como pide el scope por rol).
- `npm run test:ci` (suite completa) → **1641/1644 passed, 3 skipped (pre-existentes, no
  relacionados), 0 failed, exit 0.** Sin regresiones fuera del scope directo.
