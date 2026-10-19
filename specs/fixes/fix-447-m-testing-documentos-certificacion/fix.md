# Fix: Testing — Documentos (DMS), plantillas y certificación Clase B
> id: fix-447-m-testing-documentos-certificacion
> refs: ASG-i-033
> status: open
> created: 2026-10-18

> **Track de testing, no de corrección.** Acá se registra el resultado de cada caso (✅ / ❌ +
> evidencia). **Cada bug encontrado va a su propio fix/hotfix**; no se corrige dentro de este
> track.
>
> **Checklist que se ejecuta:** `specs/testing-piloto/033-documentos-certificacion.md`.

## Root Cause

[Heredado de ASG-i-033, a confirmar]: Repositorio de documentos (del alumno por matrícula, de
instructores e institucionales), las plantillas de contrato/certificado y la emisión de
certificados Clase B. Los documentos generados por edge functions tienen valor legal: datos
incorrectos en un contrato o certificado son un problema serio.

**Clasificación:** Funcional (con integración en la generación de PDFs) · dificultad Media ·
rutas: `/app/{admin,secretaria}/documentos`, `/app/admin/certificacion`,
`/app/secretaria/certificados`.

### Alcance confirmado al reclamar (Matías, 2026-10-18)

Las 3 capas de la ASG entran en este track:

1. **Funcional** — ACs de `0003-m` (documentos de instructores), `0007-m` (documentos por
   matrícula), `0011-m` (impresión vía edge function), `0016-m` (editor de plantillas) y
   `ASG-b-014` / `fix-h025` (certificado sin validar elegibilidad).
2. **E2E manual** — los casos A…S del checklist, incluidas las 26 sospechas (S1–S26).
3. **Playwright** — subida y visualización de un documento; certificado no elegible → botón
   bloqueado + motivo, en la suite de `0019-m` (`e2e/`).

Los hallazgos se corrigen en la misma sesión, cada uno en su propio fix/hotfix.

**El checklist es del 2026-09-29, anterior a varios fixes.** Antes de ejecutar, cada sospecha se
revisa contra el código actual. Candidatas a estar ya resueltas: S11 (fechas UTC → `0024-m`),
S3/S4/S26 (sede y rol en edge functions → DG-112 / `fix-429-m`). Las migraciones de policies de
Storage (S1, S2) las aplica Matías.

Las decisiones de negocio del checklist (p. ej. D16: ¿certificar con saldo pendiente?) se
consultan a medida que aparecen.

### Fuera de alcance

- Certificados Profesional (ocultos en el piloto; solo se verifica que sigan bloqueados, §3 R).
- Subir documentos dentro del wizard de matrícula (`023`), la ficha del alumno (`024b`),
  asistencia/notas de prácticas (`027`) y documentos de vehículos (`ASG-i-032`).

## Progreso

- [x] Revisión de las 26 sospechas en código
- [x] S26 → `fix-448-m` · S7 → `fix-449-m` · S10 → `fix-450-m` · S5 → `fix-451-m` · S6 → `fix-452-m` · S9 → `fix-454-m` · fechas UTC → `fix-453-m`
- [x] S16 → `fix-455-m` · S12 → `fix-457-m`
- [x] S19 → `fix-456-m` (DMS + RLS) y `fix-458-m` (Base Alumnos)
- [x] S14 → `fix-459-m` + `fix-460-m`
- [x] S18 → `fix-461-m`
- [x] Revisión en código de S8, S13, S15, S17, S20–S22, S24, S25 (2026-10-19)
- [x] S15 → `fix-462-m` · S21 → `fix-463-m` · S17 → `fix-464-m`
- [ ] Confirmadas en código, sin corregir aún:
  - S13 — `send-certificate-email` dice "Conductores Chillán" fijo; usar `branches.name` de la matrícula (como `contract-email.ts`). El logo del PDF es el mismo del contrato en ambas sedes: consultar si es el institucional.
  - S20 — editor de plantillas: si la carga falla queda el form de la sede anterior y "Publicar" escribe ahí; sin aviso de cambios sin publicar ni confirmación al publicar.
  - S22 — "Descargar" del drawer abre una pestaña (`download` no aplica cross-origin); el visor modal no ofrece descarga para PDF/imagen.
  - S24 — `v_dms_student_documents` muestra el contrato generado (`file_url`), no el escaneo firmado (`signed_contract_url`); tampoco certificado ni carnet. Requiere migración.
  - S25 — secretaria multisede: `secretaria-documentos` y `secretaria-certificados` no recargan al cambiar de sede (el admin sí, con el guard de fix-195-b).
  - S16 (resto) — `enviarEmail()` muestra un error genérico y pierde el motivo ("El alumno no tiene email…").
  - S8 — no existe "reemplazar" documento; la secretaria no puede corregir un escaneo malo. **Decisión de negocio pendiente** (¿la secretaria puede reemplazar?).
