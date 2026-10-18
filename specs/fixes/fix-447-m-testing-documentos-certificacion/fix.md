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

## Resultados

### Sospechas revisadas en código (2026-10-18, sin navegador)

| Sospecha | Estado | Evidencia |
|---|---|---|
| S1 / S2 — Storage sin sede (leer / sobrescribir) | Cerrada por `fix-178-b` → regresión | `20261001200000_storage_aislamiento_por_sede.sql`; rutas de la app (`students/<enrollment>`, `instructor-docs/<id>`, `school-docs/`) calzan con la lista blanca |
| S3 — certificado sin rol ni sede | Cerrada (`requireStaff`, `fix-431-m`) → regresión | `generate-certificate-b-pdf/index.ts:79,101` |
| S4 — ZIP de todas las sedes | Sede cerrada (`fix-430-m`); **abierta**: `type: 'professional'` sigue aceptándose en el piloto | `export-certificates-zip/index.ts:83,89` |
| S26 — `send-certificate-email` con cualquier sesión | **Abierta**: sin `requireStaff` ni `denyIfEnrollmentOutOfScope`; un alumno o instructor logueado dispara correos de cualquier matrícula | `send-certificate-email/index.ts:117-131` |
| S26 — `preview`/`sample` a cualquiera | Cerrada (`requireStaff` cubre los 3 modos) | `generate-certificate-b-pdf/index.ts:79` |
| S5 — documento institucional NULL no aparece con sede | **Abierta** | `dms.facade.ts:809` (`.eq` excluye NULL) |
| S6 — "Subido por Sistema" (`auth_id`) | **Abierta** | `dms.facade.ts:765` |
| S7 — primer documento de un alumno | **Abierta** (el selector sale de `studentsWithDocs()`) | `dms-upload-drawer.component.ts:287-296` |
| S9 — borrar no borra el archivo | **Abierta** (ni al borrar ni si falla el insert) | `dms.facade.ts:629-643,736-742,782-785` |
| S10 — sección vacía publicada → PDF en blanco | **Abierta** (`publish()` guarda `''`; la edge usa `??`) | `document-content-templates.facade.ts:79,105-120`; `generate-certificate-b-pdf/index.ts:529-588` |
| S11 — fechas UTC | Cerrada (`0024-m`, `chile-time.ts`) → regresión. Fechas en blanco con bypass y clases no completadas: verificar en navegador | `generate-certificate-b-pdf/index.ts:1,221,413,431` |
| S12 — tope de 1.000 filas | **Abierta** | `dms.facade.ts:811-843` |
| S14 — criterios de elegibilidad / pago | Pago cerrado (`0010-i`, habilitación con motivo); botón y edge usan `completed` (`fix-262-m`). **Abierta**: la lista de la secretaria sigue filtrando `certificate_enabled` (trigger clase #12) | `certificacion-clase-b.facade.ts:576` |
| S16 — errores tragados | **Abierta** en las cargas del DMS (no revisan `error`) | `dms.facade.ts:847-866` |
| S18 — folio con carrera | **Abierta** (`certErr` se ignora) | `generate-certificate-b-pdf/index.ts:281-303` |
| S19 — sede por la del alumno | **Abierta** | `dms.facade.ts:818,825` |
| S23 — filtro Estado sin "Todos" | Cerrada (`0022-m`, placeholder "Todos los estados") → regresión | `certificacion-clase-b-content.component.ts:108,749` |
| S8, S13, S15, S17, S20–S22, S24, S25 | Sin revisar en código; se verifican en navegador | — |

## Fixes derivados

_Pendiente._

## Test de regresión

_Pendiente._
