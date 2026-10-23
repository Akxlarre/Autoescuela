# Fix: Todo documento de la escuela aparece "Subido por Sistema"
> id: fix-452-m-documento-escuela-subido-por
> refs: fix-447-m-testing-documentos-certificacion (S6, caso I02)
> status: done
> closed: 2026-10-18
> created: 2026-10-18

## Root Cause

`DmsFacade.uploadSchoolDocument()` busca el `users.id` de quien sube con
`.eq('auth_id', <uid>)`, pero esa columna no existe (es `supabase_uid`). La consulta falla en
silencio (no se revisa `error`), `uploaded_by` queda NULL y la lista muestra "por Sistema".
Confirmado el 2026-10-18: ninguna fila de `school_documents` tiene `uploaded_by`.

## ACs Afectados

- AC propio — un documento de la escuela subido desde el DMS guarda en `uploaded_by` al usuario
  de la sesión, y la lista muestra su nombre.

## Cambio

- `dms.facade.ts` — `uploadSchoolDocument()` toma `uploaded_by` de
  `AuthFacade.currentUser().dbId` (ya inyectado) en vez de la consulta rota.

## Test de regresión

- `dms.facade.spec.ts` — "uploadSchoolDocument guarda uploaded_by con el usuario de la sesión".
- Navegador: secretaria sube un documento de la escuela → "Subido … por Lola …".

### Resultado (2026-10-18)

- ✅ `dms.facade.spec.ts` 27/27 (el test nuevo falló antes del cambio).
- ✅ Navegador, secretaria sede 1: subió `cedula-prueba.pdf` (Factura Folios, "Prueba fix-452")
  → "Subido … por Lola SECRETARIA". Dato de prueba dejado a propósito. El documento viejo sigue
  "por Sistema" (su `uploaded_by` es NULL en la BD; no se rellena hacia atrás).
