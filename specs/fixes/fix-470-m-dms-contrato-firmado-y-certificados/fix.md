# Fix: El DMS muestra el contrato firmado y los certificados de cada matrícula
> id: fix-470-m-dms-contrato-firmado-y-certificados
> refs: fix-447-m-testing-documentos-certificacion (S24)
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Root Cause

`v_dms_student_documents` arma los documentos de la matrícula desde `student_documents`,
`digital_contracts.file_url` y los carnets (`enrollments.license_initial_url` / `license_full_url`).
Le faltan dos orígenes:

- **Contrato firmado de una matrícula online.** En la presencial, `file_url` ya es el escaneo
  firmado (wizard, paso 5). En la online, `file_url` es el contrato generado sin firma y el escaneo
  se sube después desde la ficha a `digital_contracts.signed_contract_url`
  (20260501000002), que la vista nunca leyó: el DMS mostraba solo el contrato sin firmar.
- **Certificados.** `enrollments.certificate_b_pdf_url` / `certificate_professional_pdf_url` no
  aparecen en el DMS: para ver el certificado emitido había que ir a Certificación.

(El checklist decía que faltaba también el carnet: la vista viva ya lo incluye.)

## ACs Afectados

- AC propio — Una matrícula con `signed_contract_url` distinto de `file_url` muestra dos filas:
  "Contrato" y "Contrato firmado". Si son iguales (presencial), una sola.
- AC propio — Una matrícula con certificado generado muestra "Certificado Clase B" o
  "Certificado Profesional", fechado con la emisión.
- AC propio — Esas filas nuevas no se pueden eliminar desde el DMS (se gestionan en la ficha y en
  Certificación); el resto sigue igual.

## Cambio

- Migración `20261020140000_fix470_dms_contrato_firmado_y_certificados.sql`: recrea la vista con
  las dos fuentes nuevas (`source = 'enrollment_file'`), `security_invoker` igual que antes.
  **La aplica Matías.**
- `core/models/ui/dms.model.ts`: `source` suma `'enrollment_file'`.
- `core/utils/dms-documents.utils.ts` (nuevo, puro) + spec: `isDeletableStudentDoc(source)`.
- `DmsFacade`: etiquetas nuevas; `deleteStudentDocument` rechaza las filas sintéticas con un
  mensaje genérico.
- `dms-list-content` y `dms-student-docs-drawer`: el botón Eliminar usa `isDeletableStudentDoc`.

## Test de Regresión

- `dms-documents.utils.spec.ts` — qué orígenes se pueden borrar.
- `dms.facade.spec.ts` — `deleteStudentDocument` con `enrollment_file` no toca la BD.
- SQL contra la BD de dev tras aplicar: la matrícula 90 (firmado = generado) tiene una fila de
  contrato; una matrícula con certificado lo muestra.

## Progreso

- [x] Tests rojos → verdes
- [x] Migración ensayada con `BEGIN … ROLLBACK`
- [x] Migración aplicada (Matías, 2026-10-20) y verificada: la vista devuelve 5 filas `certificado_b`; E2E C05/C06 verde
- [x] `/verify` del DMS
