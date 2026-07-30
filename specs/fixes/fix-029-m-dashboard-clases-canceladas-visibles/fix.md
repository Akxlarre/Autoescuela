# fix-029-m — Dashboard: clases canceladas aparecen como "Concluida" en Clases Actuales

## Contexto

El dueño reportó que las clases de Erling del 09-07 (canceladas — ver
fix-028) siguen apareciendo en el panel "Clases Actuales" del dashboard
admin/secretaria, mostradas como si hubieran concluido.

## Hallazgo

`DashboardFacade.fetchLiveClasses()` (`src/app/core/facades/dashboard.facade.ts`)
consulta `class_b_sessions` del día sin excluir `status = 'cancelled'`, y en
el mapeo (líneas ~358-361) trata `cancelled` igual que `completed`/`no_show`,
asignándole el status UI `'completed'`. El panel las renderiza con la
etiqueta "Finalizada" en vez de omitirlas.

## Alcance

1. Excluir las sesiones `cancelled` de la query `fetchLiveClasses()` (mismo
   patrón `.neq('status', 'cancelled')` usado en `asistencia-clase-b.facade.ts`).
2. Verificar que el panel no muestre clases canceladas del día.

## Acceptance Criteria

- [x] AC0: `fetchLiveClasses()` no incluye sesiones con `status = 'cancelled'`
  en el resultado. (`.neq('status', 'cancelled')` agregado a la query;
  rama muerta `row.status === 'cancelled'` removida del mapeo.)
- [x] AC1: El panel "Clases Actuales" del dashboard no muestra las clases
  canceladas de Erling (09-07) ni ninguna otra sesión cancelada del día.
  (Consecuencia directa de AC0 — el panel solo renderiza lo que devuelve
  `fetchLiveClasses()`.)

## Cierre

Fix aplicado en `src/app/core/facades/dashboard.facade.ts`. Test de
regresión verde.

## Test de regresión

`src/app/core/facades/dashboard.facade.spec.ts` — describe `fetchLiveClasses`,
verifica que la query llama `.neq('status', 'cancelled')` y que ninguna fila
del resultado tiene status `cancelled`. 4/4 tests pasando.