- [ ] Casos A…S del checklist en navegador
- [ ] Playwright: subida + visualización de documento; certificado no elegible bloqueado
- [ ] Test de regresión del track → `/fix-close`

## Resultados

### Sospechas revisadas en código (2026-10-18, sin navegador)

| Sospecha | Estado | Evidencia |
|---|---|---|
| S1 / S2 — Storage sin sede (leer / sobrescribir) | Cerrada por `fix-178-b` → regresión | `20261001200000_storage_aislamiento_por_sede.sql`; rutas de la app (`students/<enrollment>`, `instructor-docs/<id>`, `school-docs/`) calzan con la lista blanca |
| S3 — certificado sin rol ni sede | Cerrada (`requireStaff`, `fix-431-m`) → regresión | `generate-certificate-b-pdf/index.ts:79,101` |
| S4 — ZIP de todas las sedes | Sede cerrada (`fix-430-m`); **abierta**: `type: 'professional'` sigue aceptándose en el piloto | `export-certificates-zip/index.ts:83,89` |
| S26 — `send-certificate-email` con cualquier sesión | ❌ → corregida en `fix-448-m` (staff + sede), verificada tras el deploy | `send-certificate-email/index.ts` |
| S26 — `preview`/`sample` a cualquiera | Cerrada (`requireStaff` cubre los 3 modos) | `generate-certificate-b-pdf/index.ts:79` |
| S5 — documento institucional NULL no aparece con sede | ❌ confirmada (secretaria: RLS 1 fila, app 0) → corregida en `fix-451-m` | `dms.facade.ts:809` (`.eq` excluye NULL) |
| S6 — "Subido por Sistema" (`auth_id`) | ❌ confirmada (0 filas con `uploaded_by`) → corregida en `fix-452-m` | `dms.facade.ts:765` |
| S7 — primer documento de un alumno | ❌ confirmada en navegador (73/74; faltaba la matrícula #0081 sin documentos) → corregida en `fix-449-m` | `dms-upload-drawer.component.ts:287-296` |
| S9 — borrar no borra el archivo | ❌ → corregida en `fix-454-m` (borrar y insert fallido; contratos fuera) | `dms.facade.ts:629-643,736-742,782-785` |
| S10 — sección vacía publicada → PDF en blanco | ❌ (`publish()` guardaba `''`; la edge usa `??`) → corregida en `fix-450-m`: no se publica con secciones vacías. Las 6 filas actuales están completas | `document-content-templates.facade.ts:79,105-120`; `generate-certificate-b-pdf/index.ts:529-588` |
| S11 — fechas UTC | Cerrada (`0024-m`, `chile-time.ts`) → regresión. Fechas en blanco con bypass y clases no completadas: verificar en navegador | `generate-certificate-b-pdf/index.ts:1,221,413,431` |
| S12 — tope de 1.000 filas | → corregida en `fix-457-m` (paginación con `fetchAllPages`) | `dms.facade.ts:811-843` |
| S14 — criterios de elegibilidad / pago | Pago cerrado (`0010-i`, habilitación con motivo); botón y edge usan `completed` (`fix-262-m`). ❌ confirmada (70 habilitadas por sede, 8 cumplen) → corregida en `fix-459-m` (lista) y `fix-460-m` (trigger + backfill del flag) | `certificacion-clase-b.facade.ts:576` |
| S16 — errores tragados | ❌ → corregida en `fix-455-m` (toasts de carga y borrado; email: pendiente en certificación) | `dms.facade.ts:847-866` |
| S18 — folio con carrera | ❌ (`certErr` se ignoraba; `(enrollment_id, type)` no era único) → corregida en `fix-461-m` (RPC `issue_certificate` con lock + índice único), verificada con 3 generaciones simultáneas | `generate-certificate-b-pdf/index.ts:267-285` |
| S19 — sede por la del alumno | ❌ confirmada (Samuel Merino, #0008) → corregida en `fix-456-m` (DMS + RLS `20261018120000`, aplicada) y `fix-458-m` (Base Alumnos) | `dms.facade.ts:818,825` |
| S23 — filtro Estado sin "Todos" | Cerrada (`0022-m`, placeholder "Todos los estados") → regresión | `certificacion-clase-b-content.component.ts:108,749` |
| S8, S13, S15, S17, S20–S22, S24, S25 | Sin revisar en código; se verifican en navegador | — |

## Fixes derivados

| Track | Hallazgo | Estado |
|---|---|---|
| `fix-448-m-email-certificado-solo-staff` | S26 — el correo del certificado aceptaba cualquier sesión y cualquier sede | Cerrado 2026-10-18 |
| `fix-449-m-subir-primer-documento-alumno` | S7 / D03 — "Subir documento" no ofrecía a alumnos sin documentos | Cerrado 2026-10-18 |
| `fix-450-m-plantilla-sin-secciones-vacias` | S10 / J12 — publicar con una sección vacía la dejaba en blanco en el PDF | Cerrado 2026-10-18 |
| `fix-451-m-documentos-escuela-ambas-sedes` | S5 / I02 — documentos de la escuela "ambas sedes" invisibles con una sede elegida | Cerrado 2026-10-18 |
| `fix-452-m-documento-escuela-subido-por` | S6 — todo documento de la escuela "Subido por Sistema" | Cerrado 2026-10-18 |
| `fix-453-m-fechas-dms-hora-chile` | Hallazgo nuevo — fechas del DMS (y pre-inscritos) en UTC vía `| slice: 0 : 10`; ARCH-27 lo detecta ahora | Cerrado 2026-10-18 |
| `fix-454-m-borrar-documento-borra-archivo` | S9 / F05 — borrar un documento dejaba el archivo en Storage | Cerrado 2026-10-18 |
| `fix-455-m-dms-errores-visibles` | S16 / A07 — errores de carga y borrado del DMS invisibles | Cerrado 2026-10-18 |
| `fix-456-m-dms-sede-de-la-matricula` | S19 / B17 — el DMS y la RLS de `students` usaban la sede del alumno, no la de la matrícula | Cerrado 2026-10-18 |
| `fix-459-m-certificados-secretaria-criterio-unico` | S14 — la lista de certificados de la secretaria usaba `certificate_enabled` | Cerrado 2026-10-18 |
| `fix-460-m-certificate-enabled-recalculado` | S14 — el flag se prendía con la clase #12 y nunca bajaba (dashboard, portal) | Cerrado 2026-10-18 |
| `fix-458-m-base-alumnos-sede-de-la-matricula` | Hallazgo al verificar 456 — Base Alumnos filtraba y mostraba la sede por `users.branch_id` | Cerrado 2026-10-18 |
| `fix-457-m-dms-sin-tope-1000-filas` | S12 / B16 — el DMS perdía filas pasadas las 1.000 | Cerrado 2026-10-18 |
| `fix-461-m-folio-certificado-atomico` | S18 / M14 / Q04 — dos generaciones a la vez chocaban en el folio o duplicaban el certificado | Cerrado 2026-10-19 |
| `fix-462-m-generar-pendientes-solo-elegibles` | S15 — "Generar pendientes" incluía a los que no cumplen las clases | Cerrado 2026-10-19 |
| `fix-463-m-certificacion-respeta-piloto` | S21 — aviso "disponible en tu portal" con el portal en piloto; Certificado Profesional en el editor | Cerrado 2026-10-19 |
| `fix-464-m-regenerar-certificado` | S17 — no se podía regenerar un certificado ya generado | Cerrado 2026-10-19 |
| `fix-465-m-certificados-profesional-en-piloto` | Derivado de S21 — Certificados Prof. estaba en el recorte del piloto por error; se habilita (elegibilidad de secretaria solo por pago mientras dure el recorte) | Cerrado 2026-10-19 |
| `fix-466-m-confirmacion-previa-certificados` | Confirmaciones como modal (prácticas incompletas, asistencia, regenerar, email); deuda con la convención de 0010-i también en Profesional; la asistencia nunca bloquea; botón de la ficha Prof. en el piloto | Cerrado 2026-10-19 |

### Observaciones (sin track)

- S4 — `export-certificates-zip` acepta `type: 'professional'`. Profesional solo está bloqueado en
  las rutas del front; el ZIP respeta la sede, así que no expone datos de otra sede.

## Test de regresión

_Pendiente._
