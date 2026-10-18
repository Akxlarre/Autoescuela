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

_Pendiente._

## Fixes derivados

_Pendiente._

## Test de regresión

_Pendiente._
