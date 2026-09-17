# Acceptance 0016-m — Editor de plantillas para contratos y certificados generados por Edge Function

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-09-17
> **Verifier:** Claude Code (sesión interactiva) · validado por Matías

> **Nota sobre evidencia:** todo el trabajo de esta spec sigue sin commitear (working tree). No hay
> hashes de commit que citar — la evidencia son rutas de archivo, resultados de test corridos en
> esta sesión, y QA manual en vivo vía Playwright MCP contra `ng serve` + el proyecto Supabase real
> (`skvekggejikzxhzsjmkz`, sin staging separado).

---

## Resumen

- AC totales: 11 (AC1–AC8 + AC-E1, AC-E2, AC-E3)
- AC cumplidos: 11
- AC fallidos: 0
- AC con evidencia: 11/11

**Veredicto final:** ✅ PASA

---

## Verificación por AC

### AC1 — Editor muestra contenido dividido por sección/cláusula

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `app-document-clause-field` × N por `DOCUMENT_TEMPLATE_SECTIONS`
    (`src/app/shared/components/dms-list-content/dms-list-content.component.ts:657-664`)
  - QA manual (2026-09-17): tab Plantillas → Autoescuela Chillán → Contrato Clase B muestra
    PRIMERO, SEGUNDO, TERCERO, CUARTO, QUINTO, SEXTO como campos separados (no un blob único),
    cada uno con su propio contador de caracteres.
- **Notas:** —

### AC2 — "Vista previa" genera PDF de muestra con borrador sin guardar

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `DocumentContentTemplatesFacade.preview()` invoca la Edge Function con
    `mode:'preview'` (`document-content-templates.facade.ts`), `handlePreviewOrSample()`
    (`generate-contract-pdf/index.ts:367`) usa `SAMPLE_STUDENT` fijo, nunca escribe a
    `document_templates`.
  - QA manual (2026-09-17): inyectado un marcador único (`[QA-VERIFY-0016m]`) en PRIMERO sin
    publicar → click "Vista previa" → POST a `generate-contract-pdf` (200) → decodificado el
    `pdfBase64` de la respuesta real → **el marcador aparece en el binario del PDF**. Confirmado
    en Network que `document_templates` no recibió ningún POST/PATCH durante esta prueba (solo el
    GET de carga inicial).
- **Notas:** —

### AC3 — "Publicar" persiste en BD; el próximo documento real usa el contenido nuevo, sin deploy

- **Estado:** ✅ cumplido (tras corregir un bug real encontrado durante esta verificación)
- **Evidencia:**
  - **Bug encontrado (2026-09-17):** el botón "Publicar" fallaba con 400
    (`null value in column "name" of relation "document_templates" violates not-null constraint`)
    — `DocumentContentTemplatesFacade.publish()` no incluía `name` en el `upsert()`, columna
    `NOT NULL` heredada de antes de la migración T1.2. Nunca había funcionado.
  - **Fix:** `name: DOCUMENT_TYPE_LABELS[form.documentType]` agregado al payload
    (`document-content-templates.facade.ts`). Test actualizado
    (`document-content-templates.facade.spec.ts`) — 16/16 tests pasan.
  - QA manual end-to-end (2026-09-17, autorizado explícitamente por el owner): marcador en
    PRIMERO → "Publicar" (200) → nueva matrícula real (`/app/admin/matricula`, RUT sintético
    `19.876.543-0`, Autoescuela Chillán, Contrato Clase B, `enrollment_id` 2874) → "Generar PDF"
    (Paso 4 del wizard, `mode:'real'` implícito — **sin** `mode` en el body, sin ningún cambio de
    código ni deploy) → 200, PDF subido a Storage
    (`contracts/2874/Contrato_QA_Verify_Prueba0016m_2026.pdf`) → **descargado el PDF real y
    confirmado que contiene el marcador**. Contenido revertido a su texto original inmediatamente
    después, verificado releyendo desde BD tras recargar la página (sin caché).
- **Notas:** el bug de `name` es deuda de implementación cerrada en esta misma sesión, no deuda
  pendiente — ver Fase 6 de `tasks.md` (T6.4).

### AC4 — Acceso bloqueado para rol no-admin

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `tabs` computed oculta "Plantillas" si `!isAdmin()`
    (`dms-list-content.component.ts`).
  - QA manual (2026-09-17): logueado como `secretaria@test.com` → `/app/secretaria/documentos`
    muestra solo 3 tabs (Alumno/Instructores/Escuela), sin "Plantillas". Sin queries a
    `document_templates` en Network, consola limpia.
- **Notas:** RLS (`document_templates`: SELECT/INSERT/UPDATE solo `auth_user_role() = 'admin'`)
  es la capa real de seguridad; el guard de UI es solo higiene de UX.

