# Fix: Headers de card con `bg-subtle` no canónico en Mis Horas / Ensayos Teóricos
> id: fix-142-b-header-card-bg-subtle-no-canon
> refs: fix-139-b-app-like-portal-instructor-resto
> status: done
> closed: 2026-08-12
> created: 2026-08-12

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
Encontrado en QA manual del owner. Los headers de card ("Registro Diario (Mes Actual)" en
`InstructorLiquidacionComponent`, "Historial de Puntajes" en
`InstructorEnsayosTeoricosComponent`) usan `bg-subtle` — un fondo gris que los separa
visualmente del cuerpo de la tabla. El owner lo señaló como "no canon dentro de mi app".

Verificado por grep: el patrón `bg-subtle` en un header de card `.card.p-0` solo aparece en
estos 2 archivos (pre-existente, no introducido por fix-139-b). El canon real — confirmado
contra el sibling directo en el mismo portal, `instructor-dashboard.component.ts`
("Mis Clases de Hoy", `px-6 py-4 border-b border-border-default`, SIN clase de fondo) y
`vehicle-maintenances.component.ts` (mismo patrón sin fondo) — es que el header hereda el
fondo blanco/surface de la card, sin relleno adicional. `admin-instructores`/
`secretaria-instructores` usan `bg-surface` (más claro) pero para un TOOLBAR de filtros, no
un título simple — tampoco es el patrón a replicar acá.

**Precisión de alcance:** el `bg-subtle` del `<tr class="micro-label ... bg-subtle">` (fila
de encabezado DENTRO de la tabla) SÍ es canon — aparece igual en `alumnos-list-content`,
`flota-list-content`, `ex-alumnos-profesional-content` y 6+ archivos más. Ese NO se toca.
Solo se corrige el `bg-subtle` del div contenedor del título (`<h3>Registro Diario...</h3>`
/ `<h3>Historial de Puntajes</h3>`), que es el elemento sin precedente real.

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
Ninguno — fix autónomo (ajuste visual, no cambia contrato de negocio).

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `src/app/features/instructor/liquidacion/instructor-liquidacion.component.ts`
  — **Qué cambia:** quitar `bg-subtle` del header "Registro Diario (Mes Actual)" (real y
  skeleton), header queda sin fondo (hereda el de la card).
- **Archivo:** `src/app/features/instructor/ensayos-teoricos/instructor-ensayos-teoricos.component.ts`
  — **Qué cambia:** quitar `bg-subtle` del header "Historial de Puntajes".

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- Verificación visual en navegador: ambos headers sin fondo gris, consistentes con
  `instructor-dashboard.component.ts`.
- Sin lógica nueva → sin `.spec.ts` obligatorio.
