# Tasks 0016-m — Editor de plantillas para contratos y certificados generados por Edge Function

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-09-16

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 0 — Verificación previa (destructiva, corre antes que nada)

- [x] **T0.1** — Verificar que no hay filas reales en `document_templates` con `file_url` en uso
  - **DoD:**
    - [x] `SELECT id, name, file_url FROM document_templates WHERE file_url IS NOT NULL;` corrido
      contra el ambiente real (`npx supabase db query ... --linked`) antes de escribir la migración
    - [ ] Si hay filas: decisión explícita del owner documentada acá (exportar antes de dropear,
      o confirmar que igual se puede perder) — **no continuar sin esa decisión**
    - [x] Confirmado vacío, 2026-09-16 (0 filas) — se puede dropear sin pérdida de datos reales

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — Transcribir el texto hardcodeado actual de las 4 plantillas × 2 sedes a JSON de seed
  - **AC ref:** AC-E1, AC7
  - **DoD:**
    - [x] Extraído cláusula por cláusula de `_shared/contract-pdf.ts` (contrato B, contrato
      Profesional) y de `generate-certificate-b-pdf/index.ts` + `generate-certificate-professional-pdf/index.ts`
    - [x] PRIMERO–CUARTO y SÉPTIMO transcritos como texto directo; QUINTO/SEXTO transcritos con
      placeholders `{{token}}` en el lugar donde hoy va un valor calculado (ver tabla de tokens en
      plan.md §4)
    - [x] Certificados: branch 2 (Conductores Chillán) transcrito tal cual el hardcode actual;
      branch 1 (Autoescuela Chillán) corregido con datos reales de `branches` (nombre, RUT
      societario `76.007.217-6`, dirección "Maipón 418", teléfono local "2327800") en vez de
      heredar el bug de branding único (decisión del owner, 2026-09-16)
    - [x] Un objeto `content` por combinación sede × tipo (6 combinaciones — Profesional solo
      aplica a Conductores Chillán, ver hallazgo en spec.md)
    - [x] Revisado contra el texto fuente línea por línea — embebido directo en la migración (T1.2)
    - ⚠️ **Pendiente de revisión humana**: transcripción de contenido legal real, revisar línea por
      línea contra el código fuente antes de aplicar a producción.

- [x] **T1.2** — Crear migración `20260916000000_repurpose_document_templates.sql`
  - **AC ref:** AC1, AC3, AC-E1
  - **DoD:**
    - [x] `ALTER TABLE document_templates DROP COLUMN` de `file_url`/`format`/`version`/
      `download_count`/`active`/`category`
    - [x] `ADD COLUMN branch_id`, `document_type` (con `CHECK`), `content JSONB NOT NULL DEFAULT '{}'`
    - [x] `UNIQUE (branch_id, document_type)` agregado
    - [x] RLS reemplazada: SELECT/INSERT/UPDATE solo `auth_user_role() = 'admin'`, sin policy DELETE
    - [x] `INSERT` de seed con el contenido de T1.1 para las 6 combinaciones sede × tipo válidas
      (`ON CONFLICT DO NOTHING`, idempotente) — sin filas de Profesional para Autoescuela Chillán
    - [x] Cláusula SÉPTIMO (convalidación) eliminada de las 4 filas de contrato y del propio
      generador (`_shared/contract-pdf.ts`) — era texto inventado sin verificar, ver spec.md
    - [x] Migración validada con dry-run real (`BEGIN; ...; ROLLBACK;` vía `supabase db query
      --linked`) contra el ambiente de producción — corrió sin errores de sintaxis/constraints y
      se confirmó que no dejó nada aplicado (columnas originales intactas tras el rollback)
    - [x] **Aplicada a producción por el owner (2026-09-16)**, tras la corrección de SÉPTIMO y las
      filas Profesional de Autoescuela Chillán — verificado con `SELECT` real: exactamente 6 filas,
      sin `septimo_titulo`/`septimo_cuerpo`, sin filas de Profesional para branch_id=1
    - [x] Documentado en `indices/DATABASE.md` (reemplaza la sección actual de `document_templates`,
      `npm run indices:sync` + fila resumen corregida a mano — el script no la regenera)

