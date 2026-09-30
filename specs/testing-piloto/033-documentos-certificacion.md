# Testing — Documentos (DMS), plantillas y certificación Clase B

> **Asignación:** `ASG-i-033` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** `/app/admin/documentos`, `/app/secretaria/documentos`, `/app/admin/certificacion`,
> `/app/secretaria/certificados`
> **Incluye:** las 4 pestañas del Repositorio de Documentos (Documentos del Alumno + "Últimos
> subidos", Documentos de Instructores, Documentos de la Escuela, Plantillas), los drawers de
> documentos por matrícula y por instructor, el drawer "Subir documento" (3 modos + autorización
> Art. 16 del certificado médico), el visor/descarga, eliminar, el editor de plantillas de
> contrato/certificado (vista previa, ver publicado, publicar) y su efecto en el siguiente PDF, y
> la Certificación Clase B completa (elegibilidad, generar, bypass admin, ver, email/reenviar,
> generar pendientes, envío masivo, exportar ZIP, historial de emisiones).
> **No incluye:** subir documentos dentro del wizard de matrícula (ver `023-matricula-presencial.md`),
> la ficha del alumno (contrato firmado, carnet — ver `024b-ficha-ex-alumnos.md`), marcar
> asistencia/notas de prácticas (ver `027-asistencia-clase-b.md`), documentos de vehículos
> (`ASG-i-032`), certificados Profesional (solo se verifica que sigan bloqueados — ver §3 R).
>
> **Código leído para armar esta lista:**
> `features/admin/documentos/{admin-documentos,dms-upload-drawer,dms-student-docs-drawer,dms-instructor-docs-drawer,dms-doc-preview-drawer}`,
> `features/secretaria/documentos/secretaria-documentos.component.ts`,
> `shared/components/{dms-list-content,dms-viewer-modal,document-clause-field,certificacion-clase-b-content}/`,
> `core/facades/{dms,document-content-templates,certificacion-clase-b,consents}.facade.ts`,
> `core/services/ui/dms-viewer.service.ts`, `core/utils/{document-file-validation,document-clause-limits,document-clause-tokens,branch-scope}.util(s).ts`,
> `core/models/ui/document-content-template.model.ts`,
> `features/admin/certificacion/{admin-certificacion.component.ts,drawers/*}`,
> `features/secretaria/certificados/secretaria-certificados.component.ts`,
> `supabase/functions/{generate-certificate-b-pdf,send-certificate-email,export-certificates-zip,generate-contract-pdf}/index.ts`,
> `supabase/functions/_shared/{template-tokens,contract-pdf}.ts`, `supabase/config.toml`,
> migraciones de Storage (`20260307160000`, `20260310130000`, `20260413000001`, `20260424000002`,
> `20260517000001`), RLS de documentos (`20260301000011` §school_documents, `20260413000002`,
> `20260417000001`, `20260729120000`), vista `v_dms_student_documents` (`20260404120000`),
> `document_templates` (`20260916000000`), trigger de certificado (`20260301000008`, `20260412000001`),
> specs `0003-m`, `0007-m`, `0016-m`, `fix-011-i`.

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-033`, y **cada bug va a su
  propio fix/hotfix**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`).
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S26)** salen de leer el código, **no están confirmadas** en navegador.
  Confirmarlas o descartarlas es parte del trabajo.
- **Hallazgos ya confirmados por otras investigaciones** (no se repiten como nuevos, pero este
  módulo los toca): `generate-contract-pdf` tiene `verify_jwt = false` (`supabase/config.toml:357-358`)
  y no valida al llamador — eso incluye sus modos `preview`/`sample` que usa el editor de
  plantillas; `generate-student-license-pdf` y `generate-enrollment-sheet` usan service role sin
  validar rol/sede; la Certificación Clase B exige 12 sesiones con `evaluation_grade`
  (`certificacion-clase-b.facade.ts:459-464`) y **en el piloto nadie puede poner esa nota** (solo
  el instructor, cuyo portal está bloqueado). La sección L cubre qué ve el usuario en ese escenario.
