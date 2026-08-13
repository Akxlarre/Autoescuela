# Fix: Mis Horas (instructor) — sin skeleton en la carga inicial, deja fondo vacío
> id: fix-141-b-liquidacion-sin-skeleton-carga
> refs: fix-139-b-app-like-portal-instructor-resto
> status: done
> closed: 2026-08-11
> created: 2026-08-11

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
Encontrado en QA manual post-cierre de fix-139-b (reportado por el owner: "se ve horrible,
¿por qué tienen ese fondo?"). El template de `InstructorLiquidacionComponent` solo tiene 2
ramas: `@if (facade.error())` y `@else if (facade.monthlyTarget(); as target)`. Durante la
carga inicial (`facade.isLoading() === true` y `facade.monthlyTarget() === null`, antes de
que resuelva `fetchMonthlyTarget()`), NINGUNA de las 2 condiciones es verdadera → la fila
`.bento-fill` del grid (`minmax(0,1fr)`, ahora forzada a alto completo por
`--fill-screen` desde fix-139-b) no renderiza contenido, solo el `bg-base` del `.bento-grid`
de fondo — se ve como un rectángulo gris vacío grande. Antes de fix-139-b el hueco existía
igual pero era menos visible (la fila no estaba forzada a alto completo). Gap de skeleton
pre-existente, agravado por el fill-screen — mismo patrón de causa raíz que fix-074-b
(H-007, skeleton gap en Agenda/Libro de Clases), pero acá el gap es "sin skeleton en
absoluto" en vez de "doble loading-flag".

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
Ninguno — fix autónomo (gap de estado de carga, no cambia contrato de negocio).

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `src/app/features/instructor/liquidacion/instructor-liquidacion.component.ts`
  — **Qué cambia:** agregar rama `@else` final (loading) con skeleton dentro de
    `bento-banner bento-fill flex flex-col h-full` — mismo layout que la rama de datos real
    (chart card `shrink-0` + tabla card `flex-1`) usando `<app-skeleton-block>`, para que la
    fila `.bento-fill` nunca quede vacía mientras carga.

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- Verificación manual en navegador: recarga fría de `/app/instructor/liquidacion` →
  durante la carga se ve un skeleton fiel al layout real (no un rectángulo vacío), luego
  transiciona a los datos reales sin salto de layout (CLS).
- Sin lógica de decisión nueva (solo template) → sin `.spec.ts` obligatorio nuevo.