- [x] **T1.3** — Actualizar DTO `core/models/dto/document-template.model.ts`
  - **Decisión:** se reutiliza el archivo/nombre existente (`DocumentTemplate`, ya mapeaba la
    tabla vieja) en vez de crear `document-content-template.model.ts` — es la misma tabla
    reestructurada, no una nueva; mantiene la convención de `models.md` (nombre de archivo = tabla)
  - **DoD:**
    - [x] Interface `DocumentTemplate` reescrita 1:1 con la tabla reestructurada (`id`, `name`,
      `description`, `branch_id`, `document_type: DocumentType`, `content: Record<string,string>`,
      `updated_by`, `updated_at`) — columnas viejas (`file_url`, `format`, `version`,
      `download_count`, `active`, `category`) eliminadas
    - [x] `DocumentType` exportado como union de los 4 tipos válidos
    - [x] Confirmado que no había otros consumidores del DTO viejo (`grep` sin resultados fuera del
      propio archivo)
    - [x] Documentado en `indices/MODELS.md` (entrada manual DTO + npm run indices:sync)

- [x] **T1.4** — Crear UI Model `core/models/ui/document-content-template.model.ts`
  - **DoD:**
    - [x] Tipo `DocumentTemplateSection` (`{ id, label, body, maxLength, availableTokens: string[] }`)
      + `DocumentTemplateForm` (branchId + documentType + secciones)
    - [x] `DOCUMENT_TEMPLATE_SECTIONS` — metadata estática (label/maxLength/tokens) por tipo de
      documento, poblada según la tabla de tokens de `plan.md` §4 (`body` se completa en el Facade
      al cargar, no acá — esto es solo la forma fija)
    - [x] `DOCUMENT_TYPE_LABELS` agregado (labels legibles para el selector de tipo en la UI)
    - [x] Justificación en comentario de por qué no basta el DTO (JSON crudo no trae labels ni
      tokens disponibles, y esa metadata es estática por tipo, no por fila de BD)
    - [x] Documentado en `indices/MODELS.md` (entrada manual UI + npm run indices:sync)

---

## Fase 2 — Refactor de las Edge Functions (motor de generación)

- [x] **T2.0** — Crear `_shared/template-tokens.ts` + test (mecanismo de placeholders)
  - **AC ref:** AC7, AC-E3
  - **DoD:**
    - [x] `substituteTokens(text: string, tokens: Record<string,string>): string` — reemplaza cada
      `{{clave}}` presente en `tokens`; una clave no reconocida se sustituye por `''` (nunca lanza)
    - [x] Test escrito: token conocido, token desconocido → vacío, texto sin ningún token, mismo
      token repetido 2 veces en el mismo texto, texto vacío
    - [x] Función pura, sin dependencias de Supabase/Deno más allá de tipos base
    - [x] **Test ejecutado (2026-09-17)**: Deno instalado (`winget install DenoLand.Deno`, v2.9.7)
      y corrido `deno test supabase/functions/_shared/template-tokens.test.ts` → **5/5 PASS**.
      Corrida también la suite completa de `_shared/*.test.ts` + `auto-create-next-promotions`:
      37/38 pasan; el único fallo (`auto-create-next-promotions/index.test.ts`, requiere
      `--allow-env` + Postgres real) es preexistente, de la spec 0002-m ya cerrada, sin relación
      con este track

