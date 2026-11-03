# Fix: Un menor de 17 en Clase B no tiene dónde subir la autorización notarial
> id: fix-070-i-autorizacion-notarial-menor-clase-b
> refs: fix-058-i-testing-matricula-presencial (B2-2)
> status: done
> closed: 2026-11-03
> created: 2026-11-03

## Root Cause

En el paso 3 (Documentos) del wizard de la secretaria, `step3Data.requiredDocuments` es
`getRequirements('professional', isMinor)` en Profesional y **`[]` fijo en Clase B**. El requisito
`autorizacion_notarial` (`MINOR_DOCUMENT` de `EnrollmentDocumentsFacade`, obligatorio para menores)
existe, pero en Clase B nunca llega al componente: no aparece la fila para subirla y
`allRequiredUploaded` deja avanzar sin ella. Solo se ve el aviso "Se requiere Autorización
Notarial… Súbela en la sección de documentos del expediente", que apunta a una sección que no está.

## Decisión (Ignacio, 2026-11-03)

La autorización es **obligatoria para avanzar** (opción A): sin ella la secretaria no pasa del
paso 3; el borrador queda guardado y se retoma cuando el apoderado la traiga. Se descartó dejar
avanzar con aviso (riesgo de un menor matriculado sin el documento).

## ACs Afectados

Ninguno de una spec — bug de testing (`fix-058-i` B2-2, caso S11). Criterios de este fix:

- **AC-F1:** con un alumno menor de 18 en Clase B, el paso 3 muestra "Autorización Notarial
  (Obligatoria)" con su botón para subirla, y no deja avanzar hasta que esté subida.
- **AC-F2:** un adulto en Clase B ve el paso 3 igual que antes (solo la foto).
- **AC-F3:** el aviso de menor de edad indica dónde subirla (esta misma pantalla).
- **AC-F4** (visto en el navegador): el texto junto a "Continuar" nombra lo que falta; con la foto
  subida y sin la autorización decía "Sube la foto carnet para continuar".

## Cambio

- `src/app/features/secretaria/matricula/secretaria-matricula.component.ts` (`step3Data`): los
  requisitos salen de `getRequirements(categoría, esMenor)` también en Clase B.
- `src/app/shared/components/matricula-steps/documents/documents.component.html`: texto del aviso.

## Test de Regresión

- `secretaria-matricula.component.spec.ts`: requisitos del paso 3 para menor y adulto en Clase B.

## Progreso

- [x] Test (rojo) + cambio (verde).
- [x] AC-F4: texto de ayuda del paso 3 (`missingDocumentHint` en `core/utils/documents-step.utils`,
      usado por `missingHint` de `documents.component`; 3 tests).
- [x] Suite completa, `tsc`, `lint:arch` y cierre. Sin índices que cambiar (no hay piezas nuevas).

## Verificación

- 2026-11-03: `secretaria-matricula.component.spec.ts` › fix-070-i — rojo antes del cambio (el
  menor recibía `[]`), verde después (menor → `[autorizacion_notarial]`, adulto → `[]`) (AC-F1,
  AC-F2). 32/32 en el archivo.
- Suite completa 302/304 archivos. Los 2 rojos no son de este fix: `reportes-contables.facade.spec`
  (fix-242-m) falla igual sin el cambio (git stash; depende de la fecha) y `promociones.facade.spec`
  pasa 32/32 corrido solo (inestable en la suite completa). `tsc` limpio, `lint:arch` 0 errores.
- "No deja avanzar sin la autorización" (AC-F1): lo decide `allRequiredUploaded` del paso 3, que ya
  exige todo `requiredDocuments` con `required: true` (la fila y el botón son los mismos que usa
  Profesional desde antes). **Navegador (2026-11-03, secretaria sede 1, alumno de prueba
  `QA Setenta Menor`, 17 años):** el paso 3 muestra "Autorización Notarial * (Obligatoria)" y el
  aviso nuevo; con la foto subida "Continuar" sigue deshabilitado y se habilita al subir la
  autorización ("LISTO") ✅ (AC-F1, AC-F3). Ahí se vio que el texto de ayuda seguía pidiendo la
  foto → AC-F4, cubierto por `documents-step.utils.spec`. Borrador descartado al terminar.
