# Fix: Publicar una plantilla con una sección vacía deja esa parte en blanco en el documento real
> id: fix-450-m-plantilla-sin-secciones-vacias
> refs: fix-447-m-testing-documentos-certificacion (S10, caso J12) · spec 0016-m (AC-E1)
> status: done
> closed: 2026-10-18
> created: 2026-10-18

## Root Cause

`DocumentContentTemplatesFacade.publish()` guarda todas las secciones del formulario tal cual,
incluidas las vacías (`''`). Las edge functions caen al texto por defecto solo con `??`, que no
reemplaza `''`: una sección borrada sale en blanco en el contrato o certificado real (p. ej. el
certificado sin cargo bajo la firma). Contradice AC-E1 de `0016-m` ("nunca un documento vacío").

Hoy las 6 filas de `document_templates` tienen todas sus secciones con texto (revisado el
2026-10-18), así que el caso solo aparece si el admin borra una sección y publica. No se
arregla cayendo al texto por defecto en la edge function: ese texto está escrito para
Conductores Chillán y quedaría mal en Autoescuela Chillán (S13).

## ACs Afectados

- `0016-m` AC-E1 — nunca un documento vacío.
- AC propio — si alguna sección está vacía (o solo con espacios), "Publicar" no guarda nada y
  avisa con un toast que nombra las secciones vacías. Con todas las secciones con texto, publica
  igual que antes.

## Cambio

- `document-content-templates.facade.ts` — `publish()` valida las secciones antes del upsert.

## Test de regresión

- `document-content-templates.facade.spec.ts` — "no publica si hay secciones vacías y las nombra".
- Navegador: admin → Plantillas → Certificado Clase B → borrar "Firma — Cargo" → Publicar → toast
  de error y la fila de `document_templates` no cambia.

### Resultado (2026-10-18)

- ✅ `document-content-templates.facade.spec.ts`: el test nuevo falló antes del cambio; 22/22 con
  `dms-list-content` y `features/admin/documentos`. Los 2 tests de `publish()` que publicaban con
  secciones vacías ahora llenan todas antes.
- ✅ Navegador, admin, Autoescuela Chillán → Certificado Clase B: borrar "Firma — Cargo" y
  Publicar → toast "Hay secciones vacías — Completa antes de publicar: Firma — Cargo."; la fila
  sigue con `updated_at` 2026-09-16 y `firma_cargo` de 22 caracteres. Texto restaurado sin publicar.
