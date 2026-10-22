# Fix: El certificado Profesional no menciona la licencia convalidada
> id: fix-483-m-certificado-profesional-con-convalidacion
> refs: fix-480-m-testing-certificacion-profesional (D1)
> status: done
> closed: 2026-10-22
> created: 2026-10-22

## Root Cause

`generate-certificate-professional-pdf` arma el nombre del curso solo con la clase de la matrícula
("Licencia Profesional Clase A5"). Un alumno que convalida otra clase en simultáneo
(`license_validations.convalidated_license`, p. ej. A5 + A3) recibe un certificado que no lo dice.

## Decisión (Matías, 2026-10-22, D1)

El certificado menciona la convalidación, y el texto se edita en Plantillas (Matías preguntó cómo
se editaría). Redacción inicial elegida en la sesión (Matías la dejó a criterio):
"Realizó el Curso de Licencia Profesional Clase A5 **con convalidación de Clase A3** en Nuestra
Escuela entre los días …".

- Campo nuevo de la plantilla `certificate_professional`: **"Convalidación (solo si el alumno
  convalida)"** (clave `convalidacion`, token `{{claseConvalidada}}`), texto inicial
  `con convalidación de Clase {{claseConvalidada}}`.
- Se agrega a `{{cursoLabel}}` solo cuando la matrícula convalida; vacío = no se menciona. El
  "Cuerpo" no cambia.

## ACs Afectados

- AC propio — matrícula con convalidación → "Licencia Profesional Clase A5 con convalidación de
  Clase A3".
- AC propio — sin convalidación, el texto no cambia.
- AC propio — el texto se edita en Plantillas; la vista previa (alumno ficticio A5 que convalida
  A3) lo muestra; si se deja vacío, el certificado no menciona la convalidación.

## Cambio

- `_shared/promotion-certificate.ts`: `DEFAULT_CONVALIDACION` y
  `professionalCourseLabel(clase, convalidada, textoPlantilla)` (pura, + test Deno); reemplaza
  `getCourseLabel` del index.
- `generate-certificate-professional-pdf/index.ts`: lee `license_validations` de la matrícula y el
  campo `convalidacion` de la plantilla (fallback al texto inicial); la vista previa usa un alumno
  ficticio A5 que convalida A3. **La despliega Matías.**
- `core/models/ui/document-content-template.model.ts`: el campo en el editor;
  `document-clause-tokens.util.ts`: descripción de `{{claseConvalidada}}`.
- Migración `20261022120000_fix483_plantilla_certificado_profesional_convalidacion.sql`: agrega el
  texto inicial a la plantilla guardada si falta la clave (sin ella el editor mostraría el campo
  vacío y al publicar se perdería). **La aplica Matías.**

## Test de regresión

- `_shared/promotion-certificate.test.ts` — sin convalidación, texto por defecto, texto editado,
  texto vacío, clase desconocida.

## Progreso

- [x] Tests Deno rojos → verdes (9/9); editor 49/49; `tsc` limpio
- [x] Edge function, editor y migración (ensayada con `BEGIN … ROLLBACK`: deja el texto inicial en la
  plantilla de la sede 2)
- [x] Navegador: el campo aparece en Plantillas → Conductores Chillán → Certificado Profesional
- [x] Migración aplicada y función desplegada por Matías (v27, 2026-10-22 19:04 UTC); la plantilla de
  la sede 2 tiene el texto inicial
- [x] PDF real regenerado: 0099 (8556) "Licencia Profesional Clase A5 con convalidación de Clase A3",
  folio 7 conservado; 0097 (8554, sin convalidación) sin cambios. Vista previa del editor: `sample`
  muestra el texto publicado y `preview` uno editado sin publicar ("y convalidación Clase A3")
