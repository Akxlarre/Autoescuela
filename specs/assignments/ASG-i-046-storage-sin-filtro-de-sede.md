# Asignación ASG-i-046 — Storage: leer y sobrescribir archivos de otra sede, y subida anónima

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

> **Confirmación (2026-09-30), en vivo contra la BD del piloto, solo lectura:**
> - ✅ **Listar documentos de otra sede CONFIRMADA:** las secretarias de la sede 1 y de la sede 2
>   ven exactamente las mismas 44 carpetas en `documents/students/`, 3 de ellas de alumnos de la
>   otra sede.
> - ⏳ Leer el contenido de un archivo, sobrescribir y la subida anónima a `website-public` siguen
>   probables (no se probó leer ni escribir archivos).

## Contexto / Objetivo

Detectada leyendo el código (tanda de testing 2026-09-29; ver la confirmación de arriba).

1. **Bucket `documents`**: la policy de lectura solo exige rol admin o secretaria. Una secretaria
   de la sede A puede listar `students/<id>/`, `certificates/<id>/`, `instructor-docs/<id>/` de
   la sede B y firmar URLs de cédulas, certificados médicos y contratos
   (`20260413000001_secure_documents_bucket.sql:26-38`).
2. **Mismo bucket, escritura**: INSERT/UPDATE solo exigen rol, y la app sube con `upsert: true`:
   una secretaria podría reemplazar el PDF de un contrato o certificado de otra sede
   (`20260310130000_fix_documents_storage_rls.sql:42-81`).
3. **Bucket `website-public`**: cualquiera **sin sesión** puede subir a `seeds/`, y una
   secretaria puede sobrescribir imágenes de otra sede (`20260522010000…:55-78`).

Son documentos de identidad (datos sensibles, Ley 21.719).

## Alcance sugerido

- **Paso 1, confirmar**: listar el bucket con la sesión de la secretaria A y buscar carpetas de
  alumnos de B (solo lectura); para escritura, probar con un archivo de prueba en una ruta de
  prueba, nunca sobre un documento existente. Leer las policies vigentes en la BD remota.
- Policies por sede: resolver la sede a partir de la ruta (id del alumno/matrícula/instructor) o
  reorganizar las rutas con la sede como prefijo.
- Quitar la subida anónima de `website-public` y limitarla por sede.
- Evaluar dejar de usar `upsert: true` en subidas de documentos que no deberían reemplazarse.

## Referencias

- `specs/testing-piloto/033-documentos-certificacion.md` S1, S2 · `036-auditoria-configuracion-web.md` S15
- `specs/testing-piloto/037-transversal-multisede-shell.md` §1 (buckets)

## Archivos involucrados (opcional, para detectar solapes)

- Nueva migración de policies de `storage.objects`
- Posiblemente `core/facades/dms.facade.ts` y los componentes que suben archivos

## Notas para quien la reclame

- Si se reorganizan rutas, hay que migrar los archivos existentes: planificarlo con cuidado.