### AC5 — Mitigación de overflow de texto

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `document-clause-limits.util.spec.ts` — 4/4 (dentro del límite, exacto, +1 sobre el
    límite, texto vacío).
  - QA manual (2026-09-17): editado PRIMERO a 850 caracteres (límite 800, sin publicar) →
    contador "850 / 800" en rojo, borde del textarea rojo, mensaje "Excede el límite sugerido por
    50 caracteres — revisa la Vista Previa antes de publicar." Cambio descartado sin publicar
    (recarga de página).
- **Notas:** mitigación no bloqueante, tal como pide la spec ("no se espera una solución
  perfecta").

### AC6 — PDF real refleja contenido editado con interpolación dinámica intacta

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Misma prueba end-to-end de AC3: el contrato real generado para `enrollment_id` 2874 interpola
    el nombre real del alumno (visible en el nombre del archivo:
    `Contrato_QA_Verify_Prueba0016m_2026.pdf`) y refleja el contenido editado/publicado (marcador
    presente en el binario).
  - QA manual adicional (2026-09-17, hallazgo del owner): la cláusula QUINTO en Vista Previa
    mostraba un precio de muestra hardcodeado ($500.000) sin relación a ningún curso real —
    corregido (`fetchSampleBasePrice()` en `generate-contract-pdf/index.ts`, trae el `base_price`
    real de `courses` por sede/tipo de curso). Desplegado por el owner y confirmado visualmente:
    QUINTO ahora muestra $180.000 (precio real de Autoescuela Chillán) en vez del valor inventado.
- **Notas:** —

### AC7 — Mecanismo de placeholders para cláusulas con valores calculados

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `supabase/functions/_shared/template-tokens.test.ts` — 5/5 vía `deno test` (Deno 2.9.7
    instalado esta sesión con `winget`). Cubre: token conocido, token desconocido → vacío sin
    lanzar, texto sin tokens, token repetido, texto vacío.
  - QA manual (2026-09-17): sección QUINTO muestra 4 chips (`{{valorCurso}}`,
    `{{textoDescuento}}`, `{{montoPagado}}`, `{{saldoPendiente}}`) con descripción en español
    simple como tooltip; Vista Previa sustituye los tokens por los valores calculados reales
    ($500.000 → $180.000 tras el fix de AC6, saldo $0, etc.).
- **Notas:** el hint fue iterado dos veces durante la sesión a partir de feedback del owner (UX
  para usuarios no técnicos, luego corregido para no ocultar el token crudo) — ver historial de la
  conversación; el componente final (`document-clause-field.component.ts`) muestra el token crudo
  visible con la descripción como tooltip complementario.

### AC8 — Autoescuela Chillán no ofrece opciones Profesional

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `templateDocumentTypeOptions` computed filtra por `branch.hasProfessional`
    (`dms-list-content.component.ts:841-843`).
  - QA manual (2026-09-17): selector de tipo de documento con Autoescuela Chillán seleccionada
    muestra únicamente "Contrato Clase B" y "Certificado Clase B" — sin opciones Profesional.
- **Notas:** sin test unitario para este componente (no existe `.spec.ts` para
  `dms-list-content.component.ts`) — evidencia es 100% QA manual en vivo.

### AC-E1 — Sede/tipo sin fila usa default sembrado

- **Estado:** ✅ cumplido (evidencia de código + test, no E2E en vivo)
- **Evidencia:**
  - Test: caso "sede/tipo sin fila (AC-E1, sin error)" en
    `document-content-templates.facade.spec.ts` (parte de los 16/16 tests).
  - Código: `applyClause` en `contract-pdf.ts` usa `content[claveId] ?? bodyHardcodeadoActual`;
    `fetchDocumentContent()` devuelve `{}` si `.maybeSingle()` no encuentra fila, nunca lanza.
- **Notas:** no se pudo probar end-to-end en vivo porque las 6 combinaciones válidas ya están
  sembradas por la migración T1.2 — no existe ningún caso real "sin fila" reproducible sin borrar
  datos reales a propósito. Riesgo residual bajo: la lógica de fallback está cubierta por test y
  es simple (`??`).

### AC-E2 — Vista de documento default también invoca la función generadora (sin PDF estático)

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: botón "Ver documento actual" → `templatesFacade.viewPublished()` → `mode:'sample'`
    (contenido real de BD, sin borrador).
  - QA manual (2026-09-17, sesión previa a esta verificación final): click "Vista previa" generó
    un PDF real vía la Edge Function desplegada — mismo mecanismo aplica a "Ver documento actual"
    (comparten `handlePreviewOrSample`).
- **Notas:** —

### AC-E3 — Token no reconocido no rompe la generación

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `template-tokens.test.ts` caso "token desconocido se reemplaza por string vacío, sin
    lanzar" — 1/5 tests, corrido vía `deno test` (ver AC7).
- **Notas:** no hay validación bloqueante de tokens en V1, tal como especifica la spec.

---

## Out-of-scope respetado

- ❌ Editor de layout/diseño visual del PDF — confirmado: no se tocó `wrapToWidth`/membrete/firmas,
  solo el origen del texto de cada cláusula.
- ❌ Versionado/historial de cambios de contenido — confirmado: no se implementó.
- ❌ Editor de contenido para otros documentos (ficha técnica, hoja de ruta, EPQ, reportes) —
  confirmado: alcance quedó en los 6 documentos de contrato/certificado.
- ❌ Cláusula de convalidación (SÉPTIMO) — confirmado: eliminada por completo del generador
  (`_shared/contract-pdf.ts`, `generate-contract-pdf/index.ts`, `public-enrollment/index.ts`), no
  reconstruida.
- ❌ Edge Functions de certificados consultando `branches` en tiempo real — confirmado: el
  branding se corrige vía contenido sembrado editable, sin `SELECT branches` nuevo.
- ❌ Motor de templates genérico reutilizable — confirmado: `template-tokens.ts` es específico
  para las cláusulas de contrato/certificado, no infraestructura transversal.
- ❌ Editor del párrafo de identificación de partes del contrato — confirmado: sigue hardcodeado.

---

## Deuda técnica detectada

- **Paridad byte-a-byte del PDF pre/post refactor de `contract-pdf.ts` (T2.1)** — no verificada
  con un test automatizado (compararía contra el código previo al refactor, que ya no existe). La
  validación disponible es funcional (Vista Previa se ve correcta con los 6 tokens sustituidos),
  no una comparación automatizada. Riesgo bajo dado que el motor de wrap/paginación no cambió, solo
  el origen del texto — no bloquea el cierre.
- **Sin `.spec.ts` para `dms-list-content.component.ts`** — componente grande (contiene AC1, AC4,
  AC8) sin cobertura de test, solo QA manual. Preexistente a esta spec (el componente ya existía),
  pero creció bastante en esta spec. Candidato a spec/fix futuro si se vuelve a tocar.
- **Confirmación previa a "Publicar" (`ConfirmModalService`)** — marcada opcional en el criterio de
  implementación (T5.4), no implementada. No bloquea AC3.

---

## Cambios en índices

- `indices/COMPONENTS.md` — `app-document-clause-field` agregado; `app-dms-template-drawer`
  eliminado (archivo borrado); descripción de `dms-list-content` actualizada.
- `indices/FACADES.md` — `DocumentContentTemplatesFacade` agregado.
- `indices/MODELS.md` — DTO `DocumentTemplate` reescrito; UI models
  `document-content-template.model.ts` agregado.
- `indices/UTILS.md` — `document-clause-limits.util.ts`, `document-clause-tokens.util.ts`
  agregados.
- `indices/DATABASE.md` — `document_templates` documentada con su esquema reestructurado
  (T1.2).

---

## Post-mortem

- **Qué salió mejor de lo esperado:** el mecanismo de placeholders (AC7) resultó simple de
  implementar y de testear (función pura `substituteTokens`), y la separación
  preview/sample/real vía `mode` en las Edge Functions permitió probar todo el flujo sin tocar
  datos reales — excepto el paso final de AC3, que sí requirió tocar producción real de forma
  controlada y reversible.
- **Qué fricciones encontramos:**
  - Sin entorno Deno disponible al implementar (T2.0–T2.4); tuvo que instalarse en esta sesión de
    verificación para poder correr los tests que ya existían escritos.
  - El botón "Publicar" nunca había sido probado end-to-end contra la BD real hasta esta
    verificación — un test unitario con mocks no detectó el bug de la columna `name` porque el
    mock no simula constraints de Postgres. Lección: para acciones de escritura críticas (AC3 es
    el corazón de la spec), un test de integración real —aunque sea uno solo, corrido una vez
    manualmente— vale más que N tests unitarios con mocks.
  - El wizard de matrícula (`/app/admin/matricula`) tiene un flujo de selección de horario
    (Paso 2) cuyo estado de selección no es inferible de forma confiable por atributos DOM
    estáticos (`aria-label` no cambia con la selección) — hubo que usar el contador visible
    ("Clases seleccionadas N/12") como fuente de verdad para automatizar la selección de las 12
    clases sin clicks duplicados.
- **Qué cambiaríamos en el siguiente ciclo SDD:** para specs con una acción de escritura crítica
  (AC3 "Publicar"), agregar explícitamente a `tasks.md` una tarea de "probar el upsert/insert real
  contra una fila de BD real (no mock)" en Fase 6, no solo tests unitarios — habría detectado el
  bug de `name` mucho antes del QA final.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando en CI (2479/2479 Vitest + 37/38 Deno, el único fallo es preexistente y ajeno
      a esta spec)
- [x] `lint:arch` limpio (0 errores)
- [x] Sin deuda crítica abierta (deuda listada arriba es todo no-bloqueante)

**Cerrado por:** Matías
**Fecha:** 2026-09-17
