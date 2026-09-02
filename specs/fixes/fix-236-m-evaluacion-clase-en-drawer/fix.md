# Fix: "Evaluar clase" navega a página completa en vez de abrir un Drawer

> id: fix-236-m-evaluacion-clase-en-drawer
> status: done
> closed: 2026-09-02
> created: 2026-09-02
> refs: ASG-i-003 (specs/assignments/ASG-i-003-evaluar-clase-drawer-en-vez-de-navegar.md)

## Root Cause

[Heredado de ASG-i-003, a confirmar]: Detectado por el dueño durante QA visual de ASG-b-084
(App-like piloto de tabs en `/instructor/alumnos/:id/ficha`). Hoy, al hacer clic en "Evaluar"
sobre una clase práctica completada, el botón es un
`<a [routerLink]="['/app/instructor/alumnos', studentId, 'evaluacion', sessionId]">` — navega a
una página completa distinta (`InstructorEvaluacionComponent`), perdiendo el contexto de la
ficha (scroll, tab activo). El dueño quiere que la evaluación se abra **siempre en un Drawer
lateral** (patrón `LayoutDrawerFacadeService`, igual que "Registrar Venta" en Servicios
Especiales), venga desde donde venga.

### Auditoría de puntos de entrada a la ruta `/instructor/alumnos/:id/evaluacion/:sessionId`

Búsqueda exhaustiva (`.ts`, `.html`, funciones Edge, migraciones SQL, `NotificationsFacade`).
**Solo dos callers**, ambos internos:

1. `src/app/features/instructor/ficha/instructor-ficha.component.ts` — ~4 `routerLink`
   (Evaluar / Ver detalles, en vista desktop tabla y vista mobile card).
2. `src/app/features/instructor/horario/instructor-horario.component.ts:265` —
   `router.navigate([`/app/instructor/alumnos/${block.studentId}/evaluacion/${block.sessionId}`])`.

No hay deep-links, notificaciones, emails ni nada en BD que arme esa URL. La "pregunta abierta"
de la ASG queda respondida: **no hay entradas externas**. Al convertir ambos callers a drawer,
la ruta queda sin uso y se elimina.

`InstructorEvaluacionComponent` ya es razonablemente autónomo: inyecta `InstructorClasesFacade`,
soporta `readonlyMode()`, checklist (`EvaluationChecklistComponent`), firma
(`SignaturePadComponent`). Su única atadura a la ruta es leer `:sessionId` (e `:id`) de
`ActivatedRoute`.

## ACs Afectados

Ninguno — fix autónomo de navegación/UX reportado por el dueño. ACs de regresión propios:

- AC-1: Desde `/instructor/alumnos/:id/ficha`, "Evaluar" sobre una clase completada abre la
  evaluación en el Drawer lateral (`LayoutDrawerFacadeService`) **sin navegar** — la ficha
  permanece montada detrás (scroll y tab activo intactos al cerrar el drawer).
- AC-2: "Ver detalles" / "Ver" sobre una clase ya evaluada abre el mismo Drawer en modo lectura
  (`readonlyMode`), sin navegar.
- AC-3: Desde `/instructor/horario`, la acción de evaluar/ver una clase abre el mismo Drawer,
  sin navegar.
- AC-4: Guardar la evaluación desde el Drawer persiste igual que hoy y refresca el estado de la
  ficha/horario (la fila pasa a "Evaluada"); cerrar sin guardar no muta nada.
- AC-5: En viewport mobile (<768px) el Drawer se abre en fullscreen (comportamiento ya provisto
  por `layout-drawer.component.ts`) — mismo camino, sin ruta dedicada.
- AC-6: La ruta `:id/evaluacion/:sessionId` se elimina de `app.routes.ts` y no queda ningún
  `routerLink`/`navigate` apuntando a ella.

## Cambio

**Decisión (wrap vs extraer):** se **envolvió el componente tal cual**. `InstructorEvaluacionComponent`
ya derivaba todo su estado de `InstructorClasesFacade.selectedClass()`; su única atadura a la ruta
era leer `:sessionId`/`:id` de `ActivatedRoute` y navegar en `goBack()`. Extraer un `*-content`
no aportaba nada.

- **`core/facades/instructor-clases.facade.ts`** (punto de entrada único):
  - `openEvaluacionDrawer(sessionId)` → `await loadClassDetail(sessionId)` + `import()` diná­mico
    del componente + `layoutDrawer.open(InstructorEvaluacionComponent, 'Evaluación Práctica',
    'clipboard-pen')`. Inyecta `LayoutDrawerFacadeService`.
  - `evaluationSavedTick` (signal readonly) — se incrementa al final de `saveEvaluation()` con
    éxito. Reemplaza el refresh que antes daba la re-navegación de vuelta a la ficha.
- **`features/instructor/evaluacion/instructor-evaluacion.component.ts`**: fuera `ActivatedRoute`,
  `Router`, `OnInit`, `ngOnInit`, `studentId`. `goBack()` → `drawer.close()`. Template: fuera
  breadcrumb + `<h1>` (el header lo pone el host del drawer); grid `lg:grid-cols-3` → `flex-col`
  (el drawer es angosto); padding de página → `pb-6`.
- **`features/instructor/ficha/instructor-ficha.component.ts`**: 4 `<a [routerLink]>` (Evaluar/Ver,
  desktop tabla + mobile card) → `<button (click)="clasesFacade.openEvaluacionDrawer(row.sessionId)">`.
  Fuera `RouterLink`. `effect()` sobre `evaluationSavedTick` → `loadStudentDetail()` silencioso.
- **`features/instructor/horario/instructor-horario.component.ts`**: rama `completed` de
  `onBlockClick()` → `clasesFacade.openEvaluacionDrawer(block.sessionId)` (antes `router.navigate`).
  `effect()` sobre `evaluationSavedTick` → `fetchWeeklySchedule()`.
- **`app.routes.ts`**: eliminada la entrada `:id/evaluacion/:sessionId` (sin callers).
- **Tests:** `instructor-clases.facade.spec.ts` — 3 casos nuevos (`evaluationSavedTick` sube al
  guardar / no sube si falla; `openEvaluacionDrawer` carga detalle + abre drawer).
- **Índices:** `COMPONENTS.md`, `APP-LIKE-ROLLOUT.md`, `FACADES.md` actualizados (ruta→drawer).

## Test de Regresión

- Unit: la lógica de apertura del drawer (resolución de `sessionId` + `readonly` según estado
  de la clase) como función pura testeable si se extrae; spec del componente cubriendo que
  `data` del drawer reemplaza a `ActivatedRoute`.
- `/verify` (Playwright): sesión instructor → ficha de alumno → "Evaluar" abre drawer, la ficha
  sigue detrás; guardar refresca la fila; repetir desde `/instructor/horario`; 768px de alto y
  ancho mobile.
