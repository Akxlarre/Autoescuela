# Fix: Fecha de obtención de licencia B + advertencia de los 2 años (Profesional)
> id: fix-089-m-licencia-b-dos-anos-profesional
> refs: ASG-b-041
> status: done
> closed: 2026-07-29
> created: 2026-07-29

## Root Cause
[Heredado de ASG-b-041, a confirmar]: requisito legal para matricular en Clase
Profesional — el alumno debe tener al menos 2 años de licencia clase B. El wizard de
matrícula Profesional no pide la fecha de obtención de la licencia B ni advierte cuando
no se cumplen los 2 años. La columna `students.license_obtained_date` (DATE, nullable)
ya existe en el modelo (ver `indices/DATABASE.md`), junto con `current_license_class` —
no hace falta migración, falta pedir el dato en el wizard y usarlo.

El cliente fue explícito: **advertir, no bloquear** — la secretaría debe poder
matricular igual bajo su criterio.

Decisión ya confirmada con el owner (2026-07-28): los 2 años se cuentan **hasta la
fecha de inicio del curso**, no hasta la fecha de matrícula.

## ACs Afectados
Ninguno — fix autónomo derivado de Asignación de equipo, ver
`specs/assignments/ASG-b-041-licencia-b-dos-anos-profesional.md`.

## Alcance sugerido (de la Asignación)
- Campo de fecha (`<p-datepicker>`, no input nativo) en el wizard de matrícula
  Profesional, persistido en `students.license_obtained_date`.
- Cálculo de antigüedad contra la fecha de inicio del curso (no la fecha de matrícula).
- Advertencia clara y no bloqueante si no llega a los 2 años: debe decir cuánto le
  falta, no un genérico "no cumple requisitos".
- Dejar registro de quién matriculó a pesar de la advertencia (sugerido, no obligatorio
  — ver Notas).

## Cambio
- **`src/app/core/utils/license-seniority.utils.ts`** (nuevo): `calcLicenseSeniority(licenseDate, courseStartDate)` — función pura que compara la fecha de licencia B contra la fecha de inicio del curso y devuelve `LicenseValidation { valid, message, seniorityYears }`. `valid: false` es una advertencia, no un bloqueo.
- **`src/app/shared/components/matricula-steps/personal-data/`** (Step 1): agrega el bloque "Licencia previa" (`p-select`, opciones B/A2/A3/A4/A5) + `<app-date-input>` "Fecha de obtención licencia B", visible solo cuando `courseCategory === 'professional'`. Liga los campos ya existentes en el modelo (`currentLicense`/`licenseDate`) que no se estaban renderizando. La persistencia en `students.current_license_class`/`license_obtained_date` ya existía en `upsertStudent()` — no requirió cambios.
- **`src/app/core/models/ui/enrollment-assignment.model.ts`**: agrega `PromotionOption.startDate` (fecha de inicio de la promoción) y `EnrollmentAssignmentData.licenseObtainedDate`.
- **`src/app/core/facades/enrollment.facade.ts`** (`loadPromotions()`): agrega `start_date` al `select` de `professional_promotions` y lo mapea a `PromotionOption.startDate`.
- **`src/app/shared/components/matricula-steps/assignment/`** (Step 2, donde se elige la promoción → se conoce la fecha de inicio real): agrega `findSelectedPromotion()` y `licenseWarningFn()` (funciones puras exportadas, testeables sin TestBed) + el computed `licenseWarning`. El HTML muestra un banner de advertencia no bloqueante (mismo patrón visual que las alertas de edad de personal-data) cuando la licencia no llega a los 2 años a la fecha de inicio de la promoción elegida.
- Se propagó el nuevo campo `licenseObtainedDate` a los otros 2 puntos que construyen `EnrollmentAssignmentData` (`public-enrollment.component.ts` y `admin-reagendar-horarios-drawer.component.ts`, ambos flujos Clase B — se les pasa `null`, sin efecto).
- **`calcLicenseSeniority()` ampliado** (post-feedback del usuario): el segundo parámetro pasó a llamarse `referenceDate` (antes `courseStartDate`) y el mensaje ahora nombra explícitamente la fecha de referencia usada (ej. "...contados al 10 ago 2026"), para no ambigüar según dónde se muestre.
- **`personal-data.component.ts`/`.html`** (Step 1, agregado tras feedback del usuario): se agregó `earlyLicenseWarningFn()` + el computed `earlyLicenseWarning`, que muestra un banner de advertencia **temprana** (estimada contra la fecha de HOY, apenas se ingresa la fecha de licencia) aclarando que es referencial y se recalculará en Step 2 contra la fecha real de inicio de la promoción. El chequeo definitivo contra la fecha de inicio del curso (decisión del owner) se mantiene sin cambios en Step 2 — esto es solo feedback más temprano, no un cambio de criterio.
- **Fix visual (bug encontrado por el usuario probando el `ng serve`):** el `p-select` de "Licencia previa" no tenía `name`, lo que disparaba `NG01352` (ngModel sin name dentro de un `<form>`) y cortaba el render a medias (por eso hacía falta un segundo click en la card "Profesional" para que aparecieran los dos campos). Se agregó `name="currentLicense"`. También se quitó un `border-t border-border-subtle` de más que dejaba una línea divisora duplicada entre los campos de arriba y el bloque de licencia.
- **Fix de redacción/precisión (bug encontrado por el usuario):** `calcLicenseSeniority()` redondeaba siempre a meses (`Math.ceil(dias/30)`), así que 3 días faltantes se mostraban como "1 mes" — y además el verbo "faltan" no concordaba en singular ("faltan 1 mes"). Ahora el mensaje muestra **días** si faltan menos de 30, o meses si faltan 30 o más, y el verbo concuerda ("falta 1 día" / "faltan 3 días" / "faltan 2 meses").

