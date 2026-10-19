# Fix: El certificado Profesional solo se emite con la promoción terminada
> id: fix-467-m-certificado-profesional-promocion-finalizada
> refs: fix-447-m-testing-documentos-certificacion · fix-466-m · fix-332-m
> status: in_progress
> created: 2026-10-19

## Root Cause

En Clase B el certificado exige las clases completas (la secretaria no puede saltárselo). En
Profesional el equivalente es que la promoción haya terminado, pero solo lo aplicaba la lista
Certificados Prof. (muestra promociones `finished` o que terminan hoy). La edge function
`generate-certificate-professional-pdf` no revisa la promoción, y desde fix-466-m la ficha del
alumno (compartida por admin y secretaria) muestra "Generar Certificado" sin condición: se podía
emitir el certificado de un alumno con la promoción en curso.

Una promoción pasa a `finished` recién el día siguiente a su `end_date` (cron
`auto_transition_promotion_status`, 06:00 UTC, `end_date < chile_today()`). Por eso la regla se basa
en la fecha y no en el estado: **se puede emitir desde el último día de la promoción**
(`end_date ≤ hoy en Chile`), sin depender de que el cron haya corrido.

Decisión de Matías (2026-10-19): vale para admin y secretaria, desde cualquier lugar. Nunca antes
de la finalización.

## ACs Afectados

- AC propio — `generate-certificate-professional-pdf` rechaza (400, `PROMOCION_EN_CURSO`) si la
  promoción de la matrícula termina después de hoy en Chile, para cualquier rol. El último día sí
  se emite.
- AC propio — Ficha del alumno Profesional (admin y secretaria): con la promoción en curso, el botón
  aparece deshabilitado e indica desde qué día se puede generar. Desde el último día, habilitado.
- AC propio — La lista Certificados Prof. no cambia (ya solo muestra promociones terminadas o en su
  último día).

## Cambio

- `supabase/functions/_shared/promotion-certificate.ts` (nuevo, puro) + test Deno: regla y mensaje.
- `generate-certificate-professional-pdf/index.ts`: aplica la regla tras cargar la matrícula.
- `core/utils/professional-certificate.utils.ts` (nuevo, puro) + spec: misma regla en la app.
- `AdminAlumnoDetalleFacade`: `EnrollmentSummary.promotionEndDate` (join a la promoción).
- `admin-alumno-detalle.component.ts`: botón del certificado Profesional según la regla.
- **Requiere desplegar `generate-certificate-professional-pdf`.**

## Test de Regresión

- `supabase/functions/_shared/promotion-certificate.test.ts` — antes, el último día y después.
- `professional-certificate.utils.spec.ts` — misma tabla en la app.

## Progreso

- [x] Tests rojos → verdes: `promotion-certificate.test.ts` (Deno) 4/4,
  `professional-certificate.utils.spec.ts` 4/4.
- [x] `npm run lint:arch` 0 errores (186 advertencias, sin cambio); `npm run test:ci` 4413 verdes.
  `deno check` de la edge function: los mismos 6 errores de tipos preexistentes.
- [x] `/verify` como admin: ficha de un alumno de la promoción 279 (termina 2026-10-26) →
  "Certificado (desde 26-10-2026)" deshabilitado; ficha de la promoción 277 (terminada) →
  "Generar Certificado" habilitado. Consola sin errores.
- [ ] Despliegue de `generate-certificate-professional-pdf`
