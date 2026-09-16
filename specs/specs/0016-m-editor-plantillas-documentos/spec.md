# Spec 0016-m — Editor de plantillas para contratos y certificados generados por Edge Function

> **Status:** draft
> **Created:** 2026-09-16
> **Owner:** Matías
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Asignación de equipo `ASG-m-004` (creada por Matías, reclamada por Matías el
2026-09-16).

**Problema que resuelve:** En DMS Documentos se necesita poder editar el contenido de los
documentos que hoy se generan "hardcodeados" vía Edge Function: el contrato Clase B, el contrato
Profesional, el certificado Clase B y el certificado Profesional, de ambas escuelas (8 documentos
en total, o los que correspondan según la combinación escuela × tipo). El objetivo es que una
persona sin conocimientos de programación (similar a la sección Configuración Web existente)
pueda editar el contenido de estos documentos por sección/párrafo, sin tocar código. Funcionalidad
exclusiva de admin.

**Confirmado contra el código real (2026-09-16), antes de comprometer plan:**

- Los documentos NO se generan desde un template de texto/HTML. `supabase/functions/_shared/contract-pdf.ts`
  y los `generate-certificate-*-pdf/index.ts` dibujan el PDF con operadores de bajo nivel
  (`BT /F1 10 Tf ... Tj ET`), con el texto de cada cláusula como string literal en TypeScript,
  interpolado con datos dinámicos (nombre, fechas, montos) y envuelto/justificado a mano
  (`wrapToWidth`, `TJustifiedLine`, `drawJustified`) — el motor de wrap/paginación es genérico y
  no necesita cambiar, solo el origen del texto de cada cláusula.
- `generate-certificate-b-pdf/index.ts` tiene además los datos de la escuela (nombre, dirección,
  representante legal) hardcodeados en una constante `SCHOOL` local — ni siquiera lee `branches`.
- Existe un precedente directo para "contenido editable por no-programador": la tabla
  `website_config` (RLS admin/secretaria de su sede, columna `config JSONB` por `branch_id`) que
  ya usa Configuración Web. Es el molde a replicar para este editor, no un enfoque nuevo.
- La tabla `document_templates` (`indices/DATABASE.md`) existe pero está en desuso real — hoy
  sirve al tab "Plantillas" de DMS (`dms.facade.ts`: `uploadTemplate`/`deleteTemplate`/
  `incrementDownload`) para archivos descargables subidos a mano (`file_url`, `format`,
  `download_count`). No tiene relación con el contenido de los documentos autogenerados. El owner
  confirmó (2026-09-16) que se puede reestructurar sus columnas — a definir en `/spec-plan` si se
  reutiliza la misma tabla con un discriminador o se reemplaza su rol.

**Restricción arquitectónica confirmada con el owner (2026-09-16):** una Edge Function se
despliega desde este repo — no puede reescribirse a sí misma en producción. "Publicar" cambios de
contenido NUNCA debe tocar código ni requerir un deploy: solo modifica la fila de la tabla que la
función consulta en cada invocación. La Edge Function deja de tener el string de la cláusula
hardcodeado y en su lugar hace un `SELECT` antes de dibujar el PDF — ese cambio de código sí
requiere deploy, pero es un cambio de una sola vez (agregar la capacidad), no algo que ocurra en
cada edición de contenido.

## 2. User Stories

- **US1**: Como admin, quiero editar el contenido de cada cláusula/sección de un documento
  (contrato B, contrato Profesional, certificado B, certificado Profesional) por sede, sin tocar
  código, para poder ajustar el texto legal/comercial cuando cambie.
- **US2**: Como admin, quiero ver una vista previa del documento con mis cambios sin guardarlos
  todavía, para verificar cómo se ve antes de publicar.
- **US3**: Como admin, quiero ver el documento default/actual (tal como se genera hoy) desde DMS
  en modo solo lectura, para saber qué contenido está vigente antes de decidir editarlo.

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given un admin en DMS Documentos, When abre el editor de plantillas para un tipo de
  documento + sede, Then ve el contenido editable dividido por sección/cláusula (no un blob de
  texto único).
- **AC2**: Given un admin editando una sección, When hace clic en "Vista previa", Then se genera
  un PDF de muestra con su contenido en borrador (no guardado) más datos de un alumno ficticio
  hardcodeado — confirmado con el owner (2026-09-16) que la vista previa/default usa datos de
  muestra fijos, no un enrollment real.
- **AC3**: Given un admin con cambios en borrador, When hace clic en "Publicar"/"Guardar", Then
  se actualiza la fila correspondiente en BD y el próximo documento real generado (contrato o
  certificado de un alumno real) usa el contenido nuevo — sin ningún deploy ni cambio de código.
- **AC4**: Given un usuario sin rol admin, When intenta acceder al editor de plantillas, Then el
  acceso está bloqueado (guard), igual que el resto de funcionalidad exclusiva de admin.
- **AC5**: Given texto que excede lo razonable para una sección (el propio dueño reconoce que
  esto es complejo de resolver del todo), When el admin edita, Then el editor aplica al menos una
  mitigación razonable (límite de caracteres, advertencia visual o ajuste automático — a definir
  el mecanismo exacto en `/spec-plan`) — no se espera una solución perfecta.
- **AC6**: Given la Edge Function generadora (contrato o certificado) ya migrada a leer BD, When
  se invoca para un alumno real, Then el PDF resultante refleja el contenido editado, con la
  interpolación de datos dinámicos (nombre, fechas, montos) funcionando igual que hoy.