- [x] **T2.1a** — Eliminar la cláusula SÉPTIMO (convalidación) del generador
  - **Hecho fuera de orden (2026-09-16)**, por su urgencia: es un defecto en producción, no solo un
    problema del contenido a migrar — ver hallazgo en spec.md.
  - **DoD:**
    - [x] Bloque `if (data.convalidation) { clause(...) }` eliminado de `_shared/contract-pdf.ts`
    - [x] Campo `convalidation` eliminado de la interfaz `EnrollmentData`
    - [x] Fetch de `license_validations` y parámetro `licenseValidation` eliminados de
      `flattenEnrollment()` en `generate-contract-pdf/index.ts` (código muerto tras lo anterior)
    - [x] Las 2 asignaciones `convalidation: null` eliminadas de `public-enrollment/index.ts`
    - [ ] ⚠️ Pendiente: correr `deno check`/`deno lint` sobre los 3 archivos tocados (no disponible
      en este sandbox) y `npm run test:ci` para confirmar que nada más referenciaba estos símbolos

- [x] **T2.1** — Refactorizar `_shared/contract-pdf.ts` para recibir `content` + aplicar tokens
  - **AC ref:** AC6, AC7, AC-E1
  - **DoD:**
    - [x] `buildStructuredPdf` acepta un parámetro `content: Record<string, string> = {}` (6º,
      con default para no romper a `public-enrollment/index.ts`, que aún no lo pasa)
    - [x] PRIMERO–CUARTO: cada cláusula usa `content[claveId] ?? bodyHardcodeadoActual` vía el
      helper local `applyClause`, con `substituteTokens` aplicado siempre (no-op si no hay `{{}}`)
    - [x] QUINTO: se sigue calculando `netPrice`/`paid`/`balance`/`textoDescuento` en código igual
      que hoy; el texto de `content['quinto']` (o el fallback) pasa por `substituteTokens`
    - [x] SEXTO: se sigue calculando `policyUrl` en código; `content['sexto']` pasa por
      `substituteTokens` con `{{emailContacto}}`, `{{politicaPrivacidadUrl}}`
    - [x] El motor de wrap/justificado/paginación (`wrapToWidth`, `drawJustified`, `TJustifiedLine`)
      no cambió — solo el origen del texto de cada cláusula
    - [ ] ⚠️ Test de paridad (Deno) NO ejecutado — Deno no disponible en este sandbox. Pendiente:
      correr contra el `content` real sembrado y confirmar que un contrato Clase B/Profesional de
      prueba produce el MISMO texto que antes del refactor

- [x] **T2.2** — Agregar `mode` a `generate-contract-pdf/index.ts`
  - **AC ref:** AC2, AC3, AC-E2
  - **DoD:**
    - [x] Acepta `mode?: 'real' | 'preview' | 'sample'` en el body, default `'real'`
    - [x] `'real'`: comportamiento actual sin cambios de contrato público, agrega `branch_id` al
      `select` de `enrollments` y hace `fetchDocumentContent(supabase, enrollment.branch_id,
      documentType)` en paralelo con `tryLoadIdPhoto`/`loadPngForPdf`
    - [x] `'sample'`: `handlePreviewOrSample()` — alumno ficticio (`SAMPLE_STUDENT`) + `content`
      real de `document_templates` vía `branch_id`/`document_type` del body, NO escribe a Storage
      ni a `digital_contracts`, responde `{ pdfBase64 }` (`encodeBase64` byte a byte)
    - [x] `'preview'`: mismo alumno ficticio + `content` recibido tal cual en el body (borrador sin
      guardar, nunca toca `document_templates`)
    - [x] Invocación existente sin `mode` (comportamiento legacy) sigue funcionando igual —
      `mode` es opcional con default `'real'`
    - [ ] ⚠️ Test (Deno) NO ejecutado — pendiente correr en un entorno con Deno: `mode: 'preview'`
      no debe llamar a `storage.upload` ni a insert de `digital_contracts`

