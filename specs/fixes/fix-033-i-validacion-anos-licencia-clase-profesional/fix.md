# Fix: Validación de años de licencia previa según clase profesional objetivo
> id: fix-033-i-validacion-anos-licencia-clase-profesional
> refs: ASG-m-001
> status: done
> closed: 2026-09-17
> created: 2026-09-17

## Root Cause
[Heredado de ASG-m-001, a confirmar]: en los flujos de matrícula profesional, la sección
donde se pide la licencia actual del alumno necesita más validaciones sobre la antigüedad de
esa licencia, según la clase profesional objetivo:

- A2, A4 y Conv. A4 → requieren **2 años** de licencia clase B.
- A5, A3 y Conv. A5 → requieren **2 años** de licencia A2 o A4.

**Confirmado al revisar el código (2026-09-17):** ya existe infraestructura de un fix
anterior (`fix-089-m`, `ASG-b-041`) que resuelve el caso B→Profesional genérico:
`calcLicenseSeniority(licenseDate, referenceDate)` (`core/utils/license-seniority.utils.ts`)
calcula antigüedad contra la fecha de inicio de la promoción y arma el mensaje de
advertencia (singular/plural, días vs. meses). `licenseWarningFn()`
(`matricula-steps/assignment/assignment.component.ts:34`) la invoca, pero **siempre**
compara contra "2 años" sin considerar la clase objetivo ni la licencia previa declarada
(`currentLicense`: B/A2/A3/A4/A5, ya capturado en Step 1) — no diferencia "necesito B" de
"necesito A2 o A4" según a qué clase se matricula. Ese es el hueco real que cierra este fix.

`hasRequiredProfessionalLicenseFn()` (`personal-data.component.ts:56`) ya exige
`currentLicense` y `licenseDate` no vacíos para poder avanzar del Paso 1 en Clase
Profesional — **la pregunta abierta de la Asignación sobre "fecha no registrada" queda
resuelta por esa regla preexistente**: no puede ocurrir en el flujo normal, no hace falta
diseñar un comportamiento nuevo para ese caso.

**Decisión confirmada con el usuario (2026-09-17):** advertencia no bloqueante,
consistente con el criterio ya usado en `fix-089-m` — la secretaría puede matricular igual
bajo su criterio.

## ACs Afectados
Ninguno — fix autónomo derivado de Asignación de equipo, ver
`specs/assignments/ASG-m-001-validacion-anos-licencia-matricula-profesional.md`.

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `src/app/core/utils/license-seniority.utils.ts` — agregar la tabla de
  reglas (clase objetivo → licencia previa requerida) y una función que, dado
  `targetLicenseClass` + `currentLicense`, determine contra qué licencia validar (o si la
  licencia previa declarada no corresponde a ninguna de las requeridas para esa clase).
- **Archivo:** `src/app/shared/components/matricula-steps/assignment/assignment.component.ts`
  (`licenseWarningFn`) — usar la nueva regla en vez de asumir siempre "licencia B, 2 años".
- Mantener el patrón existente: advertencia no bloqueante, mismo componente de banner,
  mismo cálculo de antigüedad (`calcLicenseSeniority`) — solo cambia qué combinación
  (licencia previa, clase objetivo) dispara la validación.

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- `license-seniority.utils.spec.ts`: casos nuevos para `requiredPriorLicenseLabel()`
  (A2/A4→"clase B", A5/A3→"A2 o A4", case-insensitive, default a "clase B" para valor
  desconocido/null) y `licenseClassFromCourseType()` (mapeo completo + cursos no
  profesionales → null). Más 2 casos nuevos en `calcLicenseSeniority()` confirmando que
  el nuevo parámetro `requiredLicenseLabel` se usa en el mensaje (con y sin pasarlo).
- `assignment.component.spec.ts` (`licenseWarningFn`): 5 casos nuevos — A2/A4 exigen
  "clase B" en el mensaje, A5/A3 exigen "A2 o A4" (y explícitamente NO contienen "clase
  B"), `licenseClass` desconocida cae a "clase B".
- `personal-data.component.spec.ts` (`earlyLicenseWarningFn`): 3 casos nuevos —
  comportamiento sin `courseType` (compatibilidad), A2/A4 → "clase B", A5/A3 → "A2 o A4".
- Regresión: los 9 casos preexistentes de `fix-089-m` en ambos specs siguen pasando sin
  cambios de comportamiento (siguen usando el default `'clase B'`, escenario A2 en
  `assignment.component.spec.ts`).

## Verificación
- `npx tsc --noEmit`: sin errores (confirma que `PromotionOption.licenseClass` nuevo no
  rompió ningún otro consumidor del modelo).
- `npm run test:ci`: **2475 passed, 0 failed** (5 skipped, preexistentes) — incluye los
  10 casos nuevos de este fix repartidos en 3 archivos `.spec.ts`.
- `npm run lint:arch`: 0 errores, 174 advertencias — todas preexistentes al fix, ninguna
  en los archivos tocados por este cambio.
- **QA visual real (Playwright, `ng serve`), login `secretaria2@test.com`, matrícula
  Profesional:** encontró y corrigió 2 textos estáticos que ningún test unitario podía
  atrapar (probaban solo la función `message`, no el template completo):
  - El título del banner de advertencia decía literalmente "Licencia clase B con menos de
    2 años..." **incluso cuando el mensaje de abajo ya decía correctamente "licencia A2 o
    A4"** — contradicción visible en pantalla. Corregido a "Licencia previa con menos de 2
    años de antigüedad" en ambos banners (`personal-data.component.html` y
    `assignment.component.html`) — el detalle de qué licencia exige ya lo dice el mensaje,
    no hace falta duplicarlo (ni arriesgarse a desincronizar) en el título.
  - La etiqueta del campo de fecha decía fijo "Fecha de obtención licencia B" aunque el
    dropdown de al lado ("Licencia previa") deja elegir B/A2/A3/A4/A5 — renombrado a
    "Fecha de obtención de la licencia previa" (genérico, coherente con el selector).
  - Verificado en vivo con curso objetivo A5 + licencia previa A2 (9 meses) → banner dice
    "...licencia A2 o A4 requeridos", y con A2 + licencia B → "...licencia clase B
    requeridos". Consola sin errores ni warnings. Re-corrido `npm run test:ci` después de
    estos 2 ajustes de copy: sigue 2475/2475.
