# Fix: Facade inyectado directamente en Dumb Components (`shared/components/**`)

> id: fix-146-b-facade-en-dumb-components
> refs: ASG-b-089
> status: in_progress
> created: 2026-08-15

## Root Cause

[Heredado de ASG-b-089, a confirmar]: Hallazgo H1 de la auditoría fresca del DS
(`indices/DS-AUDIT-2026-08-03.md`). Regla violada: `.claude/rules/architecture.md`
§Smart vs Dumb — "Dumb (`shared/`): Solo `input()` y `output()`. Sin inyección de
Facades." La auditoría encontró 9 inyecciones de Facade repartidas en 7 Dumb Components.

No hay síntoma visible para el usuario final — es deuda arquitectónica real, no un bug.
El costo es de mantenibilidad: un Dumb que inyecta su propio Facade no se puede reutilizar
fuera del contexto que ese Facade asume, ni testear sin levantar la cadena de inyección
completa.

### Alcance de ESTE track: los 4 casos mecánicos

De los 7 componentes del hallazgo, este fix cubre solo los 4 que tienen un camino técnico
claro (invertir el flujo a `input()`/`output()` desde el Smart padre):

| Archivo | Facade(s) inyectada(s) |
|---|---|
| `shared/components/logo/logo.component.ts:29-30` | `AuthFacade` + `BranchFacade` |
| `shared/components/alumnos-por-vencer-drawer/alumnos-por-vencer-drawer.component.ts:77` | `AdminAlumnosFacade` |
| `shared/components/detalle-cuadratura-modal/detalle-cuadratura-modal.component.ts:278` | `HistorialCuadraturasFacade` |
| `shared/components/pago-instructor-modal/pago-instructor-modal.component.ts:207` | `LiquidacionesFacade` |

### Fuera de alcance (decisión de equipo pendiente, NO técnica)

Los 3 restantes quedan sin tocar **a propósito**, no por olvido. La propia ASG-b-089 dice
"no asumir, esto define el alcance real": definir si estos heredan el estatus de "organismo
semi-Smart" de los `*-content` (precedente documentado en `.claude/rules/facades.md` §7) es
una decisión de arquitectura del equipo, no del dev que reclama.

- `shared/components/ajustes-drawer/ajustes-drawer.component.ts:382-383` (`AuthFacade` + `BranchFacade`)
- `shared/components/servicios-especiales-content/drawers/agregar-servicio-drawer.component.ts:85`
- `shared/components/servicios-especiales-content/drawers/registrar-venta-drawer.component.ts:162`

→ **Acción pendiente:** abrir una ASG nueva para esa decisión una vez cerrado este track.

## ACs Afectados

Ninguno — refactor arquitectónico, no cambia contrato de negocio ni UX observable.

## Cambio

Pendiente de completar tras el paso DESCUBRIR (leer `indices/COMPONENTS.md`,
`indices/FACADES.md`, `indices/USAGE-MAP.md` para mapear todos los Smart padres de cada
uno de los 4 componentes antes de tocarlos).

Patrón esperado por componente: el Smart padre inyecta el Facade y pasa la data ya
resuelta vía `input()`; el Dumb emite `output()` y el padre ejecuta la mutación.

## Test de Regresión

Pendiente. Validación planificada (toda headless — este track se eligió justamente porque
no requiere QA visual):

- `npx tsc --noEmit`
- `npm run test:ci`
- `npm run lint:arch`
- Los `.spec.ts` de los 4 Dumb tocados probablemente necesiten reescritura: pasar de Facade
  inyectado a `input()` cambia cómo se monta el componente en el test.

> ⚠️ Sin `/verify` en navegador: la sesión corre en entorno remoto sin acceso visual del
> usuario. Si al implementar aparece un cambio con riesgo visual real, detenerse y avisar
> en vez de dar por buena la validación headless.

## Referencias

- `indices/DS-AUDIT-2026-08-03.md` §H1 (hallazgo completo con snippets)
- `.claude/rules/architecture.md` §Smart vs Dumb Components
- `.claude/rules/facades.md` §7 (precedente `*-content` semi-Smart, para los 3 diferidos)
- Originado de Asignación ASG-b-089 (`specs/assignments/ASG-b-089-facade-en-dumb-components.md`)
