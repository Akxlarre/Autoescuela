# Plan 0016-m — Editor de plantillas para contratos y certificados generados por Edge Function

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-09-16
> **Tamaño:** L — revisar este plan completo antes de implementar (toca BD + 3 Edge Functions + UI nueva)

---

## 1. Resumen ejecutivo

Se reestructura la tabla `document_templates` (hoy sostiene la tab "Plantillas" de DMS con
archivos descargables subidos a mano — feature confirmado en desuso real por el owner) para que
guarde el texto editable de cada cláusula/sección de los 4 tipos de documento (contrato B,
contrato Profesional, certificado B, certificado Profesional) por sede, sembrada con el texto
hardcodeado actual como default. La tab "Plantillas" se reconstruye para ser el editor de este
contenido — decisión del owner (2026-09-16): "estos contratos y certificados editables son
literalmente plantillas", así que es el lugar correcto, no una tab nueva. El feature de subir
archivos descargables arbitrarios (`uploadTemplate`/`deleteTemplate`/`incrementDownload`,
`app-dms-template-drawer`) se **reemplaza por completo** — no se preserva en paralelo, porque no
tenía consumidores reales (confirmado: ninguna otra parte del código lee `document_templates`, y
la RLS que daba SELECT a alumno/instructor nunca se conectó a ninguna pantalla de esos portales).

