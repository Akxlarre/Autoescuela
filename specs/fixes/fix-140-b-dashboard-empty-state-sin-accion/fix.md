# Fix: Dashboard instructor — CTA del empty state "Ver mi horario semanal" no navega
> id: fix-140-b-dashboard-empty-state-sin-accion
> refs: fix-139-b-app-like-portal-instructor-resto
> status: done
> closed: 2026-08-11
> created: 2026-08-11

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
Encontrado en QA manual post-cierre de fix-139-b (`/verify` en navegador real, reportado
por el owner). `InstructorDashboardComponent` pasa `actionLabel="Ver mi horario semanal"`
+ `actionIcon="calendar"` a `<app-empty-state>` (estado "No tienes clases hoy") pero nunca
enlaza el output `(action)` del componente — el botón se renderiza y emite `action.emit()`
al hacer click, pero nadie escucha, así que no pasa nada. Confirmado en navegador: click en
el botón, `window.location.href` no cambia.

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
Ninguno — fix autónomo (bug de binding, no cambia contrato de negocio).

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `src/app/features/instructor/dashboard/instructor-dashboard.component.ts`
  — **Qué cambia:** inyectar `Router`, agregar `(action)="goToHorario()"` al
    `<app-empty-state>` del estado "No tienes clases hoy", método `goToHorario()` navega a
    `/app/instructor/horario` (misma ruta que la hero action "Ver Horario" ya existente).

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- Verificación manual en navegador: logueado como `instructor@test.com`, sin clases hoy,
  click en "Ver mi horario semanal" → navega a `/app/instructor/horario`.
- Sin lógica de decisión nueva (solo navegación) → sin `.spec.ts` obligatorio nuevo.
