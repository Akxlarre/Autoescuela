# Fix: CTAs de secretaria abren drawer sin contexto de tipo ni destinatario
> id: fix-005-b-ctas-secretaria-drawer-sin-contexto
> refs: 0001-sistema-de-tareas-multi-rol
> status: done
> closed: 2026-05-21
> created: 2026-05-21

## Root Cause
`SecretariaObservacionesComponent.onHeroAction(id)` ignora el parámetro `id` — ambos CTAs
("Nueva observación" y "Tarea a instructor") llaman exactamente a:
  `this.drawer.open(TaskCreateDrawerComponent, 'Nueva tarea', 'clipboard-list')`
Sin pasar el tipo correcto ni el título adecuado. El drawer no soporta `ngComponentOutletInputs`,
por lo que se requiere un servicio de contexto como puente de estado.

## ACs Afectados
- Ninguno — bug de implementación no cubierto en la spec original

## Cambios
- **`src/app/core/services/ui/task-create-context.service.ts`** (nuevo)
  → Singleton con `signal<TaskType>('task')` que actúa de puente entre la página y el drawer
- **`src/app/features/secretaria/observaciones/secretaria-observaciones.component.ts`**
  → `onHeroAction`: inyecta el contexto, setea el tipo correcto y pasa el título apropiado
- **`src/app/features/tareas/task-create-drawer.component.ts`**
  → Constructor: inyecta el contexto y parcha el form con el tipo inicial al abrir

## Test de Regresión
- Verificación manual: "Nueva observación" abre drawer con tipo=observation preseleccionado
  y título "Nueva observación". "Tarea a instructor" abre drawer con tipo=task preseleccionado
  y título "Tarea a instructor".
