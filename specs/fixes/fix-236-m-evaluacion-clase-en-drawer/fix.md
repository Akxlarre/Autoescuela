# Fix: "Evaluar clase" navega a página completa en vez de abrir un Drawer

> id: fix-236-m-evaluacion-clase-en-drawer
> status: in_progress
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

_(Detalle fino — incl. wrap del componente actual vs extraer el form a un `*-content`
compartido — se decide en el plan. Esbozo:)_

- **`instructor-evaluacion.component.ts`**: aceptar `sessionId` (+ `studentId`, `readonly`) por
  los `data` del `LayoutDrawerFacadeService` / `input()` en vez de `ActivatedRoute`. Quitar
  breadcrumb / `<h1>` de página si estorban dentro del drawer.
- **`instructor-ficha.component.ts`**: `routerLink` → `(click)="abrirEvaluacion(session)"` que
  llama `layoutDrawer.open(...)` (desktop tabla + mobile card, Evaluar + Ver).
- **`instructor-horario.component.ts`**: reemplazar `router.navigate(['.../evaluacion/...'])`
  por la misma apertura de drawer.
- **`app.routes.ts`**: eliminar la entrada `:id/evaluacion/:sessionId`.
- Índices: actualizar `COMPONENTS.md` / `USAGE-MAP.md` si el componente cambia de rol
  (ruta → drawer).

## Test de Regresión

- Unit: la lógica de apertura del drawer (resolución de `sessionId` + `readonly` según estado
  de la clase) como función pura testeable si se extrae; spec del componente cubriendo que
  `data` del drawer reemplaza a `ActivatedRoute`.
- `/verify` (Playwright): sesión instructor → ficha de alumno → "Evaluar" abre drawer, la ficha
  sigue detrás; guardar refresca la fila; repetir desde `/instructor/horario`; 768px de alto y
  ancho mobile.
