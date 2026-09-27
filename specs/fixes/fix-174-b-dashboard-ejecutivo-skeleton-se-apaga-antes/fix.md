# Fix: El skeleton del dashboard ejecutivo se apaga antes de que llegue la carga vigente
> id: fix-174-b-dashboard-ejecutivo-skeleton-se-apaga-antes
> refs: 0044-b-dashboard-ejecutivo-admin
> status: done
> closed: 2026-09-27
> created: 2026-09-27

## Root Cause
En `ExecutiveDashboardFacade`, `initialize()` y `reload()` (rama sin datos) hacen
`_isLoading.set(true)` → `await fetchAll()` → `finally { _isLoading.set(false) }` por cada llamada.
Si el usuario cambia período o sede antes de que termine la primera carga, arranca una segunda;
cuando la primera termina (y el request guard descarta su resultado), su `finally` apaga el
loading aunque la segunda siga en vuelo. Los paneles pasan a mostrar su estado vacío ("$0", tabla
de instructores vacía) hasta que llega la segunda respuesta.

## ACs Afectados
- AC23 (0044-b): el skeleton de la primera carga se mantiene hasta que llegan los datos vigentes.

## Cambio
- **Archivo:** `src/app/core/facades/executive-dashboard.facade.ts`
- **Qué cambia:** las cargas con skeleton pasan por un helper que solo apaga `_isLoading` si ninguna
  carga posterior se disparó mientras tanto (contador de la carga vigente).

## Test de Regresión
- `src/app/core/facades/executive-dashboard.facade.spec.ts > fix-174-b: una carga vieja no apaga el skeleton de la vigente` ✓
