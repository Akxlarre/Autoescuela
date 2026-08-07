# Hotfix: Typo `.p-stepper-panels` (nunca coincide con `p-steppanels`) + contención dura del ancho del stepper
> id: hotfix-057-m-steppanel-content-typo-overflow
> refs: continúa hotfix-056-m (el fix de esa iteración apuntaba a un selector con typo, cero efecto verificado en navegador real)
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Problema
El paso 2 del wizard de matrícula sigue desbordándose horizontalmente sin cambios tras
hotfix-056-m. Al revisar `node_modules/primeng/fesm2022/primeng-stepper.mjs:80`
(`StepPanelsClasses.root`), la clase real que PrimeNG pone en `<p-step-panels>` es
`p-steppanels` (sin guion entre "step" y "panels") — el override en
`_primeng-overrides.scss` decía `.p-stepper-panels` (con un guion de más), un typo
preexistente que **nunca coincidió con nada en el DOM real**. El fix de hotfix-056-m editó
ese selector muerto, por eso no tuvo ningún efecto visible pese a los rebuilds.

## Cambios
- **Archivo:** `src/styles/vendors/_primeng-overrides.scss` — corregir el selector
  `.p-stepper-panels` → `.p-steppanels` (nombre real verificado contra el código fuente de
  PrimeNG) y agregar `overflow-x: hidden; max-width: 100%` ahí.
- Agregar `max-width: 100%; overflow-x: hidden` también a `.p-steppanel-content-wrapper` y
  `.p-steppanel-content` (clases reales confirmadas: `StepPanelClasses.contentWrapper` /
  `.content`) como contención dura adicional, independiente de si el stretch del flex chain
  se comporta como se espera — así el ancho queda cortado ahí sin depender de mecánica flex
  más arriba en la cadena.