- Los casos de seguridad (`P`) se ejecutan desde DevTools copiando una petición real ("Copy as
  fetch") y cambiando parámetros. Si uno devuelve datos que no debería, **se reporta como P0 de
  inmediato** y no se sigue explorando con datos reales.

---

## 1. Sospechas de bug encontradas en el código

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🔴 Alta | **Storage deja leer y listar TODO el bucket `documents` sin filtro de sede.** La policy de lectura solo exige rol admin o secretaria. Una secretaria de la sede A puede listar `students/<id>/`, `certificates/<id>/`, `instructor-docs/<id>/` de la sede B y firmar URLs de cédulas, certificados médicos y contratos ajenos. (La RLS de las tablas sí filtra por sede, pero el archivo queda expuesto.) | `supabase/migrations/20260413000001_secure_documents_bucket.sql:26-38` |
| S2 | 🔴 Alta | **Storage deja sobrescribir cualquier archivo, de cualquier sede.** INSERT/UPDATE solo exigen rol admin o secretaria, y la app sube con `upsert: true`. Una secretaria podría reemplazar el PDF de un certificado o de un contrato de otra sede subiendo a la misma ruta. | `20260310130000_fix_documents_storage_rls.sql:42-81`; `core/facades/dms.facade.ts:613-615,705-707,751-753` |
| S3 | 🔴 Alta | **`generate-certificate-b-pdf` (modo real) no valida rol ni sede del llamador.** Usa service role; el header `Authorization` es opcional (solo sirve para el bypass admin y la auditoría). Cualquiera con la anon key (o un alumno/instructor logueado) que mande un `enrollment_id` elegible genera el certificado, crea folio/registro con `issued_by = null` y recibe la URL firmada del PDF (nombre + RUT). | `supabase/functions/generate-certificate-b-pdf/index.ts:74-77,92-111,247-257,274-282` |
| S4 | 🔴 Alta | **`export-certificates-zip` exporta certificados de todas las sedes.** Solo exige una sesión; `branch_id` y `type` vienen del navegador. Una secretaria (o un alumno logueado) que omite `branch_id` descarga el ZIP de certificados de todas las sedes, y con `type: 'professional'` los de Profesional (bloqueado en el piloto). | `supabase/functions/export-certificates-zip/index.ts:53-80,100-106` |
| S5 | 🟠 Media | **Un documento institucional nuevo no aparece para la secretaria ni para el admin con una sede elegida.** Se inserta sin `branch_id` (NULL = "ambas sedes") y la lista filtra con `.eq('branch_id', X)`, que excluye los NULL. Solo el admin en "Todas las sedes" lo ve. (UAT 2026-08-31 lo marcó OK — verificar con un documento **nuevo** subido por la secretaria.) | `dms.facade.ts:770-776,809`; migración `20260301000006…:58` |
| S6 | 🟠 Media | **Documento institucional siempre "Subido por Sistema".** Busca al usuario por la columna `auth_id`, que no existe (es `supabase_uid`); la consulta falla en silencio y `uploaded_by` queda en null. | `dms.facade.ts:762-767,975`; `20260301000001…:46` |
| S7 | 🟠 Media | **No se puede subir el primer documento de un alumno desde "Subir documento".** El selector de alumnos solo ofrece a los que **ya tienen** documentos. | `dms-upload-drawer.component.ts:287-296` |
| S8 | 🟠 Media | **No existe "reemplazar".** Un tipo ya subido desaparece del selector; la secretaria no puede borrar, así que no puede corregir una cédula mal escaneada. El admin tiene que borrar y volver a subir. | `dms-upload-drawer.component.ts:315-353`; `secretaria-documentos.component.ts` (eliminar = no-op) |
| S9 | 🟠 Media | **Borrar un documento no borra el archivo.** Se elimina la fila, pero el archivo queda en Storage (y sigue legible por S1). Tampoco se limpia si la subida funcionó y el `insert` falló. Relevante para Ley 21.719 (datos sensibles y plazos de conservación). | `dms.facade.ts:613-625,639-643,736-742,782-785` |
| S10 | 🟠 Media | **Publicar una plantilla con una sección vacía deja esa parte en blanco en el PDF real.** El editor carga `''` en las secciones sin contenido y publica todas; las edge functions usan `??`, que solo reemplaza `null`, no `''`. Afecta a cualquier sede/tipo sin fila sembrada (contradice AC-E1 de `0016-m`: "nunca un documento vacío"). | `document-content-templates.facade.ts:77-80,197-199`; `generate-certificate-b-pdf/index.ts:492-502`; `_shared/contract-pdf.ts:455,498,571` |
| S11 | 🟠 Media | **Certificado con fechas en blanco o corridas.** Las fechas "entre los días X al Y" salen de las clases con `status = 'completed'`, no de las evaluadas: si el admin fuerza el certificado (el único camino en el piloto) y las clases no están marcadas como completadas, imprime `__________`. Además las fechas y la línea "Chillán, D de MES" se calculan en UTC (una clase o una emisión después de las 20:00-21:00 en Chile sale con el día siguiente). | `generate-certificate-b-pdf/index.ts:175-187,369-396,545-546` |
| S12 | 🟠 Media | **Tope de 1.000 filas sin aviso.** El DMS trae todos los alumnos y todos los documentos del sistema sin paginar; PostgREST corta en 1.000. Con una escuela real (≈4 documentos por alumno) se pierden filas y los conteos quedan mal. | `dms.facade.ts:811-843`; `supabase/config.toml:18` |
| S13 | 🟠 Media | **Branding de una sola sede en el certificado.** El correo dice "Conductores Chillán" fijo para ambas sedes y el logo del PDF es el mismo para ambas. Un alumno de Autoescuela Chillán recibe un correo de la otra escuela. | `send-certificate-email/index.ts:80-81,102-103`; `generate-certificate-b-pdf/index.ts:61-62` |
| S14 | 🟡 Baja-Media | **Criterios de elegibilidad distintos en 3 lugares, y ninguno mira el pago.** La lista de la secretaria usa `certificate_enabled` (trigger que se activa solo con la clase **#12** completada, aunque falten otras); el botón usa la cantidad de clases con nota; la edge function usa `practical_hours` del curso. Ninguno verifica saldo pendiente (el Profesional sí lo hace). | trigger `20260301000008…:451-454` + `20260412000001…:13-26`; `certificacion-clase-b.facade.ts:432-434,459-469,509`; `certificacion-clase-b-content.component.ts:834-836`; `generate-certificate-b-pdf/index.ts:139-165` |
| S15 | 🟡 Baja-Media | **"Generar pendientes" incluye a los no elegibles y nunca manda `force`.** En el piloto (nadie con nota) todos fallan con "0 generados, N con error", sin motivo. El drawer promete "alumnos pendientes **elegibles**". | `certificacion-clase-b.facade.ts:241-265`; `drawers/generar-pendientes-drawer.component.ts:29,85-92` |
| S16 | 🟡 Baja-Media | **Errores tragados.** Si eliminar falla, solo hay `console.error`, sin toast. Las 5 consultas de carga del DMS no revisan `error`: una falla se ve como "Sin documentos aún". El `error` del facade nunca se muestra. El envío de email fallido muestra un genérico y pierde el motivo real ("El alumno no tiene email…"). | `admin-documentos.component.ts:119-121,133-137`; `dms-student-docs-drawer.component.ts:148-150`; `dms-instructor-docs-drawer.component.ts:131-133`; `dms.facade.ts:852,875,927,945,970`; `certificacion-clase-b.facade.ts:228-231` |
| S17 | 🟡 Baja | **No se puede regenerar un certificado ya generado.** La fila "Generado" solo tiene Ver y Email; si se corrige la plantilla o el nombre del alumno, no hay botón para reemitir (`descargarPdf` existe pero no se usa). | `certificacion-clase-b-content.component.ts:294-326`; `certificacion-clase-b.facade.ts:180-184` |
| S18 | 🟡 Baja | **Folio con carrera.** Se calcula `max(folio)+1` fuera de una transacción y `folio` es UNIQUE global: 2 generaciones simultáneas → el `insert` falla, el error se ignora y queda un PDF "Generado" sin registro ni folio; después el email falla con "No se encontró el registro del certificado". | `generate-certificate-b-pdf/index.ts:239-262`; `20260301000008…:36` |
| S19 | 🟡 Baja | **La sede de una matrícula se decide por la sede del alumno.** El DMS filtra alumnos por `users.branch_id`, no por la sede de cada matrícula (spec 0007-m permite que difieran). Un alumno que se rematriculó en otra sede puede desaparecer del DMS de una sede y aparecer en la otra. | `dms.facade.ts:811-818,876-879` |
| S20 | 🟡 Baja | **Editor de plantillas: se pierden cambios sin aviso.** Cambiar de sede o tipo, o salir y volver, recarga desde BD sin preguntar. "Publicar" no pide confirmación ni exige la vista previa. Si la carga falla, queda en pantalla el formulario anterior bajo la selección nueva (y "Publicar" escribe en la sede anterior). | `dms-list-content.component.ts:849-862`; `document-content-templates.facade.ts:82-87,105-122` |
| S21 | 🟡 Baja | **Profesional asoma en el piloto.** El editor ofrece Contrato/Certificado Profesional para Conductores Chillán (no hay guard de fase piloto); el DMS lista documentos de matrículas profesionales; al generar un certificado B se notifica "ya está disponible en tu portal", pero el portal del alumno está bloqueado. | `dms-list-content.component.ts:841-845`; `certificacion-clase-b.facade.ts:132-150`; `app.routes.ts:706` |
| S22 | 🟡 Baja | **Descargar no descarga.** En el visor modal ("Ver" de las listas) solo hay botón de descarga si el formato no es soportado; en el visor del drawer, `download` sobre una URL de otro dominio abre una pestaña en vez de descargar. | `dms-viewer-modal.component.ts:45-70`; `dms-doc-preview-drawer.component.ts:96-106` |
| S23 | 🟡 Baja | **Certificación: detalles de UI.** El filtro Estado no puede volver a "Todos" (sin opción ni botón de limpiar); la columna Prácticas se pinta verde aunque diga 0/12; la confirmación de email no avisa si el alumno no tiene correo. | `certificacion-clase-b-content.component.ts:99-108,239-241,339-346` |
| S24 | 🟡 Baja | **El DMS muestra el contrato generado, no el firmado.** La vista toma `digital_contracts.file_url`; el escaneo firmado (`signed_contract_url`) no aparece. Tampoco aparecen el certificado ni el carnet PDF. | `20260404120000…:224-237` |
| S25 | 🟡 Baja | **Secretaria: sin recarga al cambiar de sede** (con grant multi-sede) en DMS y Certificados; en admin, cambiar de sede rápido en Certificación no tiene protección contra respuestas fuera de orden. | `secretaria-documentos.component.ts:37-39`; `secretaria-certificados.component.ts` (`ngOnInit`); `certificacion-clase-b.facade.ts:99-108` |
| S26 | 🟡 Baja | **Permisos más amplios que la UI.** Por API la secretaria puede borrar documentos de alumno y contratos de su sede (la UI lo esconde); `send-certificate-email` solo exige sesión (cualquier usuario dispara correos de cualquier matrícula); los modos `preview`/`sample` del certificado devuelven el texto de las plantillas (RLS admin-only) a cualquiera. Límite de archivo: 5 MB en la app vs 10 MB en el bucket; el tipo se valida por el MIME que declara el navegador (según la extensión). | `20260417000001…:17-38`; `send-certificate-email/index.ts:117-131`; `generate-certificate-b-pdf/index.ts:79-81,321-359`; `document-file-validation.util.ts:1-2,10-13`; `20260310130000…:17` |

---

## 2. Datos de prueba necesarios

Preparar antes de ejecutar (idealmente con el seed de spec `0008-i` + ajustes). Anotar aquí el
nombre/RUT/id real usado para cada uno.

| Dato | Cómo debe estar | Para qué | Dato usado |
|---|---|---|---|
| D1 | Alumno Clase B, 1 matrícula, con cédula, foto y contrato | Caso "todo OK" en DMS | |
| D2 | Alumno con 2 matrículas (Clase B + otra, idealmente en sedes distintas), documentos en ambas | Documentos por matrícula | |
| D3 | Alumno matriculado **sin ningún documento** (ni contrato) | S7 | |
| D4 | Alumno cuya `users.branch_id` es A y su matrícula es de la sede B | S19 | |
| D5 | Instructor sede A con documentos; instructor sede A sin documentos; instructor sede B | Pestaña Instructores | |
| D6 | Archivos: PDF 1 MB; JPG; PNG; WEBP; PDF 4,9 MB; PDF 5,1 MB; PDF 9 MB; PDF 12 MB; `.docx`; `.exe` renombrado a `.pdf`; foto HEIC de celular; `.PDF` en mayúscula; nombre con tildes, ñ y espacios; archivo de 0 bytes; nombre muy largo | Validación de archivos | |
| D7 | 1 documento institucional con `branch_id = NULL` y 1 con `branch_id` de la sede A | S5 | |
| D8 | Clase B con 12/12 prácticas **con nota** (vía seed/SQL si en el piloto no hay otra forma) y email | Certificado elegible | |
| D9 | Clase B con la clase #12 marcada completada pero **sin notas** (escenario real del piloto) | Qué ve la secretaria | |
| D10 | Clase B con 5/12 prácticas | Bloqueo / bypass admin | |
| D11 | Clase B elegible **sin email** | Email / masivo | |
| D12 | Clase B con certificado ya generado y enviado por email | Reenviar, historial | |
| D13 | Matrícula "Refuerzo Clase B" | No debe aparecer en Certificación | |
| D14 | Matrícula Profesional con certificado generado | Bloqueo piloto (S4, S21) | |
| D15 | Alumnos y certificados en sede A y sede B | Aislamiento entre sedes | |
| D16 | Clase B 12/12 con saldo pendiente | Decisión: ¿certificar con deuda? | |
| D17 | Alumno con tildes, ñ y nombre muy largo | PDF, correo, ZIP | |
| D18 | Clase B con prácticas agendadas a las 20:00 o más tarde (horario de invierno) | S11 (fechas UTC) | |
| D19 | Clase B con matrícula `completed` | Aparece en Certificación | |

**Cuentas:** admin; secretaria sede A; secretaria sede B; secretaria con grant multi-sede
(`can_access_both_branches = true`); secretaria sin sede asignada; **cuenta de alumno y de
instructor** (sus portales están bloqueados, pero la sesión sirve para probar las edge functions
por API en P05-P08).

---

## 3. Casos

### A. Carga y acceso (Repositorio de Documentos)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Admin entra a `/app/admin/documentos` | Skeleton → 4 pestañas (Alumno, Instructores, Escuela, Plantillas). Consola sin errores, red sin 4xx/5xx | ✓ | |
| A02 | Secretaria entra a `/app/secretaria/documentos` | 3 pestañas (sin Plantillas), solo datos de su sede | ✓ | |
| A03 | Secretaria escribe la URL `/app/admin/documentos` | Acceso denegado | ✓ | |
| A04 | Salir y volver a la pantalla | Datos al instante, sin skeleton (refresco en segundo plano) | — | |
| A05 | Recargar con F5 en cada pestaña | Carga normal; ¿vuelve a "Documentos del Alumno"? (la pestaña no se recuerda) | ✓ | |
| A06 | Menú lateral → Documentos (admin y secretaria) | Llega a la pantalla correcta | ✓ | |
| A07 | Carga con la red cortada **(§4)** | Mensaje de error claro, no "Sin documentos aún" (S16) | — | |
| A08 | Botón "Subir documento" del hero en cada pestaña | Abre el drawer en el modo de esa pestaña; en Plantillas no hay botón | ✓ | |
| A09 | Desktop 1440 px | App-like: el documento no scrollea, las listas scrollean por dentro | ✓ | |

### B. Documentos del Alumno (lista y "Últimos subidos")

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| B01 | Lista con D1 | 1 fila: nombre, RUT, N° Mat., badge "N docs", "Ver →" | ✓ | |
| B02 | D2 (2 matrículas) | 2 filas, cada una con su N° de matrícula y su propio conteo (AC1 `0007-m`) | ✓ | |
| B03 | D3 (sin documentos) | No aparece en la lista (así está programado) | ✓ | |
| B04 | Orden | Por apellido paterno, materno y nombre, igual que la Base de Alumnos | — | |
| B05 | Buscar por nombre, apellido, con y sin tilde | Encuentra; sin tilde hoy probablemente **no** encuentra ("jose" → José) — anotar | ✓ | |
| B06 | Buscar por RUT con y sin puntos/guion | Encuentra en los formatos habituales — anotar cuáles fallan | ✓ | |
| B07 | Búsqueda sin resultados | "No se encontraron resultados · Prueba con otro nombre o RUT." con ícono de lupa | ✓ | |
| B08 | Botón X del buscador | Limpia y vuelve la lista completa | ✓ | |
| B09 | > 10 filas | Paginador de 10; al buscar vuelve a la página 1 sin quedar en una página vacía | — | |
| B10 | Admin "Todas las sedes" | Columna Sede visible con la sede **de la matrícula** | ✓ | |
| B11 | Admin elige una sede / secretaria | Sin columna Sede | ✓ | |
| B12 | "Últimos subidos" | Los 5 documentos más recientes: nombre de archivo (tooltip si es largo), alumno · tipo · fecha | ✓ | |
| B13 | Fecha en "Últimos subidos" de un documento subido después de las 21:00 | Fecha de Chile (hoy es `slice(0,10)` de UTC → día siguiente) | — | |
| B14 | Botón "Ver" en "Últimos subidos" | Abre el visor con el archivo correcto | ✓ | |
| B15 | Botón "Eliminar" en "Últimos subidos" | Solo admin lo ve; pide confirmación (ver F) | ✓ | |
| B16 | Total de documentos del sistema > 1.000 **(§4)** | Todos los alumnos y conteos correctos (S12) | — | |
| B17 | D4 (sede del alumno ≠ sede de la matrícula) **(§4)** | Aparece en la sede de la matrícula, no en la del alumno (S19) | — | |
| B18 | Nombre de archivo muy largo | Truncado con tooltip, sin romper la fila | — | |

### C. Detalle por matrícula (drawer del alumno)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | "Ver →" en D1 | Drawer con el nombre del alumno, subtítulo "Matrícula #N — Sede" y sus documentos | ✓ | |
| C02 | D2: "Ver →" en cada una de sus 2 filas **(§4)** | Cada drawer muestra solo los documentos de esa matrícula (AC2 `0007-m`) | ✓ | |
| C03 | Cada documento | Nombre de archivo, tipo legible (no la clave interna) y fecha | ✓ | |
| C04 | Documento con clave legacy (`foto_carnet`, `cedula`, `hoja_vida`) | Etiqueta "(legacy)" | — | |
| C05 | Contrato de la matrícula | Aparece como "Contrato"; ¿es el generado o el firmado? (S24) | — | |
| C06 | Certificado Clase B y carnet PDF de la matrícula | Hoy no aparecen en el DMS — confirmar si se espera | — | |
| C07 | Skeleton mientras carga | 4 bloques; sin parpadeo del estado vacío | — | |
| C08 | "Subir documento" desde este drawer **(§4)** | Se apila el drawer de subida con alumno y matrícula ya resueltos (sin selectores); al guardar vuelve a este drawer y el documento aparece (AC3 `0007-m`) | ✓ | |
| C09 | Abrir el drawer de un alumno, cerrarlo y abrir el de otro | No se ven por un instante los documentos del primero | — | |
| C10 | Papelera (admin) solo en documentos que no son carnet | Presente en cada documento para admin; ausente para secretaria | ✓ | |

### D. Subir documento de alumno

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | Abrir el drawer desde el botón general | Selectores Alumno y Tipo, zona de arrastre "PDF, JPG, PNG — máx. 5 MB"; "Subir documento" deshabilitado | ✓ | |
| D02 | Buscar en el selector de alumno | Filtra por nombre | ✓ | |
| D03 | Buscar a D3 (sin documentos) en el selector **(§4)** | Debería aparecer; hoy no aparece (S7) | ✓ | |
| D04 | Elegir un alumno con 1 matrícula | La matrícula se resuelve sola, sin segundo selector | ✓ | |
| D05 | Elegir D2 (2 matrículas) | Aparece el selector "Matrícula *" con "Curso · #N"; el botón sigue deshabilitado hasta elegir | ✓ | |
| D06 | Elegir otro alumno después de haber elegido matrícula | Se limpia la matrícula anterior | — | |
| D07 | Tipos ofrecidos | Contrato, Foto (Carnet), Cédula, Certificado Médico, Hoja de Vida, Autorización Notarial, Cert. Antecedentes; sin los tipos ya subidos a **esa** matrícula | ✓ | |
| D08 | Tipo ya subido en la matrícula 1 de D2, subir a la matrícula 2 | El tipo sí se ofrece para la matrícula 2 | — | |
| D09 | Archivos válidos: PDF, JPG, PNG, WEBP (D6) | Se aceptan, muestran nombre y tamaño | ✓ | |
| D10 | `.docx`, HEIC, `.exe` renombrado a `.pdf` **(§4)** | Los 2 primeros: "Solo se permiten archivos PDF, JPG, PNG o WEBP."; anotar qué pasa con el `.exe` renombrado | ✓ | |
| D11 | PDF de 4,9 MB y de 5,1 MB | El primero pasa; el segundo: "El archivo no puede superar los 5 MB." | ✓ | |
| D12 | Archivo de 0 bytes | ¿Se acepta? No debería | — | |
| D13 | Elegir un archivo válido y después uno inválido **(§4)** | El error se muestra, pero **el archivo válido anterior sigue seleccionado** y se sube si presionas "Subir" — confirmar | — | |
| D14 | Arrastrar y soltar un archivo | Borde resaltado al arrastrar; mismo comportamiento que el clic | — | |
| D15 | Arrastrar 2 archivos a la vez | Toma solo el primero, sin avisar — confirmar si es aceptable | — | |
| D16 | Subir correctamente **(§4)** | Toast "Documento subido", drawer se cierra, fila del alumno suma 1 y aparece en "Últimos subidos" | ✓ | |
| D17 | Doble clic rápido en "Subir documento" | Una sola subida (botón con spinner deshabilitado) | — | |
| D18 | Nombre de archivo con tildes, ñ y espacios | Se sube y se muestra con el nombre original | — | |
| D19 | Falla de red durante la subida | Error en la tarjeta roja del drawer, el drawer no se cierra | — | |
| D20 | "Cancelar" | Cierra sin subir; si venía del drawer del alumno, vuelve a él | ✓ | |
| D21 | Subir el mismo tipo que alguien acaba de subir en otra sesión | ¿Queda duplicado o da error? (hay restricción única en `student_documents`) — anotar el mensaje | — | |

### E. Certificado médico (Ley 21.719, Art. 16)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | Tipo = Certificado Médico | Aparece el aviso "Dato sensible de salud" con casilla **no** marcada y el botón "No autoriza" | ✓ | |
| E02 | Sin marcar la casilla | "Subir documento" deshabilitado | ✓ | |
| E03 | Marcar y subir **(§4)** | Queda registrado el consentimiento y luego sube el archivo | ✓ | |
| E04 | "No autoriza" | Toast "Negativa registrada", no se sube nada, queda constancia | ✓ | |
| E05 | Marcar la casilla, cambiar a otro tipo y volver a Certificado Médico | ¿La casilla sigue marcada? No debería (consentimiento por acto afirmativo) | — | |
| E06 | Consentimiento registrado pero la subida falla (red cortada después de marcar) | Queda un consentimiento sin documento — anotar; decidir si es aceptable | — | |
| E07 | "No autoriza" sin haber elegido matrícula | Deshabilitado | — | |

### F. Eliminar y reemplazar

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | Admin elimina un documento desde el drawer del alumno | Confirmación "¿Estás seguro…?" → desaparece, conteo baja en 1 | ✓ | |
| F02 | Admin elimina desde "Últimos subidos" | Confirmación "…no se puede deshacer" → desaparece | ✓ | |
| F03 | Cancelar la confirmación | No borra nada | ✓ | |
| F04 | Eliminar el **contrato** de una matrícula | Hoy se permite (borra la fila de `digital_contracts`). **Decisión:** ¿se puede borrar un contrato firmado? | — | |
| F05 | Después de eliminar, el archivo en Storage **(§4)** | Debería borrarse; hoy queda (S9) | — | |
| F06 | Falla al eliminar (red cortada) | Toast de error; hoy solo `console.error` (S16) | — | |
| F07 | Secretaria: botones de eliminar | No aparecen en ningún lugar (drawers, "Últimos subidos", Escuela) | ✓ | |
| F08 | Reemplazar una cédula mal escaneada (secretaria) **(§4)** | Hoy no hay forma (S8) — **decisión** de flujo | — | |
| F09 | Reemplazar como admin: eliminar y volver a subir | El tipo vuelve a aparecer en el selector; el documento nuevo queda en la misma matrícula | — | |
| F10 | Eliminar el último documento de un alumno | La fila desaparece de la lista | — | |

### G. Ver y descargar (visor)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| G01 | Clic en un PDF dentro del drawer del alumno | Se apila el visor con el PDF; "Cargando documento…" mientras firma la URL | ✓ | |
| G02 | Clic en una imagen (JPG/PNG/WEBP) | Imagen completa, sin deformar ni scroll innecesario | ✓ | |
| G03 | Botón "Volver" del drawer | Vuelve a la lista del alumno sin cerrar el panel (UAT 2026-08-31) | ✓ | |
| G04 | "Descargar" en el visor del drawer | Descarga el archivo con su nombre; hoy probablemente abre una pestaña (S22) | — | |
| G05 | "Ver" desde "Últimos subidos" / Escuela (visor modal) | Abre el visor; ¿hay forma de descargar un PDF o una imagen? (S22) | — | |
| G06 | Archivo cuyo nombre original no tiene extensión | "Formato no soportado · Este documento debe ser descargado" | — | |
| G07 | Archivo borrado de Storage pero con fila en BD | Toast "No se pudo cargar la vista previa…" / "No se pudo abrir el documento" | — | |
| G08 | Dejar el visor abierto > 1 hora y recargar el iframe | La URL firmada vence (TTL 1 h) — anotar qué ve el usuario | — | |
| G09 | Copiar la URL firmada y abrirla en una ventana privada | Funciona hasta que vence (es el diseño); **nunca** una URL pública permanente | — | |
| G10 | PDF grande (4,9 MB) | Carga en un tiempo razonable | — | |

### H. Documentos de Instructores

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| H01 | Pestaña Instructores (admin "Todas") | Todos los instructores, **incluidos los sin documentos** (0 docs), con N° licencia y Sede (AC-E2 `0003-m`) | ✓ | |
| H02 | Secretaria sede A | Solo instructores de su sede (AC5 `0003-m`) | ✓ | |
| H03 | Sin instructores en la sede | "Sin instructores · Los instructores de esta sede aparecerán aquí." | — | |
| H04 | "Ver →" | Drawer con sus documentos: tipo y fecha. **AC2 pide también el estado (aprobado/pendiente) — hoy no se muestra** | ✓ | |
| H05 | Subir documento de instructor (desde el drawer y desde el botón general) **(§4)** | Tipos del enum de `0003-m`; sin los ya subidos; el nuevo aparece en el drawer y el conteo sube | ✓ | |
| H06 | Validación de archivos | Igual que D09-D13 | — | |
| H07 | Ver un documento del instructor | Abre el archivo real vía URL firmada (AC4 `0003-m`) | ✓ | |
| H08 | Eliminar (admin) / secretaria | Admin con confirmación; secretaria sin botón (UAT 2026-08-31) | ✓ | |
| H09 | Abrir "Documentos" desde Ver/Editar Instructor | Se apila sobre ese drawer y "Volver" regresa a él | — | |
| H10 | Nombre del instructor | Nombre + apellidos, sin espacios sobrantes si falta el materno | — | |

### I. Documentos de la Escuela

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| I01 | Lista con D7 | Nombre, tipo · descripción, "Subido el FECHA por NOMBRE" | ✓ | |
| I02 | Secretaria sube un documento institucional **(§4)** | Aparece en su lista y en la del admin (S5) | ✓ | |
| I03 | Admin con una sede elegida sube uno | Aparece en esa sede (S5) | ✓ | |
| I04 | "Subido por" | Nombre real de quien subió; hoy probablemente "Sistema" (S6) | ✓ | |
| I05 | Tipos | Factura Folios, Resolución MTT, Decreto, Otro; se pueden repetir | — | |
| I06 | Descripción opcional vacía y larga | Sin "null"; la larga no rompe la fila | — | |
| I07 | ¿Para qué sede queda un documento subido? | Hoy siempre "ambas sedes" (NULL). **Decisión:** ¿debe quedar de la sede de quien sube? | — | |
| I08 | Eliminar (admin) | Confirmación y desaparece; secretaria sin botón | ✓ | |
| I09 | Lista vacía | "Sin documentos institucionales · Sube las facturas…" | — | |

### J. Editor de plantillas (solo admin)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| J01 | Abrir Plantillas | Se elige sola la primera sede y "Contrato Clase B"; secciones PRIMERO…SEXTO con contador y placeholders (AC1, AC7) | ✓ | |
| J02 | Tipos para Autoescuela Chillán | Solo Contrato y Certificado Clase B (AC8) | ✓ | |
| J03 | Tipos para Conductores Chillán | Hoy aparecen también Contrato/Certificado Profesional — **decisión piloto** (S21) | — | |
| J04 | Cambiar de sede estando en un tipo Profesional | Vuelve a "Contrato Clase B" | — | |
| J05 | Certificado Clase B | 8 secciones (Encabezado ×3, Introducción, Cuerpo, Cierre, Firma ×2); Cuerpo muestra `{{fechaInicio}}` y `{{fechaFin}}` | ✓ | |
| J06 | Pasar el mouse sobre un placeholder | Tooltip en español ("Saldo pendiente de pago"…) | — | |
| J07 | Escribir más del límite | Contador rojo + "Excede el límite sugerido por N caracteres…" (AC5); ¿"Publicar" sigue permitido? (hoy sí) | ✓ | |
| J08 | "Vista previa" | PDF con el borrador (sin guardar) y el alumno ficticio "ALUMNO DE PRUEBA EJEMPLO" (AC2); spinner solo en ese botón | ✓ | |
| J09 | "Ver documento actual" | PDF con lo **publicado**, no con el borrador (AC-E2) | ✓ | |
| J10 | Publicar **(§4)** | Toast "Plantilla publicada…"; al recargar la página el texto nuevo sigue ahí (AC3) | ✓ | |
| J11 | Borrar un placeholder o escribirlo mal (`{{saldopendiente}}`) y ver la vista previa | El PDF se genera con un hueco en ese lugar, sin error (AC-E3) | — | |
| J12 | Dejar una sección vacía y publicar **(§4)** | El documento real no debe salir en blanco en esa parte (S10) | — | |
| J13 | Editar, cambiar de tipo sin publicar y volver **(§4)** | ¿Avisa que se pierden los cambios? Hoy se pierden sin aviso (S20) | — | |
| J14 | Editar, ir a otra pestaña del DMS y volver | Los cambios siguen (mismo componente) | — | |
| J15 | Editar, salir de Documentos y volver | Hoy se pierden sin aviso (S20) | — | |
| J16 | Falla la carga (red cortada al cambiar de sede) **(§4)** | Toast "Error al cargar la plantilla"; no debe quedar el texto de la sede anterior bajo la nueva (S20) | — | |
| J17 | Falla la vista previa | Toast "Error al generar la vista previa"; el botón vuelve a la normalidad | — | |
| J18 | Publicar sin haber hecho vista previa | Hoy se permite. **Decisión:** ¿exigir vista previa? (AC-E3 la llama "obligatoria") | — | |
| J19 | Tildes, ñ, comillas y saltos de línea en una cláusula | Se ven bien en el PDF (fuente WinAnsi) | — | |
| J20 | Secretaria: pestaña Plantillas | No existe (AC4) | ✓ | |

### K. Efecto de las plantillas en los documentos reales

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | Cambiar el Cierre del Certificado Clase B de la sede A, publicar y generar un certificado real de D8 **(§4)** | El PDF real trae el cierre nuevo (AC3/AC6) | — | |
| K02 | El mismo cambio en la sede A | Un certificado de la sede B **no** cambia | — | |
| K03 | Cambiar QUINTO del contrato y matricular un alumno nuevo (con `023`) | El contrato nuevo trae el texto nuevo con valor, descuento, pagado y saldo correctos | — | |
| K04 | Contratos ya generados antes del cambio | No cambian (el PDF ya existe) — confirmar que es lo esperado | — | |
| K05 | Datos interpolados en el certificado | Nombre en mayúsculas (apellidos + nombres), RUT, fechas de la primera y la última práctica, "Chillán, D de MES de AAAA" | — | |
| K06 | Encabezado y firma por sede | Autoescuela Chillán y Conductores Chillán con su propio nombre, dirección y RUT; el logo es el mismo para ambas (S13) — **decisión** | — | |
| K07 | Datos interpolados en el contrato | Nombre, RUT, dirección, teléfono, curso, sede y montos correctos; emailContacto y URL de política de la sede correcta | — | |

### L. Certificación Clase B — lista y elegibilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| L01 | Admin entra a `/app/admin/certificacion` | Hero "Gestión de Certificados" con 4 KPIs, banner "Vista admin…", tabla | ✓ | |
| L02 | Secretaria entra a `/app/secretaria/certificados` | Banner "Vista secretaría: solo … habilitados (12/12)" | ✓ | |
| L03 | Secretaria escribe `/app/admin/certificacion` | Acceso denegado | ✓ | |
| L04 | Qué alumnos ve el admin | Clase B activos y completados de la sede, incluidos D9 y D10; **no** D13 (refuerzo) ni D14 (Profesional) | ✓ | |
| L05 | Qué alumnos ve la secretaria | Solo los con `certificate_enabled` (clase #12 completada): D8, D9; no D10 | ✓ | |
| L06 | **Escenario real del piloto** (nadie puso notas) — secretaria **(§4)** | D9 aparece con "0/12" y "Generar" deshabilitado con el tooltip "Faltan prácticas por completar (0/12)". No hay forma de certificar desde la secretaria — **decisión de piloto** | ✓ | |
| L07 | Escenario piloto — admin con D9 **(§4)** | "Generar" abre la fila amarilla "Prácticas incompletas… ¿Confirmar de todos modos?"; al confirmar se genera con bypass | ✓ | |
| L08 | Columna Prácticas | Cuenta las clases con nota; hoy siempre en verde aunque sea 0/12 (S23) | — | |
| L09 | Columna Fecha Término | Fecha de la última práctica en hora de Chile (hoy UTC) | — | |
| L10 | N° Certificado | `CERT-AAAA-NNNN` solo si hay PDF; "—" si no | ✓ | |
| L11 | Orden | Pendientes primero, luego por nombre | — | |
| L12 | KPIs | Total, Generados, Pend. Generación (hoy incluye no elegibles), Pend. Envío — coinciden con la tabla | ✓ | |
| L13 | Buscar por nombre sin tilde y por RUT con y sin puntos | Encuentra en todos | ✓ | |
| L14 | Filtro Estado: Generados → Pendientes → volver a Todos | Hoy no se puede volver a "Todos" sin recargar (S23) | — | |
| L15 | Filtro sin resultados | "No hay resultados para este filtro" | ✓ | |
| L16 | Sin alumnos | "No hay alumnos elegibles para certificación…" | — | |
| L17 | > 10 alumnos | Paginación "X–Y de N alumnos"; filtrar vuelve a la página 1 | — | |
| L18 | D16 (12/12 con deuda) | Hoy se puede certificar. **Decisión:** ¿bloquear con motivo "pago pendiente"? (S14) | — | |
| L19 | Clase #12 completada con clases 3 y 7 aún pendientes | La secretaria la ve habilitada en la lista pero el botón queda bloqueado — anotar si confunde (S14) | — | |

### M. Generar, ver, email y reenviar

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| M01 | Generar D8 (elegible) **(§4)** | Spinner solo en esa fila → toast "Certificado generado correctamente" → visor con el PDF → la fila pasa a "Generado" con folio | ✓ | |
| M02 | Contenido del PDF de D8 | Ver K05; fechas correctas en hora de Chile (S11) | — | |
| M03 | Generar D10 como admin sin confirmar ("Cancelar") | No se genera nada | ✓ | |
| M04 | Bypass admin en D9 sin clases marcadas "completadas" **(§4)** | El PDF no debe salir con "__________" en las fechas (S11) | — | |
| M05 | Mientras genera, clic en "Generar" de otra fila | Deshabilitado (una generación a la vez) | — | |
| M06 | "Ver" en una fila generada | Abre el PDF guardado vía URL firmada | ✓ | |
| M07 | "Email" en D8 **(§4)** | Fila azul "Se enviará el certificado de X al correo Y"; "Confirmar envío" → toast "Correo enviado a Y"; el botón pasa a "Reenviar"; llega el correo con el PDF adjunto | — | |
| M08 | Contenido del correo | Asunto con folio, nombre, PDF adjunto; marca de la sede correcta (hoy "Conductores Chillán" para todas, S13) | — | |
| M09 | "Reenviar" en D12 | Aviso "(ya fue enviado anteriormente)"; se envía de nuevo y queda otro registro en el historial | — | |
| M10 | "Email" en D11 (sin correo) | La confirmación no muestra correo; al confirmar el error debe decir "El alumno no tiene email registrado" (hoy genérico, S16) | — | |
| M11 | Cancelar la confirmación de email | No se envía | ✓ | |
| M12 | SMTP caído o mal configurado | Toast de error; el estado no cambia a "enviado" | — | |
| M13 | Corregir la plantilla o el nombre de un alumno ya certificado | ¿Cómo se reemite? Hoy no hay botón (S17) — **decisión** | — | |
| M14 | Dos admins generan el mismo alumno (o 2 alumnos) a la vez **(§4)** | Folios distintos y correlativos; ninguna fila "Generado" sin folio (S18) | — | |
| M15 | Notificación al alumno | Se crea "Tu certificado está listo…"; con el portal del alumno bloqueado en el piloto — **decisión** (S21) | — | |
| M16 | Nombre con tildes/ñ (D17) | Bien en el PDF, en el correo y en el nombre del archivo adjunto | — | |

### N. Acciones masivas, exportar e historial

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| N01 | "Generar Pendientes (N)" → drawer | Lista de nombres y botón "Generar N certificados" | ✓ | |
| N02 | Generar pendientes en el escenario piloto **(§4)** | Hoy todos fallan con "0 generados, N con error" sin decir por qué (S15) | — | |
| N03 | Generar pendientes con D8 + D10 mezclados | Debería generar solo D8 y explicar por qué D10 no | — | |
| N04 | Cerrar el drawer mientras genera | ¿Sigue generando? La pantalla queda coherente al terminar | — | |
| N05 | "Enviar Emails Masivo (N)" | Solo generados sin enviar y con email; D11 no aparece (¿debería avisarse?) | ✓ | |
| N06 | Envío masivo con 1 falla | Toast "X enviados, 1 fallido · Fallaron: nombre" | — | |
| N07 | "Exportar todos" (admin en una sede) **(§4)** | Descarga `certificados-clase-b-AAAA-MM-DD.zip` con los PDF de esa sede, nombres `CERT-AAAA-NNNN_APELLIDOS_NOMBRES.pdf` | ✓ | |
| N08 | Exportar sin certificados | Toast "No hay certificados generados para exportar" | ✓ | |
| N09 | Exportar como secretaria | Solo su sede | ✓ | |
| N10 | Exportar como admin en "Todas" | Ambas sedes; nombres de archivo sin colisiones | — | |
| N11 | "Historial de emisiones" | Drawer con acción (Generado / Email enviado), alumno, fecha dd/MM/aaaa HH:mm (hora de Chile) y "Por NOMBRE" | ✓ | |
| N12 | Certificado generado con bypass o por API | ¿Queda "Por —"? Anotar | — | |
| N13 | > 50 registros | Hoy solo trae los 50 últimos — confirmar si es aceptable | — | |
| N14 | Historial por sede | Solo registros de los alumnos de la sede actual | — | |

### O. Sedes y roles (pantalla)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| O01 | Admin cambia de sede en Documentos **(§4)** | Recarga sola; alumnos, instructores y documentos institucionales de esa sede | ✓ | |
| O02 | Admin cambia de sede en Certificación | Recarga con skeleton, solo esa sede | ✓ | |
| O03 | Cambio rápido A→B→A en Certificación (Slow 3G) | Termina en A sin mezclar alumnos (S25) | — | |
| O04 | Secretaria con grant cambia de sede (DMS y Certificados) **(§4)** | Recarga sin salir de la pantalla (S25) | — | |
| O05 | Secretaria sin sede asignada | Listas vacías, nunca todas las sedes | — | |
| O06 | Admin "Todas" en Documentos del Alumno | Suma de ambas sedes, con columna Sede | ✓ | |

### P. Seguridad (RLS, Storage y edge functions)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| P01 | Secretaria A lista archivos de Storage de la sede B **(§4)** | Lista vacía / error (S1) | ✓ | |
| P02 | Secretaria A firma la URL de una cédula de la sede B **(§4)** | Error; nunca una URL válida (S1) | ✓ | |
| P03 | Secretaria A sobrescribe un archivo de la sede B **(§4)** | Rechazado (S2) — **ejecutar solo con un archivo de prueba** | — | |
| P04 | Secretaria A lee `v_dms_student_documents` / `student_documents` de la sede B por REST **(§4)** | 0 filas | ✓ | |
| P05 | Alumno o instructor logueado llama a `generate-certificate-b-pdf` con un `enrollment_id` elegible **(§4)** | 401/403, nunca un PDF (S3) | ✓ | |
| P06 | Secretaria A genera el certificado de un alumno de la sede B por API | 403 (S3) | ✓ | |
| P07 | Secretaria pide `export-certificates-zip` sin `branch_id` y con `type: 'professional'` **(§4)** | Solo su sede y nunca Profesional (S4) | ✓ | |
| P08 | Alumno logueado llama a `send-certificate-email` con otro `enrollment_id` | 403 (S26) | — | |
| P09 | Secretaria manda `force: true` al generar D10 | 400 "no cumple el mínimo…" (el bypass es solo admin, `fix-011-i`) | ✓ | |
| P10 | Secretaria borra un `student_documents` de su sede por REST | Hoy lo permite la RLS (la UI lo esconde) — **decisión** (S26) | — | |
| P11 | Secretaria lee `document_templates` por REST | 0 filas (RLS admin-only) | ✓ | |
| P12 | Secretaria o alumno pide `generate-certificate-b-pdf` con `mode: 'sample'` | Hoy devuelve el PDF con el texto de la plantilla — **decisión** (S26) | — | |
| P13 | Bucket `documents` | Privado: una URL `/object/public/documents/…` responde 400/404 | ✓ | |
| P14 | Subir directo a Storage un archivo de 9 MB o un `.docx` por API | El bucket acepta hasta 10 MB y solo PDF/JPG/PNG/WEBP (anotar) | — | |

### Q. Tiempo real y 2 sesiones

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| Q01 | 2 sesiones: la secretaria sube un documento, el admin mira la lista **(§4)** | Hoy no hay tiempo real: aparece solo al volver a entrar o recargar — **confirmar si es aceptable** | — | |
| Q02 | 2 sesiones: el admin elimina un documento que la secretaria tiene abierto en el visor | La secretaria no rompe la pantalla; al recargar ya no está | — | |
| Q03 | 2 sesiones: el admin publica una plantilla mientras otro admin la edita | El segundo que publica pisa al primero sin aviso — **decisión** | — | |
| Q04 | 2 sesiones: secretaria y admin generan/envían el mismo certificado **(§4)** | Sin duplicar folio; el historial refleja ambas acciones | — | |

### R. Piloto: Profesional bloqueado

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| R01 | Admin abre `/app/admin/clase-profesional/certificados` por URL | Bloqueado por la fase piloto | ✓ | |
| R02 | Secretaria abre `/app/secretaria/profesional/certificados` por URL | Bloqueado | ✓ | |
| R03 | Menú lateral | No hay entrada a certificados Profesional | ✓ | |
| R04 | Certificación Clase B | No aparece D14 | ✓ | |
| R05 | Plantillas de Conductores Chillán | ¿Deben verse los tipos Profesional en el piloto? (S21) | — | |
| R06 | DMS: documentos de matrículas profesionales | Hoy aparecen — **decisión** (S21) | — | |
| R07 | `export-certificates-zip` con `type: 'professional'` | Ver P07 (S4) | — | |

### S. Visual y accesibilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| S01 | Modo oscuro y claro en las 4 pestañas, drawers, visor y Certificación | Todo legible, incluidos badges, filas de confirmación y editor | ✓ | |
| S02 | 375 / 768 / 1440 px | Sin scroll horizontal; en angosto las columnas del DMS se apilan y Certificación pasa a tarjetas | ✓ | |
| S03 | Desktop con un drawer abierto | DMS apila sus columnas y Certificación cambia a tarjetas (container query) | — | |
| S04 | Tarjetas de Certificación | Mismos botones y confirmaciones que la tabla | — | |
| S05 | Solo teclado (Tab) | Se llega a todos los botones, selects y a la zona de arrastre; el foco se ve | — | |
| S06 | Zona de arrastre con teclado | Hoy es un `div` con clic: ¿se puede abrir el selector de archivo con Enter/Espacio? | — | |
| S07 | Tooltips en botones de solo ícono | Presentes (Eliminar) | — | |
| S08 | Animación de entrada | Sin parpadeos ni saltos | — | |

---

## 4. Casos con pasos numerados

### A07 — Error de carga visible

**Precondición:** sesión admin.
1. Abrir DevTools → Network → marcar "Offline".
2. Navegar a Documentos (o recargar si ya estás ahí).
3. Revisar cada pestaña cuando termine el skeleton.
4. Volver a "No throttling" y recargar.

**Esperado:** en el paso 3 un mensaje de error claro (no "Sin documentos aún" ni "Sin
instructores"). En el paso 4 todo carga normal. **Evidencia:** captura del paso 3 (S16).

### B16 — Más de 1.000 documentos

**Precondición:** base con > 1.000 filas en `v_dms_student_documents` (seed masivo) o, en su
defecto, > 1.000 alumnos.
1. Admin → Documentos → "Todas las sedes".
2. Anotar el total de filas (paginador) y el conteo de un alumno antiguo.
3. Contar en BD (SQL) cuántos documentos tiene ese alumno y cuántas matrículas tienen documentos.

**Esperado:** los números coinciden. Si faltan alumnos o los conteos son menores, S12 confirmada.

### B17 — Matrícula en una sede distinta a la del alumno

**Precondición:** D4 (alumno con `users.branch_id` = A, matrícula en B, con documentos).
1. Admin → sede A → Documentos del Alumno → buscar D4.
2. Admin → sede B → buscar D4.
3. Secretaria B → buscar D4.

**Esperado:** D4 aparece en la sede B (la de la matrícula) y no en la A. Anotar lo que pasa en
cada paso (S19).

### C02 — Alumno con 2 matrículas

**Precondición:** D2 con documentos distintos en cada matrícula (anotar cuántos en cada una).
1. Buscar D2 en Documentos del Alumno → verificar 2 filas con N° de matrícula distinto.
2. "Ver →" en la primera → verificar subtítulo "Matrícula #N1 — Sede" y solo sus documentos.
3. Cerrar. "Ver →" en la segunda → lo mismo con #N2.
4. Comparar con el conteo de cada fila.

**Esperado:** ningún documento aparece en ambas; los conteos coinciden con cada drawer.

### C08 — Subir desde el drawer de una matrícula

**Precondición:** D2, drawer de la matrícula #N2 abierto.
1. Clic en "Subir documento" (pie del drawer).
2. Verificar que no aparecen los selectores de alumno ni de matrícula.
3. Elegir tipo "Cédula de Identidad" y un PDF válido → "Subir documento".
4. Verificar el toast y que vuelves al drawer de #N2 con la cédula nueva.
5. Abrir el drawer de #N1.

**Esperado:** la cédula está solo en #N2. En Supabase Storage el archivo quedó bajo
`students/<id de #N2>/…`.

### D03 — Primer documento de un alumno sin documentos

**Precondición:** D3 (matriculado, 0 documentos).
1. Documentos del Alumno → botón "Subir documento".
2. En el selector de alumno, buscar a D3.

**Esperado:** D3 aparece y se le puede subir un documento. Si no aparece, S7 confirmada. Anotar
también por dónde sí se le puede subir (ficha del alumno).

### D10 — Archivos no permitidos

**Precondición:** archivos de D6.
1. Abrir "Subir documento" y elegir alumno y tipo.
2. Elegir el `.docx` → anotar el mensaje.
3. Elegir la foto HEIC → anotar.
4. Elegir el `.exe` renombrado a `.pdf` → anotar si lo acepta; si lo acepta, subirlo y tratar de
   verlo.
5. Elegir el PDF de 9 MB → anotar.

**Esperado:** 2, 3 y 5 muestran el error correspondiente y el botón no se habilita. En 4, anotar el
comportamiento (el navegador lo declara como PDF por la extensión) y si el visor lo muestra roto.

### D13 — Archivo inválido después de uno válido

1. Abrir "Subir documento", elegir alumno y tipo.
2. Elegir un PDF válido de 1 MB → se ve su nombre.
3. Elegir el PDF de 5,1 MB → aparece "El archivo no puede superar los 5 MB."
4. Revisar qué nombre de archivo muestra la zona de arrastre y si "Subir documento" está habilitado.
5. Si está habilitado, presionarlo.

**Esperado:** después del paso 3 no queda ningún archivo seleccionado y el botón está
deshabilitado. Si en el paso 5 se sube el PDF de 1 MB con el error a la vista, anotarlo como bug.

### D16 — Subida correcta de un documento de alumno

**Precondición:** secretaria sede A; D1 sin "Autorización Notarial".
1. Documentos del Alumno → anotar el conteo de D1.
2. "Subir documento" → alumno D1 → tipo "Autorización Notarial" → arrastrar un PDF de 1 MB.
3. Verificar nombre y tamaño en la zona de arrastre → "Subir documento".
4. Verificar spinner, toast "Documento subido" y que el drawer se cierra.
5. Verificar que el conteo de D1 subió en 1 y que el archivo encabeza "Últimos subidos".
6. Abrir el drawer de D1 → el documento → verificar que es el archivo subido.
7. Volver a abrir "Subir documento" con D1 → "Autorización Notarial" ya no se ofrece.

**Esperado:** como arriba, sin recargar la página. **Evidencia:** captura del paso 5.

### E03 — Certificado médico con autorización

**Precondición:** D1.
1. "Subir documento" → D1 → tipo "Certificado Médico".
2. Verificar el aviso y que el botón está deshabilitado.
3. Marcar la casilla → elegir un PDF → "Subir documento".
4. En BD, revisar la tabla de consentimientos: un registro de certificado médico `granted = true`
   para la matrícula de D1, con la fecha y hora de ahora.
5. Verificar que el documento aparece en el drawer de D1.

**Esperado:** consentimiento y documento registrados, en ese orden.

### F05 — El archivo se borra de Storage al eliminar

**Precondición:** admin; un documento de prueba subido (anotar su ruta en Storage desde el
dashboard de Supabase o desde la URL firmada).
1. Eliminar el documento desde el drawer del alumno.
2. En Supabase Storage, buscar la ruta anotada.
3. Con una sesión de secretaria, intentar firmar esa ruta (como en P02).

**Esperado:** el archivo ya no existe. Si sigue ahí y se puede firmar, S9 confirmada.

### F08 — Reemplazar una cédula (secretaria)

**Precondición:** secretaria; D1 ya tiene cédula.
1. Abrir el drawer de D1 → "Subir documento".
2. Revisar si "Cédula de Identidad" está en el selector de tipo.
3. Buscar cualquier otra forma de reemplazarla (menús, ficha del alumno).

**Esperado:** anotar el flujo real. Si la secretaria no puede corregir un documento mal subido,
se confirma S8 y se lleva a §5.

### H05 — Subir documento de instructor

**Precondición:** secretaria sede A; D5 (instructor de la sede A sin documentos).
1. Pestaña Instructores → verificar que el instructor sin documentos aparece con "0 docs".
2. "Ver →" → drawer vacío "Este instructor aún no tiene documentos." → "Subir documento".
3. Verificar que el instructor ya viene elegido y revisar la lista de tipos (enum de `0003-m`).
4. Tipo "Licencia Clase B" (o equivalente) + PDF → Subir.
5. Verificar que vuelves al drawer del instructor con el documento nuevo y que la fila dice "1 doc".
6. Desde el botón general "Subir documento" de la pestaña, elegir el mismo instructor → la
   licencia ya no se ofrece.
7. Buscar en el selector a un instructor de la sede B.

**Esperado:** pasos 1-6 como arriba; en el paso 7 el instructor de B no aparece.

### I02 — Documento institucional subido por la secretaria

**Precondición:** secretaria sede A; admin en otro navegador.
1. Secretaria → Documentos de la Escuela → "Subir documento" → tipo "Decreto", descripción
   "Prueba QA", PDF → Subir.
2. Verificar el toast y si aparece en su lista.
3. Admin con sede A elegida → Documentos de la Escuela.
4. Admin con "Todas las sedes".
5. En BD, revisar `school_documents.branch_id` y `uploaded_by` de la fila nueva.

**Esperado:** aparece en 2, 3 y 4 con "por NOMBRE DE LA SECRETARIA". Si solo aparece en 4 → S5; si
dice "por Sistema" o `uploaded_by` es null → S6.

### J10 — Publicar una plantilla

**Precondición:** admin; anotar el texto actual del Cierre del Certificado Clase B de la sede A.
1. Plantillas → sede A → Certificado Clase B.
2. Cambiar el Cierre a "Texto de prueba QA".
3. "Vista previa" → verificar el texto nuevo en el PDF.
4. "Ver documento actual" → verificar que todavía sale el texto **anterior**.
5. "Publicar" → toast.
6. "Ver documento actual" → ahora sale el texto nuevo.
7. Recargar la página y volver a Plantillas → sede A → Certificado Clase B.
8. **Restaurar** el texto original y publicar.

**Esperado:** como arriba, en cada paso.

### J12 — Sección vacía

**Precondición:** admin; una sede de prueba o, con cuidado, la sede A (anotar el texto original).
1. Plantillas → Certificado Clase B → borrar por completo "Firma — Cargo".
2. "Vista previa" → revisar la firma.
3. Publicar y generar un certificado real de prueba (K01).
4. Restaurar el texto y publicar.

**Esperado:** el certificado no sale con la firma incompleta (o el editor impide publicar una
sección vacía). Si sale en blanco, S10 confirmada. Repetir con una sede **sin** fila en
`document_templates` para confirmar AC-E1.

### J13 — Cambios sin publicar

1. Plantillas → Contrato Clase B → modificar PRIMERO.
2. Cambiar el tipo a Certificado Clase B.
3. Volver a Contrato Clase B.

**Esperado:** en el paso 2 un aviso de que hay cambios sin publicar. Si en el paso 3 el texto
volvió al original sin aviso, S20 confirmada.

### J16 — Falla la carga de una plantilla

**Precondición:** admin; 2 sedes.
1. Plantillas → sede A → Contrato Clase B → anotar el inicio de PRIMERO.
2. DevTools → Network → "Offline".
3. Cambiar la sede a B.
4. Revisar el toast y el texto que queda en pantalla.
5. Sin volver a conectar, clic en "Publicar".
6. Reconectar y recargar; revisar el contrato de la sede A y el de la B.

**Esperado:** en el paso 4, toast "Error al cargar la plantilla" y el editor vacío o bloqueado,
**nunca** el texto de la sede A bajo el selector de la sede B. En el paso 5 no debe publicarse nada
en la sede equivocada (S20).

### K01 — La plantilla publicada llega al certificado real

**Precondición:** D8 (elegible) en la sede A; admin.
1. Publicar un cambio visible en el Cierre (como J10).
2. Certificación → generar el certificado de D8.
3. Revisar el PDF.
4. Restaurar la plantilla.

**Esperado:** el PDF real de D8 trae el cierre nuevo, con nombre, RUT y fechas reales de D8.
**Nota:** si D8 ya tenía certificado, no hay botón para regenerarlo (S17) — usar otro alumno.

### L06 — Escenario piloto: la secretaria sin notas de práctica

**Precondición:** D9 (clase #12 marcada completada vía Asistencia, ninguna práctica con nota);
secretaria de su sede.
1. Entrar a Certificados.
2. Buscar D9 → anotar Prácticas, Estado y el estado del botón "Generar".
3. Pasar el mouse sobre "Generar".
4. Abrir "Generar Pendientes" y confirmar (ver N02).
5. Revisar KPIs.

**Esperado (hoy):** D9 aparece "0/12" (en verde, S23), "Generar" deshabilitado con el tooltip
"Faltan prácticas por completar (0/12)". **Sin una decisión de negocio (§5), ningún alumno se
puede certificar desde la secretaria durante el piloto.** Registrar capturas para la decisión.

### L07 — Escenario piloto: bypass del admin

**Precondición:** D9; admin.
1. Certificación → D9 → "Generar".
2. Verificar la fila amarilla "Prácticas incompletas: … lleva 0/12 … ¿Confirmar generación del
   certificado de todos modos?".
3. "Confirmar de todos modos".
4. Revisar en Network que el body lleva `force: true`.
5. Revisar el PDF (fechas, nombre, RUT, sede) y el historial de emisiones.

**Esperado:** se genera, queda "Generado" con folio y el historial dice "Generado · Por NOMBRE DEL
ADMIN". Revisar las fechas según M04.

### M01 — Generar un certificado elegible

**Precondición:** D8 (12/12 con nota) sin certificado; admin (repetir luego con la secretaria).
1. Certificación → buscar D8 → verificar "12/12", "Pendiente" y "Generar" habilitado.
2. Clic en "Generar" → no debe aparecer la fila amarilla de bypass.
3. Verificar "Generando…" solo en esa fila y los demás "Generar" deshabilitados.
4. Toast "Certificado generado correctamente" y visor con el PDF.
5. Cerrar el visor → la fila dice "Generado", folio `CERT-AAAA-NNNN`, botones Ver y Email.
6. KPIs: Generados +1, Pend. Generación −1, Pend. Envío +1.
7. Historial de emisiones: "Generado · D8 · Por NOMBRE".
8. En BD: `enrollments.certificate_b_pdf_url` con la ruta `certificates/<id>/…` y una fila en
   `certificates` con `issued_by` del usuario.

**Esperado:** como arriba, sin recargar.

### M04 — Fechas del certificado con bypass

**Precondición:** alumno como D10 con prácticas agendadas pero **sin** marcar como completadas.
1. Admin genera su certificado con bypass (como L07).
2. Revisar el párrafo "entre los días X al Y".
3. Repetir con D18 (prácticas a las 20:00 o más tarde) completadas y con nota: comparar las fechas
   del PDF con las de la Agenda.
4. Generar un certificado después de las 21:00 y revisar la línea "Chillán, D de MES".

**Esperado:** nunca "__________"; fechas y fecha de emisión en hora de Chile. Anotar cada
diferencia (S11).

### M07 — Envío del certificado por email

**Precondición:** D8 con certificado generado y con un correo al que tengas acceso.
1. "Email" → verificar la fila de confirmación con el correo correcto.
2. "Confirmar envío" → spinner en el botón → toast "Correo enviado a …".
3. Revisar la bandeja: asunto, nombre, folio, adjunto PDF que abre bien, marca de la sede.
4. Verificar que el botón dice "Reenviar", que el KPI "Pend. Envío" bajó y el historial.

**Esperado:** como arriba. La marca debe corresponder a la sede del alumno (S13).

### M14 — Generación simultánea

**Precondición:** 2 alumnos elegibles (D8 y otro) sin certificado; admin en 2 navegadores.
1. En A, preparar "Generar" de D8; en B, "Generar" del otro.
2. Clic en ambos al mismo tiempo.
3. Revisar ambas filas y la tabla `certificates` (folios).

**Esperado:** los 2 con folio distinto y correlativo. Si uno queda "Generado" con folio "—" o sin
fila en `certificates`, S18 confirmada.

### N02 — Generar pendientes en el piloto

**Precondición:** varios alumnos pendientes, ninguno con notas.
1. "Generar Pendientes (N)" → drawer → leer el texto "elegibles".
2. "Generar N certificados".
3. Revisar el toast final.

**Esperado:** que no se intente generar a los no elegibles, o que se explique el motivo por
alumno. Hoy se espera "0 generados, N con error" (S15).

### N07 — Exportar el ZIP de certificados

**Precondición:** admin con la sede A elegida; al menos 2 certificados generados en A y 1 en B;
D17 entre los de A.
1. "Exportar todos" → verificar "Exportando…" y que el botón no cambia de ancho.
2. Abrir el ZIP descargado.
3. Verificar que están todos los certificados de A, ninguno de B, y los nombres
   `CERT-AAAA-NNNN_APELLIDOS_NOMBRES.pdf` (D17 sin tildes ni ñ rotas).
4. Abrir 2 PDF del ZIP y compararlos con "Ver" en la pantalla.

**Esperado:** como arriba; toast "Certificados exportados".

### O01 — Admin cambia de sede en Documentos

**Precondición:** documentos en ambas sedes (D15).
1. "Todas" → anotar totales de cada pestaña.
2. Sede A → verificar que todo es de A (alumnos, instructores, escuela).
3. Sede B → lo mismo.

**Esperado:** recarga sola cada vez; los documentos institucionales "ambas sedes" deberían verse
en A y en B (S5).

### O04 — Secretaria con grant multi-sede

**Precondición:** secretaria con `can_access_both_branches = true`; datos en ambas sedes.
1. Entrar a Documentos → anotar los alumnos que ve.
2. En el selector de sede, cambiar a la otra sede.
3. Cambiar a "Todas".
4. Repetir 1-3 en Certificados.

**Esperado:** la lista recarga en los pasos 2 y 3 sin tener que salir de la pantalla (S25). Anotar
si en "Todas" aparece la columna Sede (hoy solo el admin la ve).

### P04 — RLS de documentos de alumno

**Precondición:** secretaria sede A; `enrollment_id` de una matrícula de B con documentos.
1. En Documentos, copiar desde Network la petición a `/rest/v1/v_dms_student_documents`
   ("Copy as fetch").
2. En Console, agregar `&enrollment_id=eq.<id de B>` y ejecutarla.
3. Repetir contra `/rest/v1/student_documents?enrollment_id=eq.<id de B>` y
   `/rest/v1/digital_contracts?enrollment_id=eq.<id de B>`.

**Esperado:** 0 filas en las 3. Si aparecen, fuga de datos → **P0 inmediato**.

### P01 / P02 — Storage de otra sede (S1)

**Precondición:** sesión de secretaria de la sede A; conocer el `enrollment_id` de una matrícula
de la sede B con documentos (desde la sesión de admin).
1. Con la secretaria, abrir un documento propio y copiar desde Network la petición
   `…/storage/v1/object/sign/documents/…` ("Copy as fetch").
2. En Console, cambiar la ruta por `students/<enrollment de B>/` usando el endpoint de listado
   (`POST …/storage/v1/object/list/documents` con `{"prefix":"students/<id>/"}`), ejecutar.
3. Si devuelve nombres, firmar uno de ellos cambiando la ruta en la petición del paso 1.

**Esperado:** el listado vuelve vacío o con error y la firma falla. Si obtienes una URL que abre la
cédula de un alumno de la sede B → **P0 inmediato** (datos sensibles, Ley 21.719).

### P03 — Sobrescribir un archivo de otra sede (S2)

**Precondición:** **solo con datos de prueba**: un certificado de prueba de la sede B cuya ruta
conozcas (`certificates/<id>/Certificado_….pdf`) y una copia de respaldo.
1. Como secretaria A, subir un documento propio y copiar la petición de subida.
2. Repetirla cambiando la ruta por la del certificado de B y el archivo por otro PDF.
3. Abrir el certificado de B como admin.

**Esperado:** la subida se rechaza. Si el certificado de B ahora muestra otro PDF → **P0
inmediato**. Restaurar desde la copia.

### P05 — Certificado generado por un usuario sin permiso (S3)

**Precondición:** cuenta de alumno o instructor; `enrollment_id` de D8.
1. Iniciar sesión con esa cuenta (aunque el portal esté bloqueado, la sesión existe) o usar solo
   la anon key.
2. Desde Console/Postman, `POST /functions/v1/generate-certificate-b-pdf` con
   `{"enrollment_id": <D8>}`.
3. Repetir sin header `Authorization` de usuario (solo `apikey`).

**Esperado:** 401/403 en ambos. Si devuelve `pdfUrl` → **P0 inmediato** (expone nombre y RUT y
emite un certificado sin autor).

### P07 — Exportar certificados de otras sedes (S4)

**Precondición:** secretaria sede A; certificados generados en ambas sedes (y uno Profesional, D14).
1. En Certificados, "Exportar todos" y copiar la petición `export-certificates-zip`.
2. Repetirla con body `{}` (sin `branch_id`).
3. Repetirla con `{"type":"professional"}`.
4. Abrir los ZIP.

**Esperado:** solo certificados de la sede A y nunca Profesional. Si el ZIP trae otras sedes o
Profesional → **P0 inmediato**.

### Q01 — Sin tiempo real en el DMS

**Precondición:** 2 navegadores (no 2 pestañas del mismo), admin y secretaria en la misma sede,
ambos en Documentos del Alumno.
1. La secretaria sube un documento a D1.
2. Sin tocar el navegador del admin, esperar 10 segundos.
3. En el admin, ir a otra pantalla y volver.

**Esperado (hoy):** en el paso 2 no cambia nada; en el paso 3 aparece. Registrar para decidir si
hace falta tiempo real.

### Q04 — Mismo certificado desde 2 sesiones

**Precondición:** D8 elegible sin certificado; admin y secretaria de su sede en 2 navegadores,
ambos en Certificación.
1. El admin genera el certificado de D8.
2. La secretaria, sin recargar, ve a D8 todavía "Pendiente" → clic en "Generar".
3. Revisar la respuesta, el folio de D8 en ambos navegadores y la tabla `certificates`.
4. Ambos presionan "Email" → "Confirmar envío" casi al mismo tiempo.
5. Revisar la bandeja del alumno y el historial.

**Esperado:** un solo registro en `certificates` con un solo folio (la segunda generación
reutiliza el registro y agrega otro "Generado" al historial); en el paso 5, anotar si llegan 2
correos (probable) y si eso es aceptable.

---

## 5. Decisiones de negocio pendientes

No se pueden marcar ✅/❌ hasta que alguien defina la regla:

| Caso | Pregunta |
|---|---|
| L06 / L07 / N02 | En el piloto nadie puede poner nota de práctica: ¿cómo se certifica? ¿Solo el admin con bypass, se habilita que la secretaria ponga la nota, o se cambia el criterio a "clases completadas"? |
| L18 | ¿Se puede emitir el certificado Clase B con saldo pendiente? (Profesional lo bloquea) |
| L19 | ¿La lista de la secretaria debe usar el mismo criterio que el botón (clases con nota) en vez de "clase #12 completada"? |
| M13 | ¿Cómo se reemite un certificado con un error (plantilla o nombre)? ¿Mismo folio o folio nuevo? |
| M15 | ¿Se notifica al alumno "disponible en tu portal" si el portal está bloqueado en el piloto? |
| K06 / M08 | ¿Cada sede necesita su logo y su marca en el certificado y el correo? |
| F04 | ¿Se puede borrar un contrato firmado desde el DMS? |
| F08 | ¿Cómo corrige la secretaria un documento mal subido (reemplazar vs. pedir al admin)? |
| I07 | ¿Un documento institucional es de una sede o de ambas? ¿Quién lo decide al subirlo? |
| J03 / R05 / R06 | ¿Se ocultan en el piloto los tipos Profesional del editor y los documentos de matrículas Profesional? |
| J18 | ¿La vista previa debe ser obligatoria antes de publicar? ¿Publicar pide confirmación? |
| J07 | ¿Se bloquea publicar cuando una sección excede el límite? |
| Q01 | ¿El DMS necesita tiempo real? |
| Q03 | ¿Qué pasa si 2 admins editan la misma plantilla a la vez? |
| P10 / P12 | ¿La secretaria debe poder borrar documentos por API (alinear RLS con la UI)? ¿Las vistas de muestra de plantillas son solo para admin? |
| N13 | ¿Alcanzan los últimos 50 registros en el historial de emisiones? |
| C06 | ¿El certificado y el carnet deben aparecer en el DMS junto al resto de los documentos de la matrícula? |
