# Fix: Clases de hoy desaparecen del dashboard del instructor por límite de fecha en UTC + claridad visual de "En Curso"
> id: fix-176-m-dashboard-instructor-clases-activas-timezone
> refs: —
> status: done
> closed: 2026-08-13
> created: 2026-08-13

## Root Cause
`InstructorClasesFacade.fetchTodayClasses()` calcula el rango de "hoy" así:

```ts
const todayDate = new Date().toISOString().split('T')[0];
.gte('scheduled_at', `${todayDate}T00:00:00+00:00`)
.lt('scheduled_at', `${todayDate}T23:59:59+00:00`)
```

`toISOString()` da la fecha en **UTC**, no en hora de Chile (UTC-3/-4). Chile está
**detrás** de UTC, así que el reloj UTC cruza medianoche mientras en Chile todavía es
"hoy" — concretamente, desde las ~21:00 hora Chile en adelante (hasta que Chile mismo
llegue a su propia medianoche+offset), `todayDate` calcula la fecha UTC de **mañana**,
y la ventana de consulta `[mañana 00:00 UTC, mañana 23:59 UTC]` deja fuera las clases de
**hoy** (cuyo `scheduled_at` en UTC sigue siendo "hoy"). Resultado: pasadas las ~21:00,
"Mis Clases de Hoy" muestra 0 clases aunque haya una en curso recién iniciada — exactamente
el bug reportado ("Iniciada 19:58:49" y el dashboard mostrando "No tienes clases hoy" poco
después). Es la misma clase de bug ya resuelto para pagos vía `getChileDateTimeRange()`
(`core/utils/date.utils.ts`, usado en `cuadratura.facade.ts` — "prevents evening payments
being silently excluded").

Adicionalmente, el estado "En Curso" en la lista es visualmente sutil (solo un fondo
`bg-brand-muted` + tag de texto): no comunica con claridad que el instructor **debe**
volver a finalizar esa clase.

## ACs Afectados
Ninguno — fix autónomo.
- AC-1: "Mis Clases de Hoy" usa `getChileDateTimeRange()` para el filtro de fecha, sin
  perder clases del día por el cruce de medianoche UTC.
- AC-2: Una clase `in_progress` se distingue con claridad (texto + indicador visual) de
  que está activa y debe finalizarse.
- AC-3: Las clases `completed` del día siguen apareciendo en la lista (ya lo hacían — el
  query no filtraba por status; se preserva ese comportamiento con el nuevo rango).

## Cambio
- **Archivo:** `src/app/core/facades/instructor-clases.facade.ts`
  **Qué cambia:** `fetchTodayClasses()` usa `todayIso()` + `getChileDateTimeRange()` en vez
  de `new Date().toISOString()` para el rango de fecha.
- **Archivo:** `src/app/features/instructor/dashboard/instructor-dashboard.component.ts`
  **Qué cambia:** la fila de una clase `in_progress` agrega un indicador `.indicator-live`
  + texto explícito ("Clase en curso — recuerda finalizarla") en vez de depender solo del
  fondo tintado y el tag de estado.

## Test de Regresión
- `src/app/core/facades/instructor-clases.facade.spec.ts > fetchTodayClasses usa el rango horario de Chile (no UTC) para no perder clases nocturnas` ✓