Se agrega un Facade + UI de edición (dentro de la tab "Plantillas" existente, patrón calcado de
Configuración Web) para editar ese contenido y previsualizarlo sin guardar. Las 3 Edge Functions
generadoras (`generate-contract-pdf`, `generate-certificate-b-pdf`,
`generate-certificate-professional-pdf`) se refactorizan para leer el body de cada cláusula desde
la tabla en vez del string literal, y ganan un modo `preview`/`sample` que no persiste nada en
Storage ni en `digital_contracts` — solo devuelve el PDF para mostrarlo.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260916000000_repurpose_document_templates.sql` | Migration | Reestructura `document_templates`: drop columnas de archivo (`file_url`, `format`, `version`, `download_count`, `active`), agrega `branch_id`/`document_type`/`content` + RLS admin-only + seed del texto hardcodeado actual como default por sede/tipo |
| `src/app/core/models/ui/document-content-template.model.ts` | UI Model | Forma editable para el formulario (secciones nombradas, no JSON crudo) |
| `src/app/core/facades/document-content-templates.facade.ts` | Facade | CRUD del contenido editable (branchId explícito por método, no branch-scoped vía `BranchFacade` — ver §6), invoca Edge Functions en modo preview/sample |
| `src/app/shared/components/document-clause-field/document-clause-field.component.ts` | Dumb | Campo de edición de una cláusula (textarea + contador de caracteres + advertencia de overflow) |
| `src/app/core/utils/document-clause-limits.util.ts` | Util puro | Límites de caracteres por cláusula + función de validación (testeado, `core/utils` obligatorio por `testing-tdd.md`) |
| `src/app/core/facades/document-content-templates.facade.spec.ts` | Test | Obligatorio (`testing-tdd.md`) |
| `src/app/core/utils/document-clause-limits.util.spec.ts` | Test | Obligatorio |
| `supabase/functions/_shared/template-tokens.ts` | Deno util puro | `substituteTokens(text, tokens)` — reemplaza `{{clave}}` por el valor del mapa; token desconocido → string vacío (AC-E3). El cálculo de cada valor (monto, saldo, URL) se queda en cada Edge Function, esto solo hace el reemplazo de texto |
| `supabase/functions/_shared/template-tokens.test.ts` | Deno test | Casos: token conocido, token desconocido → vacío, texto sin tokens, mismo token repetido 2 veces |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `supabase/functions/_shared/contract-pdf.ts` | `clause()` y las cláusulas de `buildStructuredPdf` leen el body desde un `content: Record<string,string>` recibido por parámetro, con fallback al texto actual hardcodeado si la clave falta (AC-E1). **PRIMERO–CUARTO** son texto editable directo. **QUINTO y SEXTO** siguen calculando sus valores en código (`netPrice`, `paid`, `balance`, `policyUrl`, `discountText`) pero el texto que los rodea pasa a ser editable con placeholders (`{{valorCurso}}`, `{{montoPagado}}`, `{{saldoPendiente}}`, `{{textoDescuento}}`, `{{emailContacto}}`, `{{politicaPrivacidadUrl}}`) sustituidos vía `template-tokens.ts` antes de pasar por `clause()`. **Ya aplicado (2026-09-16), fuera de este refactor:** se eliminó por completo el bloque `if (data.convalidation) { clause('SÉPTIMO...') }` y el campo `convalidation` de `EnrollmentData` — era texto inventado sin verificar y se ejecutaba también para Clase B (ver Contexto de negocio en spec.md) | Desacoplar texto de layout Y de cálculo, sin tocar el motor de dibujo/wrap (AC7) |
| `supabase/functions/generate-contract-pdf/index.ts` | Acepta `mode?: 'real' \| 'preview' \| 'sample'`. `real` = comportamiento actual pero leyendo `content` desde `document_templates` en vez de literales. `preview`/`sample` = arma `EnrollmentData` con datos de alumno ficticio hardcodeados, usa `content` de la tabla (`sample`) o del body de la request (`preview`, sin persistir), y devuelve `{ pdfBase64 }` en vez de subir a Storage. **Ya aplicado (2026-09-16):** se eliminó el fetch de `license_validations` y el parámetro `licenseValidation` de `flattenEnrollment` (solo alimentaban la cláusula SÉPTIMO eliminada) | AC2, AC-E2 |
| `supabase/functions/public-enrollment/index.ts` | **Ya aplicado (2026-09-16):** se eliminaron las 2 asignaciones `convalidation: null` (código muerto tras quitar el campo de `EnrollmentData`) | Consistencia con el tipo `EnrollmentData` actualizado |
| `supabase/functions/generate-certificate-b-pdf/index.ts` | Mismo patrón de `mode` + lee `content` desde `document_templates` en vez de la constante `SCHOOL`/strings hardcodeados. Secciones editables: encabezado (nombre/subtítulo/dirección), intro, cuerpo (con placeholders `{{fechaInicio}}`/`{{fechaFin}}`), cierre, firma. Ya no asume una sola sede — el `content` se busca por el `branch_id` real del enrollment | AC3, AC6, AC7 |
| `supabase/functions/generate-certificate-professional-pdf/index.ts` | Mismo patrón, agrega placeholder `{{cursoLabel}}` en el cuerpo | AC3, AC6, AC7 |
| `src/app/core/models/dto/document-template.model.ts` | Reescrita 1:1 con la tabla reestructurada (`DocumentTemplate` + `DocumentType`) — se reutiliza el archivo/nombre existente en vez de crear uno nuevo, es la misma tabla | Confirmado sin otros consumidores del DTO viejo (`grep` sin resultados fuera del propio archivo) |
| `src/app/core/facades/dms.facade.ts` | Se **eliminan** `uploadTemplate`/`deleteTemplate`/`incrementDownload` y el estado `_templates` asociado a archivos descargables (sin reemplazo — ese feature no tenía consumidores reales, confirmado en discusión con el owner) | La tabla que sostenía esas acciones cambia de forma; el feature que reemplazan no se preserva |
| `src/app/shared/components/dms-list-content/dms-list-content.component.ts` | La tab `templates` deja de listar `TemplateCard[]` con filtro por categoría/descarga y pasa a alojar el editor (`DocumentTemplatesEditorComponent` o el nuevo set de componentes) con selector sede+tipo de documento | AC1 — la tab "Plantillas" se convierte en el editor, no una tab nueva (decisión del owner, 2026-09-16) |
| `src/app/features/admin/documentos/dms-template-drawer/dms-template-drawer.component.ts` | Se elimina (era el drawer de "subir plantilla nueva" — ya no aplica, no hay archivo que subir) | Reemplazado por el editor de contenido |
| `src/app/core/models/ui/dms.model.ts` | Se elimina `TemplateCard`/`TemplateCategory`/`UploadTemplatePayload` (tipos del feature de archivos descargables); se agregan los tipos del editor si no viven en su propio archivo de modelo | Alineado con `models.md` |
| `indices/DATABASE.md` | Documentar la reestructuración de `document_templates` (columnas nuevas + RLS) | Regla `database.md` |
| `indices/FACADES.md`, `indices/COMPONENTS.md`, `indices/UTILS.md` | Documentar los artefactos nuevos y remover las entradas de lo eliminado (`app-dms-template-drawer`, métodos de `DmsFacade`) | Regla de auto-mantenimiento del proyecto |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|
| `src/app/features/admin/documentos/dms-template-drawer/dms-template-drawer.component.ts` (+ su `.spec.ts` si existe) | Reemplazado por el editor de contenido — ya no se sube un archivo, se edita texto estructurado |

---

## 3. Reutilización (Discovery)

### Componentes/patrones existentes que reutilizamos
- **Patrón UX de Configuración Web** (`features/admin/configuracion-web/tabs/*`) — tabs
  `Smart-lite` con `FormGroup`/`FormArray` por sección, exactamente el precedente que pidió la
  Asignación para "edición de contenido por no-programador".
- `DmsViewerService` (`core/services/ui/dms-viewer.service.ts`) — ya renderiza documentos
  (PDF/imágenes) en un modal global desde `AppShell`. Se reutiliza para mostrar el PDF de vista
  previa/default, evitando construir un visor nuevo. Requiere confirmar en tasks si acepta un Blob
  URL local (`URL.createObjectURL`) además de una URL de Storage — si no, se adapta con un cambio
  mínimo no invasivo.
- `_shared/pdf-utils.ts` / `wrapToWidth` / `drawJustified` / `TJustifiedLine` — el motor de
  wrap/justificado/paginación NO cambia, solo el origen del texto de cada cláusula.
- `createRequestGuard()` (`core/utils/request-guard.utils.ts`) — para el fetch del contenido del
  editor si hay carreras entre cambios rápidos de sede/tipo (mismo patrón que el resto de Facades
  branch-scoped).
- `ConfirmModalService` — confirmación antes de "Publicar" si hay cambios sin guardar y el admin
  navega fuera (mismo patrón que otras acciones irreversibles del proyecto).

### Facades/Services existentes que extendemos
- `DmsFacade` — solo para el punto de entrada de navegación hacia el editor nuevo (no se le agrega
  lógica de dominio del editor, para no bloatear un Facade que ya cubre 4 dominios distintos —
  alumnos/instructores/escuela/plantillas descargables).

### Componentes/Facades que NO existen y debemos crear
- `DocumentContentTemplatesFacade` — dominio nuevo (contenido editable de documentos legales),
  claramente distinto de lo que ya cubre `DmsFacade` (archivos subidos de alumnos/instructores/
  escuela) o `WebsiteConfigFacade` (contenido de sitio público). Crear uno nuevo respeta el
  principio de Facade por dominio (`facades.md` §1) en vez de forzarlo dentro de `DmsFacade`, que
  ya cubre 3 dominios de archivos distintos.
- `document-clause-field` (Dumb) — no existe un campo de edición de texto largo con contador de
  caracteres/advertencia de overflow en el DS hoy (`indices/COMPONENTS.md` no lista uno).

### Qué se descarta (y por qué es seguro descartarlo)
- `DmsFacade.uploadTemplate/deleteTemplate/incrementDownload` y `app-dms-template-drawer` — el
  feature de "subir un archivo descargable a la tab Plantillas". Confirmado con el owner
  (2026-09-16) que está en desuso real, y confirmado en código que no tiene consumidores fuera de
  la propia tab (ninguna pantalla de alumno/instructor lee `document_templates` pese a que su RLS
  se lo permitía). Se reemplaza sin dejar una ruta paralela — mantener ambos modelos (archivo
  subido vs. contenido generado) en la misma tab confundiría el propósito de la pantalla.

---

## 4. Modelo de datos

### Migración requerida

```sql
-- supabase/migrations/20260916000000_repurpose_document_templates.sql
-- Reestructura document_templates: de "archivo descargable subido a mano" (en desuso, sin
-- consumidores reales) a "contenido editable por cláusula que alimenta la generación de PDF".

ALTER TABLE document_templates
  DROP COLUMN IF EXISTS file_url,
  DROP COLUMN IF EXISTS format,
  DROP COLUMN IF EXISTS version,
  DROP COLUMN IF EXISTS download_count,
  DROP COLUMN IF EXISTS active,
  DROP COLUMN IF EXISTS category;

ALTER TABLE document_templates
  ADD COLUMN branch_id INT REFERENCES branches(id),
  ADD COLUMN document_type TEXT CHECK (
    document_type IN ('contract_b', 'contract_professional', 'certificate_b', 'certificate_professional')
  ),
  -- { "primero": "texto...", "segundo": "texto...", ... } — claves = mismo identificador de
  -- cláusula que usa contract-pdf.ts hoy (PRIMERO, SEGUNDO, ...), en minúscula.
  ADD COLUMN content JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE document_templates
  ALTER COLUMN branch_id SET NOT NULL,
  ALTER COLUMN document_type SET NOT NULL,
  ADD CONSTRAINT uq_document_templates_branch_type UNIQUE (branch_id, document_type);

-- `name`/`description`/`updated_by` se conservan (siguen siendo útiles: nombre visible del
-- documento en el editor, descripción opcional, auditoría de quién editó).

-- RLS existente (select abierto a cualquier autenticado, insert/update/delete admin-only) se
-- reemplaza: el contenido ahora es sensible (texto legal) y sin consumidores fuera de admin —
-- ver bloque RLS abajo, reemplaza las 4 policies actuales de document_templates.

-- Seed: una fila por sede × tipo con el texto hardcodeado ACTUAL como default explícito
-- (no depender solo del fallback en código — así el editor muestra contenido real desde el día 1).
-- Detalle exacto del INSERT se resuelve en tasks.md, transcribiendo las cláusulas de
-- contract-pdf.ts / generate-certificate-*-pdf.
```

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `document_templates` | admin | SELECT | `auth_user_role() = 'admin'` (antes: cualquier autenticado — se cierra porque el contenido pasa a ser sensible y sin consumidores reales fuera de admin) |
| `document_templates` | admin | INSERT | `auth_user_role() = 'admin'` (sin cambio) |
| `document_templates` | admin | UPDATE | `auth_user_role() = 'admin'` (sin cambio) |
| `document_templates` | — | DELETE | Se elimina la policy — ya no se borran filas (siempre UPSERT sobre `branch_id`+`document_type`) |

Las Edge Functions leen con `service_role` (bypass RLS), igual que ya hacen para todo lo demás —
no necesitan policy propia.

### Modelos UI/DTO

- `core/models/dto/document-template.model.ts` (reescrito, mismo archivo) — mapea la fila cruda de
  `document_templates` reestructurada (`id`, `name`, `description`, `branch_id`,
  `document_type: DocumentType`, `content: Record<string,string>`, `updated_at`, `updated_by`).
- `core/models/ui/document-content-template.model.ts` — forma para el formulario: lista de
  secciones con `{ id, label, body, maxLength, availableTokens: string[] }` en vez de un JSON
  crudo (el Facade transforma DTO→UI igual que documenta `models.md` §4). `availableTokens` es
  metadata estática (no viene de BD) para que la UI muestre qué placeholders puede usar el admin
  en esa sección — ver tabla de tokens abajo.

### Tokens disponibles por cláusula (AC7)

**Regla para decidir token vs. texto literal:** un valor es **literal** (se escribe directo en el
texto de esa fila de sede) si es constante para TODOS los contratos/certificados de esa sede
(nombre comercial, razón social — vienen de una constante en código, no cambian sin deploy). Es
**token** si varía por curso (horas, clase de licencia), por alumno (nombre en el contrato
Profesional — a diferencia de Clase B, que nunca nombra al alumno dentro de una cláusula), por
transacción (montos, saldo), o si HOY YA se lee de `branches` en tiempo real (email, slug para la
URL de política) — tokenizarlos mantiene que un cambio en Ajustes (ej. email de contacto) se
refleje sin tener que editar el texto de la plantilla.

| Documento | Cláusula | Clave editable | Tokens disponibles |
|-----------|----------|-----------------|---------------------|
| Contrato B | PRIMERO | `primero` | Ninguno — texto estático (las "12 clases" son una constante fija en código, no varían) |
| Contrato B | SEGUNDO | `segundo` | `{{claseTeoricas}}` (`course.theory_hours`, varía por curso) |
| Contrato B | TERCERO, CUARTO | `tercero`, `cuarto` | Ninguno — nombre de la escuela va literal en el texto de esa fila |
| Contrato Profesional | PRIMERO | `primero` | `{{nombreAlumno}}`, `{{claseLicencia}}` (el contrato Profesional sí nombra al alumno dentro de la cláusula) |
| Contrato Profesional | SEGUNDO | `segundo` | `{{horasCurso}}` (150 o 160 según `license_class`) |
| Contrato Profesional | TERCERO, CUARTO | `tercero`, `cuarto` | Ninguno — texto 100% estático hoy |
| Contrato B / Profesional | QUINTO | `quinto` | `{{valorCurso}}`, `{{textoDescuento}}` (vacío si no hay descuento), `{{montoPagado}}`, `{{saldoPendiente}}` |
| Contrato B / Profesional | SEXTO | `sexto` | `{{emailContacto}}`, `{{politicaPrivacidadUrl}}` (ambos ya se leen de `branches` hoy — se mantienen como token, no como texto fijo, para que un cambio en Ajustes se refleje sin editar la plantilla) |
| Certificado B / Profesional | Encabezado | `encabezado_nombre`, `encabezado_subtitulo`, `encabezado_direccion` | Ninguno — texto estático por sede |
| Certificado B / Profesional | Intro | `intro` | Ninguno — representante legal/razón social van literales por sede |
| Certificado B | Cuerpo | `cuerpo` | `{{fechaInicio}}`, `{{fechaFin}}` |
| Certificado Profesional | Cuerpo | `cuerpo` | `{{cursoLabel}}`, `{{fechaInicio}}`, `{{fechaFin}}` |
| Certificado B / Profesional | Cierre + Firma | `cierre`, `firma_nombre`, `firma_cargo` | Ninguno — texto estático |

**Fuera del alcance editable (queda hardcodeado en código, sin cambios):** el párrafo de
identificación de partes del contrato ("En Chillán, [fecha], entre [escuela] ... y el Sr.(a)
[alumno] ...") — es casi 100% inserción de datos (fecha, nombre, RUT, dirección, teléfono, 8+
valores por alumno), no prosa de negocio editable como las cláusulas numeradas. Tratarlo como
"cláusula editable" no aporta valor real y multiplica el riesgo de un editor de texto libre sobre
una oración que es en la práctica un mail-merge. El nombre/RUT/fecha de emisión del alumno en los
certificados tampoco son tokens editables — siguen renderizándose como llamadas de dibujo
separadas (`TC(...)`), igual que hoy.

**SÉPTIMO (convalidación) fue eliminado por completo del generador, no solo del editor** —
descubierto durante la transcripción (2026-09-16) que era texto inventado sin verificar contra
ningún contrato real (ver Contexto de negocio en spec.md para el detalle de origen), y que además
se ejecutaba también para contratos Clase B (fuera del `if (isClassB)`), donde el concepto de
convalidación de licencia ni siquiera aplica. Se borró: el bloque `if (data.convalidation) {
clause(...) }` de `_shared/contract-pdf.ts`, el campo `convalidation` de `EnrollmentData`, el
fetch de `license_validations` en `generate-contract-pdf/index.ts` (solo alimentaba este texto), y
las 2 asignaciones `convalidation: null` muertas en `public-enrollment/index.ts`. Los contratos
generados desde esta spec en adelante no incluyen ninguna cláusula de convalidación. Si el negocio
necesita esta cláusula en el futuro, debe reconstruirse contra un contrato físico real con
convalidación (nunca existió uno de referencia).

**Solo Conductores Chillán (branch 2) ofrece `contract_professional`/`certificate_professional`**
— confirmado contra `courses` real (0 cursos profesionales en Autoescuela Chillán, branch 1). No
se siembra fila para branch 1 en esos 2 tipos de documento, y el selector de tipo de documento en
la UI (T4.2) debe filtrar esas opciones para esa sede (AC8).

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
Admin → tab "Plantillas" de DMS Documentos (dms-list-content.component.ts)
          ├─ inject(DocumentContentTemplatesFacade)
          ├─ inject(BranchFacade) — selector de sede
          ├─ selecciona sede + tipo de documento
          ├─ facade.load(branchId, documentType) → SELECT document_templates
          ├─ <DocumentClauseFieldComponent> × N (Dumb, input: body/maxLength, output: bodyChange)
          ├─ "Vista previa" → facade.preview(branchId, documentType, draftContent)
          │     └─ supabase.functions.invoke('generate-contract-pdf', { mode:'preview', ... })
          │           └─ contract-pdf.ts:buildStructuredPdf(data, content=draftContent)
          │           └─ devuelve { pdfBase64 } (sin tocar Storage/digital_contracts)
          │     └─ DmsViewerService.open(blobUrlDesdeBase64)
          └─ "Publicar" → facade.publish(branchId, documentType, content)
                └─ UPSERT document_content_templates (branch_id, document_type)
                └─ próxima generación REAL (mode:'real') ya lee el contenido nuevo
```

### Capas tocadas

- **Organismo** (dentro de `shared/`, pero inyecta el Facade de su propio dominio — ver
  `architecture.md` "Organismo vs Dumb"): la sección de edición dentro de
  `shared/components/dms-list-content/dms-list-content.component.ts`, tab `templates`
- **Dumb**: `shared/components/document-clause-field/document-clause-field.component.ts`
- **Facade**: `core/facades/document-content-templates.facade.ts`
- **Util puro**: `core/utils/document-clause-limits.util.ts`
- **Edge Functions**: `generate-contract-pdf`, `generate-certificate-b-pdf`,
  `generate-certificate-professional-pdf`, `_shared/contract-pdf.ts`, `_shared/template-tokens.ts`
- **Migration**: `supabase/migrations/20260916000000_repurpose_document_templates.sql`

> A confirmar en `/spec-tasks`: `dms-list-content` hoy es un Dumb puro (`indices/COMPONENTS.md`
> lista sus inputs/outputs, sin Facades inyectados) que recibe todo por `input()` desde
> `DmsFacade`. Si el editor de plantillas necesita su propio Facade (`DocumentContentTemplatesFacade`)
> inyectado directamente ahí, `dms-list-content` pasaría de Dumb a Organismo dentro de esa tab —
> evaluar si conviene extraer la tab `templates` a su propio componente hijo (Organismo aparte,
> montado dentro de `dms-list-content`) en vez de mezclar roles en el mismo archivo. Precedente
> del proyecto: `ASG-b-089`/`fix-146-b` ya trató esta distinción rol-vs-carpeta.

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Facade nuevo, OnPush, Signals en el editor
- [x] `facades.md` §4 (estructura estado priv→pub→métodos) y `createRequestGuard()` en `load()`.
  **§7 (branch-scoped, inyectar `BranchFacade`) deliberadamente NO aplicado** — la sede la elige
  el propio selector del editor, no el filtro global de sede; `branchId` se recibe explícito en
  cada método, mismo patrón que `WebsiteConfigFacade` (que tampoco inyecta `BranchFacade`).
  Documentado en el docblock de la clase.
- [x] `models.md` — DTO (`dto/document-template.model.ts`, reestructurado) vs UI
  (`ui/document-content-template.model.ts`, secciones con label/tokens) separados
- [x] `visual-system.md` — tokens del DS en el editor, sin colores hardcodeados; reutilizar
  `.card`/`.micro-label` para las secciones
- [ ] `swr-pattern.md` — no aplica: el contenido se recarga fresco cada vez que se cambia
  sede/tipo, no es un dato que se revisite entre navegaciones de la misma sesión con beneficio de
  cache
- [ ] `notifications.md` — no aplica: "Publicar" usa `ToastService` para confirmar éxito (feedback
  efímero, Capa 1), no notificación persistente
- [x] `testing-tdd.md` — `.spec.ts` obligatorio para el Facade y para `document-clause-limits.util.ts`
- [x] `ai-readability.md` — `data-llm-action="publish-document-template"` en el botón Publicar,
  `data-llm-action="preview-document-template"` en Vista Previa

---

## 7. Plan de testing

- **Unitarios (obligatorio):**
  - `document-content-templates.facade.spec.ts` — carga por sede/tipo, publish hace upsert,
    preview arma el body correcto para la Edge Function, manejo de error.
  - `document-clause-limits.util.spec.ts` — límites por cláusula, casos límite (exactamente en el
    límite, 1 carácter sobre el límite).
- **Edge Functions (Deno test, mismo patrón que `_shared/*.test.ts` existentes):**
  - Test de paridad: el PDF generado en `mode: 'real'` sin contenido en BD debe producir el MISMO
    texto que el hardcodeado histórico (AC-E1) — evita que la migración introduzca una regresión
    silenciosa de contenido legal.
  - Test de `mode: 'preview'`: no debe llamar a `storage.upload` ni a insert de `digital_contracts`
    (verificar con spy/mock del client).
- **QA manual (`/verify` + golden path):**
  - Editar una cláusula → Vista previa → confirmar que el PDF muestra el texto nuevo con los datos
    ficticios.
  - Publicar → generar un contrato REAL de un enrollment de prueba → confirmar que refleja el
    contenido publicado.
  - Confirmar que el acceso está bloqueado para rol no-admin (AC4).
  - Confirmar que el resto de tabs de DMS (Alumno, Instructores, Escuela) sigue funcionando sin
    cambios — solo la tab "Plantillas" cambia de comportamiento.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Migrar el texto hardcodeado a la BD introduce una discrepancia silenciosa con el contrato físico real (ya validado contra folios reales, ver docblock de `contract-pdf.ts`) | Media | Test de paridad texto-por-texto (ver §7) antes de considerar la migración cerrada; QA manual comparando el PDF post-cambio contra uno generado hoy (pre-cambio) para el mismo enrollment |
| `document_content_templates` con `content JSONB` sin validación de forma permite guardar claves de cláusula inventadas/mal escritas que el PDF ignora en silencio | Media | El Facade solo expone las claves conocidas del `UI Model` (secciones fijas por tipo de documento) — no un editor de JSON libre; considerar un `CHECK` o trigger de validación de claves si el tiempo lo permite (no bloqueante para V1) |
| Cambiar la firma de las 3 Edge Functions (agregar `mode`) rompe invocaciones existentes que no mandan ese campo | Baja | `mode` es opcional con default `'real'` — comportamiento actual sin cambios si no se manda |
| El "editor de texto libre" permite que el admin rompa el layout del PDF pese a los límites de caracteres (texto en un idioma/fuente distinto, saltos de línea manuales, etc.) | Alta (el propio dueño ya lo advirtió como problema sin solución perfecta) | Límite de caracteres por cláusula (AC5) + Vista Previa obligatoria antes de Publicar — mitigación razonable, no se persigue una solución perfecta (alineado con la spec) |
| Reutilizar `DmsViewerService` para mostrar un PDF generado en memoria (Blob URL) en vez de una URL de Storage puede no estar soportado hoy | Media | Confirmar en `/spec-tasks` revisando `dms-viewer.service.ts` / `DmsViewerDocument` antes de codificar; si no soporta Blob URL, es un cambio menor y aislado a ese service, no un rediseño |
| El mecanismo de placeholders (`{{token}}`) permite que el admin borre o escriba mal un token de una cláusula calculada (ej. `{{saldoPendiente}}`), dejando el documento con un vacío donde debería ir un monto | Media | Sustitución de token desconocido → string vacío (nunca un error que bloquee la generación, AC-E3); Vista Previa obligatoria antes de Publicar; la UI muestra los tokens disponibles por cláusula para reducir el error de tipeo |
| Eliminar `document_templates.file_url`/`format`/etc. es destructivo — si alguna sede llegó a subir un archivo real a esa tab en producción, esos archivos quedan huérfanos en Storage (la fila que los referenciaba desaparece, el archivo físico no se borra pero se pierde el índice) | Baja (el owner confirmó desuso) | Antes de aplicar la migración en producción, correr un `SELECT` de verificación (`WHERE file_url IS NOT NULL`) — si hay filas reales, decidir si exportar/avisar antes del `DROP COLUMN` (paso a incluir explícitamente en tasks.md) |

---

## 9. Orden de implementación

1. Migración SQL (reestructurar `document_templates` + RLS + seed) + test de paridad de contenido
2. Refactor de `_shared/contract-pdf.ts` (parámetro `content`, fallback a default) — sin tocar aún las Edge Functions que la invocan
3. Refactor de las 3 Edge Functions: leer de BD + `mode: 'real' | 'preview' | 'sample'`
4. DTO + UI Model + `DocumentContentTemplatesFacade` + `.spec.ts`
5. `document-clause-limits.util.ts` + `.spec.ts`
6. `DocumentClauseFieldComponent` (Dumb)
7. `DocumentTemplatesEditorComponent` (Smart) + punto de entrada desde DMS
8. Conexión Vista Previa → `DmsViewerService` (validar soporte de Blob URL, ajustar si hace falta)
9. QA manual completo (golden path + edge cases AC-E1/AC-E2) + `/verify`

---

## 10. Estimación

L — varios días. El refactor de las 3 Edge Functions + test de paridad de contenido es la parte
de mayor riesgo (puede tomar más de lo estimado si el texto legal real no es trivial de
transcribir sin errores).

---

## Changelog

- 2026-09-16 — plan inicial. Primera versión proponía tabla nueva (`document_content_templates`)
  separada de `document_templates`, por precaución ante un feature marcado `✅ Estable` en los
  índices. **Corregido tras feedback directo del owner:** ese `✅ Estable` describe que el código
  funciona, no que se use — confirmado que `document_templates`/`school_documents` no tienen
  ningún consumidor fuera de la propia tab DMS (ninguna otra pantalla del proyecto las lee), y el
  owner ya había autorizado explícitamente reestructurar la tabla. Mantener la tabla nueva pese a
  ese permiso explícito era una objeción sin sustento real. Plan corregido: se reestructura
  `document_templates` directamente y la tab "Plantillas" se convierte en el editor (no una tab
  nueva) — "estos contratos y certificados editables son literalmente plantillas" (owner,
  2026-09-16). El feature de subir archivos descargables arbitrarios se elimina sin reemplazo.
- 2026-09-16 — agregado mecanismo de placeholders (`_shared/template-tokens.ts`) tras confirmar
  con el owner: QUINTO/SEXTO del contrato tienen lógica de negocio embebida (montos, saldo, URL
  de política de privacidad), así que se editan con tokens en vez de texto 100% libre — el cálculo
  se queda en código, solo el texto alrededor se edita. De paso se corrige el branding hardcodeado
  de los certificados (una sola sede) al sembrar contenido real por sede (decisión del owner, no
  se preserva ese bug).
- 2026-09-16 — **corrección tras revisión del owner sobre la migración ya escrita:** (1) la
  cláusula SÉPTIMO (convalidación) resultó ser texto inventado por Claude Code en abril de 2026,
  nunca verificado contra un contrato físico real, y que además se ejecutaba también para
  contratos Clase B (donde el concepto ni aplica) — eliminada por completo del generador (no solo
  del contenido editable), con su código muerto asociado (`license_validations` fetch,
  `convalidation` field). (2) Se sembraban filas de `contract_professional`/
  `certificate_professional` para Autoescuela Chillán, sede que confirmado contra `courses` real
  no dicta ningún curso profesional — corregido a solo 6 combinaciones sede×tipo válidas (no 8).
  Ambos hallazgos los detectó el owner revisando la migración antes de aplicarla, no la
  investigación previa — ilustra que la transcripción de contenido legal/de negocio necesita
  revisión humana, no solo verificación de sintaxis.
