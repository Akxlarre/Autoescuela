# Fix: Mejorar visualmente el flujo de "editar" una cuadratura (ajustes)
> id: fix-018-i-mejorar-visual-editar-cuadratura
> refs: —
> status: open
> created: 2026-08-06

## Root Cause
No es un bug funcional — es trabajo pendiente explícito. La spec `0002-i-cuadratura-editable-ajustes`
(mecanismo de ajustes sobre cuadraturas cerradas: `RegistrarAjusteCuadraturaDrawerComponent`,
sección "Ajustes" en `app-detalle-cuadratura-modal`, toggle de signo "Resta/Suma") se cerró el
2026-08-06 con toda la lógica implementada y testeada (47 tests verdes), pero **sin QA visual en
navegador real** — el owner decidió cerrar la spec y pidió retomar la mejora visual como fix
aparte, sin apuro (próxima sesión).

## ACs Afectados
Ninguno nuevo — este fix retoma acceptance criteria ya definidos en
`specs/specs/0002-i-cuadratura-editable-ajustes/spec.md` (AC1, AC4, AC5, AC6, AC7 tienen
componente visual) más mejoras estéticas que surjan de la revisión en vivo.

## Alcance (punto de partida — ajustar tras la primera revisión visual)
1. **QA visual heredado de 0002-i** (ver `tasks.md` de esa spec, T5.3, sin ejecutar):
   - Golden path: registrar ajuste "Gasto olvidado" con vehículo → aparece en el modal Y en
     Contabilidad > Gastos con la fecha del cierre corregido.
   - AC-E1: ajuste sobre el día de HOY (sin cerrar) rechazado.
   - AC-E2: dos ajustes seguidos sobre el mismo cierre se suman, no se pisan.
   - AC7: Secretaria no ve el botón "Registrar ajuste".
   - Modo oscuro/claro del drawer y de la sección de ajustes en el modal.
2. **Mejora visual del flujo de edición** (a definir en vivo, con capturas):
   - Revisar jerarquía visual del drawer `RegistrarAjusteCuadraturaDrawerComponent` (toggle
     "Resta/Suma", preview de signo, campos condicionales de "Gasto olvidado").
   - Revisar la sección "Ajustes" dentro de `app-detalle-cuadratura-modal` (lista de ajustes,
     cifra "Vigente" junto al Cierre Total) — ¿se lee bien de un vistazo? ¿jerarquía correcta
     entre el arqueo original (inmutable) y el total vigente (con ajustes)?
   - Cualquier otro hallazgo de la sesión de QA en vivo.

## Test de Regresión
- Los 47 tests automatizados de 0002-i (Facade + drawer) ya están verdes — no deberían
  romperse por cambios puramente visuales; correr `npm run test:ci` igual antes de cerrar.
- `/verify` (Playwright MCP) como validación principal de este fix — es visual, no lógico.

## Referencias
- `specs/specs/0002-i-cuadratura-editable-ajustes/` (spec, plan, tasks, acceptance — el gap
  vive documentado ahí)
- `specs/hotfixes/hotfix-001-i-egresos-cuadratura-chip-categoria/` y
  `specs/hotfixes/hotfix-002-i-fondo-inicial-hardcodeado/` — mejoras visuales previas en la
  misma área (Cuadratura), mismo día

## Archivos involucrados
- `src/app/features/admin/contabilidad-cuadratura/registrar-ajuste-cuadratura-drawer.component.ts`
- `src/app/shared/components/detalle-cuadratura-modal/detalle-cuadratura-modal.component.ts`