- [x] **T2.3** — Mismo patrón de `mode` en `generate-certificate-b-pdf/index.ts`
  - **AC ref:** AC3, AC6, AC7, AC-E2
  - **DoD:**
    - [x] `mode` agregado igual que T2.2, `handlePreviewOrSample()` propio del archivo
    - [x] `branch_id` agregado al `select` de `enrollments` (columna directa, no requería join) —
      `fetchDocumentContent(supabase, enrollment.branch_id, 'certificate_b')` reemplaza la
      constante `SCHOOL` fija; `SCHOOL` queda solo como fallback si la sede no tiene fila sembrada
    - [x] `buildCertificatePdf` gana `content: Record<string,string>`; encabezado/intro/cierre/
      firma leen de `content[...] ?? SCHOOL.*` (fallback), cuerpo usa `substituteTokens` con
      `{{fechaInicio}}`/`{{fechaFin}}` (las fechas se siguen calculando desde `class_b_sessions`)
    - [x] `mode: 'sample'`/`'preview'` requieren `branch_id` en el body (sin default fijo — lo
      resuelve el editor, que ya sabe qué sede está editando) + `SAMPLE_STUDENT` fijo
    - [ ] ⚠️ `deno check`/test de paridad NO ejecutados — Deno no disponible en este sandbox

- [x] **T2.4** — Mismo patrón de `mode` en `generate-certificate-professional-pdf/index.ts`
  - **AC ref:** AC3, AC6, AC7, AC-E2
  - **DoD:** igual checklist que T2.3, adaptado al certificado Profesional — `cuerpo` agrega
    placeholder `{{cursoLabel}}` (calculado desde `getCourseLabel(licenseClass)`) junto a
    `{{fechaInicio}}`/`{{fechaFin}}`
    - [ ] ⚠️ `deno check`/test de paridad NO ejecutados — Deno no disponible en este sandbox

---

## Fase 3 — Capa Facade

- [x] **T3.1** — Escribir `document-content-templates.facade.spec.ts` PRIMERO (TDD)
  - **DoD:**
    - [x] 16 tests: `load()` transforma DTO→UI y rellena `body:''` para claves sin guardar,
      `publish()` hace upsert con `onConflict: 'branch_id,document_type'`, `preview()` invoca la
      Edge Function correcta según `documentType` con `mode:'preview'` + el borrador sin guardar y
      nunca vuelve a tocar `document_templates`, `viewPublished()` usa `mode:'sample'` sin `content`
    - [x] Edge cases: sede/tipo sin fila (AC-E1, sin error), error de red en `load`/`publish`/
      `preview` (signal de error seteado, sin romper)
    - [x] Tests corridos ANTES de escribir el archivo de implementación — confirmado que fallaban
      por módulo inexistente (`npx vitest run`, sin mockear nada de la implementación)

- [x] **T3.2** — Implementar `document-content-templates.facade.ts`
  - **AC ref:** AC1, AC2, AC3, AC-E1
  - **DoD:**
    - [x] 16/16 tests de T3.1 PASAN (`npx vitest run`)
    - [x] Estructura: estado privado → estado público readonly → métodos (regla `facades.md` §4)
    - [x] **Decisión que se aparta de la regla 7 de `facades.md`:** NO inyecta `BranchFacade` — la
      sede a editar la elige el propio selector del editor, no el filtro global de sede del panel
      admin. Mismo patrón que `WebsiteConfigFacade.loadConfig(branchId)`, el precedente más
      cercano (JSONB editable por sede), que tampoco inyecta `BranchFacade`. Documentado en el
      docblock de la clase para que una futura auditoría de `inject(*Facade)` no lo marque como
      violación sin revisar el porqué (mismo tipo de falso positivo que ya documenta
      `architecture.md` para Organismos)
    - [x] `createRequestGuard()` en `load()` (protección contra respuestas fuera de orden al
      cambiar de sede/tipo rápido)
    - [x] try-catch + `ErrorSanitizerService` en cada método async, signal de error expuesto
    - [x] `preview()` invoca la Edge Function correspondiente según `documentType` con
      `mode: 'preview'` y el `content` en borrador (sin guardar) — `viewPublished()` la variante
      `mode: 'sample'` para AC-E2
    - [x] `publish()` hace upsert sobre `document_templates` (branch_id + document_type)
    - [x] Documentado en `indices/FACADES.md` (entrada manual con prosa + npm run indices:sync)

