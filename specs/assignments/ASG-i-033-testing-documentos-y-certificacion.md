# Asignación ASG-i-033 — Testing: Documentos (DMS), plantillas y certificación Clase B

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

> **Checklist detallado:** `specs/testing-piloto/033-documentos-certificacion.md` — casos, datos de prueba, sospechas de bug y pasos. Este archivo es el resumen; el checklist es lo que se ejecuta.

## Contexto / Objetivo

Repositorio de documentos (del alumno por matrícula, de instructores e institucionales), las
plantillas de contrato/certificado y la emisión de certificados Clase B. Los documentos
generados por edge functions tienen valor legal: datos incorrectos en un contrato o certificado
son un problema serio.

**Clasificación:** **Funcional** (con integración en la generación de PDFs) · dificultad
**Media** · rutas: `/app/{admin,secretaria}/documentos`, `/app/admin/certificacion`,
`/app/secretaria/certificados`.

## Alcance sugerido

**1. Funcional (contra ACs ya documentados)**
- ACs de specs `0003-m` (documentos de instructores), `0007-m` (documentos por matrícula),
  `0011-m` (impresión vía edge function), `0016-m` (editor de plantillas), `ASG-b-014` / fix-h025
  (certificado sin validar elegibilidad).

**2. E2E manual**
- Subir, ver, reemplazar y borrar documentos de alumno (por matrícula), de instructor e
  institucionales; permisos (secretaria no borra documentos de instructor).
- Alumno con 2 matrículas → documentos separados.
- Visor PDF/imagen; "Volver" sin cerrar el panel; archivos grandes o de formato no permitido.
- Editar una plantilla de contrato/certificado → el próximo PDF generado la usa, con los datos
  interpolados correctos (nombre, RUT, curso, sede, montos).
- Certificado: alumno elegible → se genera; no elegible (clases, nota o pago pendiente) →
  bloqueado con motivo.

**3. Candidatos a Playwright (requiere `ASG-i-021`)**
- Subida y visualización de un documento.
- Certificado no elegible → botón bloqueado + motivo.

## Fuera de alcance

- Certificados Profesional (ocultos en el piloto).

## Referencias

- `docs/UAT-PLAN.md` Paquetes 2 y 5 · specs `0003-m`, `0007-m`, `0011-m`, `0016-m`

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing).

## Notas para quien la reclame

- Tanda de testing del piloto (ver `specs/ASSIGNMENTS.md`). Registrar el resultado de cada caso
  (✅ / ❌ + evidencia) en el `fix.md` del track que genere esta asignación. **Cada bug
  encontrado va a su propio fix/hotfix**, no se corrige dentro de este.