## Verificación
- `npm run test:ci`: 1546 passed, 0 failed (incluye los 3 `.spec.ts` nuevos, con 2 casos de regresión agregados para el bug de redondeo/concordancia).
- `npm run lint:arch`: 0 errores (advertencias preexistentes al fix, sin cambios).
- `npx ng build`: compila sin errores.
- No se ejecutó `/verify` (Playwright, no disponible en esta sesión) — el usuario probó manualmente en su `ng serve` y reportó los 2 bugs ya corregidos arriba. Pendiente una segunda pasada visual del usuario para confirmar que quedaron resueltos.

## Test de Regresión
- `src/app/core/utils/license-seniority.utils.spec.ts` — 10 casos: sin fecha de licencia, sin fecha de referencia, exactamente 2 años, más de 2 años, faltan meses (con mensaje), **faltan pocos días (no se infla a "1 mes")**, **concordancia singular/plural del verbo**, mismo día, fechas inválidas, mensaje nombra la fecha de referencia.
- `src/app/shared/components/matricula-steps/assignment/assignment.component.spec.ts` — 7 casos: `findSelectedPromotion()` (3) + `licenseWarningFn()` (4: vista no profesional, sin promoción seleccionada, advertencia activa, sin advertencia).
- `src/app/shared/components/matricula-steps/personal-data/personal-data.component.spec.ts` — 6 casos: `earlyLicenseWarningFn()` (categoría no profesional, categoría null, sin fecha de licencia, advertencia activa, sin advertencia, mensaje nombra la fecha de hoy).

## Notas
- ⚠️ Coordinar con **ASG-b-035** (spec `0002-m-promociones-cadencia-automatica`, activa)
  — ambas tocan el wizard de matrícula Profesional. Como las reclamé yo mismo, no hay
  riesgo de choque entre personas, pero sí de pisarme el propio trabajo en curso: revisar
  el estado de esa spec antes de tocar el wizard.
- La advertencia es un mensaje de negocio con consecuencia legal: redactar el texto
  exacto, no improvisarlo.
- Archivos involucrados sugeridos: wizard de matrícula Profesional,
  `src/app/core/facades/enrollment.facade.ts`.