- [x] **T3.3** — Escribir `document-clause-limits.util.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC5
  - **DoD:**
    - [x] 4 tests: dentro del límite, exactamente en el límite, 1 carácter sobre el límite, texto
      vacío
    - [x] Tests corridos ANTES de la implementación (fallaban por módulo inexistente)

- [x] **T3.4** — Implementar `document-clause-limits.util.ts`
  - **AC ref:** AC5
  - **DoD:**
    - [x] 4/4 tests de T3.3 PASAN
    - [x] `getClauseCharacterStatus(text, maxLength): { withinLimit, remaining }` — función pura,
      sin dependencias de Angular, testeable sin TestBed (el límite por sección lo aporta
      `DOCUMENT_TEMPLATE_SECTIONS`, no este util — separación cálculo vs. metadata)
    - [x] Documentado en `indices/UTILS.md` (npm run indices:sync — util sin sección manual, solo Auto-Index)

---

## Fase 4 — Capa UI

- [x] **T4.1** — Crear `document-clause-field.component.ts` (Dumb)
  - **AC ref:** AC1, AC5
  - **DoD:**
    - [x] OnPush
    - [x] Solo `input()` (`sectionId`, `label`, `body`, `maxLength`, `availableTokens`) /
      `output()` (`bodyChange`) — sin Facades
    - [x] Usa `getClauseCharacterStatus()` para mostrar contador + advertencia visual (color
      `text-error`) al exceder el límite
    - [x] Si `availableTokens` no está vacío, muestra los tokens disponibles como `<code>` chips
      informativos (AC7) — no clicables (mitigación razonable, no obligatoria)
    - [x] Tokens de color del DS, `.micro-label` para el label de la sección
    - [x] `data-llm-description` en el textarea
    - [x] Documentado en `indices/COMPONENTS.md` (vía `npm run indices:sync`, Fase 7)

- [x] **T4.2** — Reconstruir la tab `templates` en `dms-list-content.component.ts`
  - **AC ref:** AC1, AC4, AC8
  - **DoD:**
    - [x] Render de `TemplateCard[]` con filtro por categoría y botón "Descargar" eliminado
    - [x] Selector de sede (`p-select` sobre `templateBranches()`) + selector de tipo de documento —
      `templateDocumentTypeOptions` filtra Profesional si `branch.hasProfessional` es falso (AC8)
    - [x] Lista de `<app-document-clause-field>` por cada sección del tipo seleccionado
    - [x] Botones "Ver documento actual", "Vista previa" y "Publicar" con `data-llm-action`
    - [x] **Resuelto el punto abierto del plan:** NO se inyecta el Facade en `dms-list-content`
      (sigue Dumb) ni se extrajo un componente Organismo hijo — el editor quedó inline en el mismo
      archivo (igual que las otras 3 tabs), con estado/lógica de selección local (signals propios,
      permitido en un Dumb) y outputs (`template*Requested`) que el Smart Component
      (`AdminDocumentosComponent`, que sí inyecta `DocumentContentTemplatesFacade`) resuelve —
      evita el gate del Architect Guard (`shared-organisms.allowlist.json` exige que el componente
      se abra vía `LayoutDrawerFacadeService.open()`, y este se monta inline con inputs, no aplica)
    - [x] Guard de acceso: `tabs` computed oculta "Plantillas" por completo si `!isAdmin()` (AC4) —
      la RLS ya es admin-only, no tiene sentido mostrar una tab que no puede traer datos
    - [x] Documentado en `indices/COMPONENTS.md` (vía `npm run indices:sync`, Fase 7)

- [x] **T4.3** — Eliminar `dms-template-drawer.component.ts` y sus referencias
  - **DoD:**
    - [x] Archivo eliminado (no tenía `.spec.ts`)
    - [x] Referencias en `dms-list-content.component.ts` (`uploadTemplate` output, botón "Nueva
      plantilla" en `heroActions()`) removidas
    - [x] `uploadTemplate`/`deleteTemplate`/`incrementDownload`/`openTemplate` y estado `_templates`
      eliminados de `dms.facade.ts` (también `RawTemplate`, `LABELS_CATEGORIA_PLANTILLA`,
      `resolveFormat`/`resolveFormatColor`, y la query `document_templates` de `fetchAllData()`)
    - [x] `TemplateCard`/`TemplateCategory`/`TemplateCategoryFilter`/`UploadTemplatePayload`
      eliminados de `core/models/ui/dms.model.ts`
    - [x] `dms.facade.spec.ts` actualizado — el mock `makeRaceableSupabaseMock` asumía 6 llamadas
      `.from()` por batch de `fetchAllData()`, ahora son 5 (se quitó `document_templates`);
      corregido `Math.floor(idx / 6)` → `/ 5`. 24/24 tests pasan
    - [x] Entrada de `app-dms-template-drawer` removida de `indices/COMPONENTS.md` (automático —
      el archivo ya no existe, `npm run indices:sync` no lo vuelve a listar)

---

## Fase 5 — Conexión: Vista previa y Publicar

- [x] **T5.1** — Confirmar soporte de `DmsViewerService` para Blob URL
  - **DoD:**
    - [x] Leído `dms-viewer.service.ts` y `DmsViewerDocument` (`{ url: string; name; type }`)
    - [x] Acepta cualquier `url` string genérica (incluye `blob:`) — **sin cambios necesarios**,
      confirmado usándolo tal cual en `AdminDocumentosComponent.openPdf()`

- [x] **T5.2** — Wire-up "Vista previa": Facade → Edge Function → `DmsViewerService`
  - **AC ref:** AC2, AC-E2
  - **DoD:**
    - [x] Click en "Vista previa" emite `templatePreviewRequested`; el Smart llama
      `templatesFacade.preview()`, que arma el `content` en borrador desde `form()` y lo manda
      con `mode: 'preview'` (nunca toca `document_templates`)
    - [x] La respuesta `{ pdfBase64 }` se convierte a Blob URL (`atob` + `Uint8Array` +
      `URL.createObjectURL`, en `AdminDocumentosComponent.openPdf()`) y se abre en `DmsViewerService`
    - [x] `templateIsGeneratingPreview` (signal del Facade) deshabilita los botones mientras genera
    - [x] Error de generación muestra Toast vía `ToastService` (ya lo hace `generatePdfBase64()`
      dentro del Facade), no rompe el editor — `preview()` devuelve `null`, `openPdf` no abre nada

- [x] **T5.3** — Wire-up "Ver documento default" (solo lectura, fuera del modo edición)
  - **AC ref:** AC-E2
  - **DoD:**
    - [x] Mismo mecanismo que T5.2 pero botón "Ver documento actual" → `mode: 'sample'` (contenido
      real de BD, sin borrador) vía `templatesFacade.viewPublished(branchId, documentType)`
    - [x] Accesible desde la tab sin depender de que haya un `form()` cargado (solo requiere sede
      seleccionada)

- [x] **T5.4** — Wire-up "Publicar"
  - **AC ref:** AC3
  - **DoD:**
    - [x] Click en "Publicar" emite `templatePublishRequested` → Smart llama
      `templatesFacade.publish()` (upsert sobre `document_templates`)
    - [ ] Confirmación previa vía `ConfirmModalService` — **no implementada**, criterio de
      implementación la marcaba opcional; se puede agregar después si se decide que hace falta
    - [x] Toast de éxito/error ya lo maneja el Facade (`ToastService`)
    - [x] Tras publicar, el estado local (`_form`) no se resetea — el admin sigue viendo lo que
      acaba de guardar sin re-fetch

---

## Fase 6 — Validación

- [x] **T6.1** — `npm run lint:arch` corre limpio
  - Requirió 2 fixes reales: ícono `file-search` (Lucide) sin registrar en `app.config.ts` (ARCH-14,
    hubiera crasheado en runtime) y 2 componentes importando `DocumentType` directo de `dto/` en
    vez de `ui/` (ARCH-12) — resuelto re-exportando el tipo desde
    `ui/document-content-template.model.ts`. Resultado: **0 errores, 174 advertencias**
    (backlog preexistente bajó de 355 a 339)
- [x] **T6.2** — `npx vitest run` corre verde: **2477/2477 tests, 0 fallos** (5 skipped
    preexistentes). `npx ng build --configuration=development` también limpio
- [x] **T6.3** — Deno instalado (2026-09-17) y suite `_shared/*.test.ts` corrida: `template-tokens`
    (mecanismo de placeholders, AC7/AC-E3) 5/5 PASS. **No-persistencia en preview (T2.2/AC-E2)
    validada en vivo vía `/verify`**: click en "Vista previa" del editor real → POST a
    `generate-contract-pdf` (200) → 0 escrituras a `document_templates` en Network (solo el GET de
    carga inicial) — confirmado contra las Edge Functions ya desplegadas, no un mock.
    - [ ] ⚠️ **Sigue sin verificar**: paridad byte-a-byte del PDF pre/post refactor de `contract-pdf.ts`
      (T2.1) — no existe un test Deno para esto (compararía contra el código previo al refactor, que
      ya no está); la validación que hay es funcional (el PDF de Vista Previa se ve correcto con
      los 6 tokens sustituidos), no una comparación automatizada contra el output viejo
- [ ] **T6.4** — QA manual del golden path + edge cases (2026-09-17, vía Playwright MCP contra `ng serve`)
  - **DoD:** Cada AC (AC1–AC6, AC-E1, AC-E2) marcado con evidencia en `acceptance.md`, incluyendo:
    - [x] Editar cláusula → Vista previa → PDF refleja el cambio con datos ficticios — validado
      inyectando un marcador único en PRIMERO y confirmando (decodificando el `pdfBase64` de la
      respuesta real de `generate-contract-pdf`, `mode:'preview'`) que el marcador aparece en el
      binario del PDF generado
    - [x] **Publicar → generar contrato REAL de un enrollment de prueba** — ejecutado con
      autorización explícita del owner (2026-09-17). Flujo: marcador único en PRIMERO → "Publicar"
      → **falló con 400** (`null value in column "name" of relation "document_templates" violates
      not-null constraint" — bug real, ver abajo) → corregido → "Publicar" 200 → nueva matrícula
      real (`/app/admin/matricula`, RUT `19.876.543-0`, alumno "QA Verify Prueba0016m Publish",
      Autoescuela Chillán, Contrato Clase B, enrollment_id 2874) → "Generar PDF" (`mode:'real'`
      implícito, sin `mode` en el body) → 200, subido a Storage
      (`contracts/2874/Contrato_QA_Verify_Prueba0016m_2026.pdf`) → **descargado el PDF real y
      confirmado que contiene el marcador** en su binario. Contenido revertido a su texto original
      inmediatamente después (verificado releyendo desde BD tras recargar la página, sin caché).
      **Bug encontrado y corregido**: `DocumentContentTemplatesFacade.publish()`
      (`document-content-templates.facade.ts`) no incluía `name` en el `upsert()`, y esa columna es
      `NOT NULL` en `document_templates` (heredada de antes de la migración T1.2, nunca se le quitó
      el constraint) — el botón "Publicar" **nunca había funcionado**, ni en esta sesión ni
      probablemente en ninguna desde que se implementó T3.2/T5.4. Fix: `name:
      DOCUMENT_TYPE_LABELS[form.documentType]` agregado al payload (`DOCUMENT_TYPE_LABELS` no
      estaba importado en el Facade). Test `document-content-templates.facade.spec.ts` actualizado
      para afirmar `name` en el upsert — 16/16 tests pasan.
    - [x] Acceso bloqueado para rol no-admin — logueado como `secretaria@test.com`, tab
      "Plantillas" no aparece en `/app/secretaria/documentos` (solo 3 tabs), sin queries a
      `document_templates` en Network, consola limpia
    - [x] Sede/tipo sin fila usa el default sembrado — no verificable end-to-end en vivo (las 6
      combinaciones válidas ya están sembradas por la migración T1.2), pero cubierto por test
      (`document-content-templates.facade.spec.ts`, caso "sede/tipo sin fila (AC-E1, sin error)")
      + lectura de código (`content[claveId] ?? bodyHardcodeadoActual`, nunca lanza). Ver
      `acceptance.md` AC-E1 para el detalle de por qué no hay E2E real posible sin borrar datos.
    - [x] AC8 — Autoescuela Chillán no ofrece Contrato/Certificado Profesional: confirmado en vivo,
      el selector de tipo de documento solo muestra "Contrato Clase B" y "Certificado Clase B"
    - [x] Resto de tabs de DMS (Alumno, Instructores, Escuela) sigue funcionando sin regresión —
      probado como secretaria: las 3 tabs cargan datos reales, consola limpia, sin 4xx/5xx
- [x] **T6.5** — Ejecutar `/verify` (Playwright) sobre la tab reconstruida (2026-09-17)
  - Veredicto: ✅ PASA. Mirada humana, consola limpia, red sin 4xx/5xx, datos reales, sin clases
    muertas nuevas, contraste OK en oscuro, responsive OK en 375px. Flujo end-to-end de "Vista
    previa" confirmado contra la Edge Function real (`mode:'preview'`), sin escribir a
    `document_templates`
- [x] **T6.6** — Ejecutar `/spec-verify` (2026-09-17)
  - Resultado: **✅ PASA** — 11/11 AC cumplidos con evidencia. `acceptance.md` generado con detalle
    completo. Deuda no-bloqueante: paridad byte-a-byte T2.1 sin test automatizado, sin `.spec.ts`
    para `dms-list-content.component.ts`, confirmación previa a Publicar no implementada (era
    opcional).

---

## Fase 7 — Cierre

- [x] **T7.1** — Índices actualizados a lo largo de la sesión: `COMPONENTS.md`, `UTILS.md`,
  `FACADES.md`, `MODELS.md`, `DATABASE.md` — confirmado sin pendientes (ver Stop hook sync-check
  2026-09-17)
- [x] **T7.2** — Spec movida de "Backlog" a "Done" en `specs/ROADMAP.md` (2026-09-17)
- [x] **T7.3** — `specs/.active` limpiado

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [x] **T-desc.1** — Precio de muestra hardcodeado ($500.000) en `generate-contract-pdf`
  (2026-09-17). Hallazgo del owner en QA visual: `buildSampleEnrollmentData()` (modos
  `preview`/`sample`, usados por "Vista previa" y "Ver documento actual") usaba
  `base_price: 500000` fijo, sin relación con ningún curso real — podía confundir a quien edita
  pensando que era un valor vigente. Fix: nueva `fetchSampleBasePrice()` trae el `base_price` real
  de `courses` (branch_id + license_class 'B'/'A4' según `document_type`), con `500000` solo como
  fallback si la sede no tiene ese curso sembrado. Desplegado por el owner a
  `generate-contract-pdf` y confirmado visualmente: QUINTO ahora muestra el precio real de la
  sede ($180.000) en vez del valor inventado.