### Edge cases obligatorios

- **AC-E1**: Given una sede/tipo de documento sin contenido editado todavía (fila nueva o
  ausente), When se solicita el documento, Then se usa un contenido default razonable (el texto
  actual hardcodeado, migrado como seed) — nunca un documento vacío o un error.
- **AC-E2**: Given un admin visualizando (solo lectura) el documento default en DMS, Then esa
  vista también invoca la función generadora con datos de muestra hardcodeados — no existe un PDF
  pregenerado estático que mostrar (confirmado en el punto de Contexto).

## 4. Out of scope

- ❌ Editor de layout/diseño visual del PDF (posiciones, columnas, tipografía) — solo se edita el
  *texto* de cada cláusula/sección, no el motor de dibujo (`wrapToWidth`, membrete, firmas, etc.).
- ❌ Versionado/historial de cambios de contenido (quién editó qué y cuándo) — evaluar en spec
  futura si se pide.
- ❌ Editor de contenido para otros documentos generados (ficha técnica, hoja de ruta, EPQ,
  reportes) — el alcance son los 8 documentos de contrato/certificado listados en el Contexto.
- ❌ Migrar los datos hardcodeados de `SCHOOL` en `generate-certificate-b-pdf` a leer de
  `branches` — fuera de alcance salvo que bloquee la tarea central (a confirmar en `/spec-plan`).

## 5. Dependencias

### Specs previas
- Ninguna formal. Referencia de patrón UX: Configuración Web (`website_config` + su UI de
  edición) — ver Contexto.

### Capacidades del proyecto que se asumen existentes
- `_shared/contract-pdf.ts`, `_shared/pdf-utils.ts` y los 3 `generate-*-pdf/index.ts`
  (contrato, certificado B, certificado profesional).
- DMS Documentos (`dms.facade.ts`, sección de plantillas existente).
- Patrón de Facade + RLS admin-only, igual que `website_config`.

### Capacidades nuevas requeridas
- Tabla de contenido editable por sede × tipo de documento × sección (a definir en `/spec-plan`
  si reutiliza/reestructura `document_templates` o es una tabla nueva).
- Nuevo Facade (o extensión de `DmsFacade`) para leer/escribir ese contenido.
- Refactor de las 3 Edge Functions para leer el body de cada cláusula desde BD en vez del string
  literal, manteniendo la interpolación de datos dinámicos intacta.
- Mecanismo de "vista previa con borrador" en las Edge Functions: aceptar contenido no persistido
  en el body de la invocación (precedente: `contract-pdf.ts` ya lo usa `public-enrollment` para
  preview sin persistir un enrollment real).
- Datos de alumno ficticio hardcodeados para vista previa/default (confirmado con el owner,
  2026-09-16).

## 6. Datos y modelo (preliminar)

- Tabla a definir en `/spec-plan`: reestructurar `document_templates` (hoy en desuso para su rol
  original de archivos descargables) vs. tabla nueva — evaluar impacto en `dms.facade.ts`
  (`uploadTemplate`/`deleteTemplate`/`incrementDownload`, tab "Plantillas" actual).
- Estructura de contenido: por sección/cláusula, probablemente JSONB (`{ "primero": "...", "segundo":
  "..." }`) por fila de `branch_id` × `document_type`, siguiendo el patrón de `website_config.config`.
- RLS: admin-only para INSERT/UPDATE/DELETE, igual que `document_templates` hoy.

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): DMS Documentos, sección de plantillas (o nueva subsección "Editor de
  Documentos").
- Flujo principal: admin selecciona tipo de documento + sede → ve secciones editables → edita →
  "Vista previa" (genera PDF con borrador + alumno ficticio) → "Publicar" (persiste en BD, sin
  tocar código ni Edge Function).
- Ver documento default/actual: mismo mecanismo de generación, con datos ficticios, en modo solo
  lectura (sin entrar al editor).
- Referencia de UX: Configuración Web, para el patrón de edición de contenido por no-programador.

## 8. Métricas de éxito post-launch

- {{opcional — a definir con el usuario}}

## 9. Notas / decisiones abiertas

- [x] Preview y vista default usan un alumno ficticio hardcodeado, no un enrollment real
  (confirmado con el owner, 2026-09-16).
- [x] Publicar cambios modifica solo la BD, nunca el código/deploy de la Edge Function
  (confirmado con el owner, 2026-09-16).
- [ ] ¿Se reestructura `document_templates` o se crea una tabla nueva? — a definir en `/spec-plan`,
  el owner autorizó tocar `document_templates` por estar en desuso.
- [ ] Mecanismo exacto de mitigación de overflow de texto (límite de caracteres vs. ajuste de
  fuente vs. advertencia) — a definir en `/spec-plan`, sin exigir solución perfecta.
- Originado de Asignación ASG-m-004 (specs/assignments/ASG-m-004-editor-plantillas-documentos-dms.md)

---

## Changelog

- 2026-09-16 — draft inicial por Matías, a partir de `ASG-m-004` (creada por Matías, 2026-09-14).
  Antes de comprometer el plan se investigó el código real de generación de PDF (confirmando que
  no hay tabla de contenido hoy y que el motor es de dibujo de bajo nivel, no HTML/template) y se
  confirmaron con el owner 2 decisiones de diseño: datos ficticios hardcodeados para
  preview/default, y que publicar nunca toca la Edge Function ni requiere deploy.
