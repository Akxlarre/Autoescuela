# Fix: Los errores del DMS no se le muestran a nadie
> id: fix-455-m-dms-errores-visibles
> refs: fix-447-m-testing-documentos-certificacion (S16, casos A07 / F*)
> status: done
> closed: 2026-10-18
> created: 2026-10-18

## Root Cause

- **Borrar:** los tres handlers (`admin-documentos`, drawer de alumno, drawer de instructor)
  capturan el error del facade y solo hacen `console.error`. Un borrado que falla (RLS, red, o el
  mensaje propio "El Carnet no se puede eliminar desde el DMS…") no muestra nada: el documento
  sigue en la lista sin explicación. Un borrado correcto tampoco confirma nada.
- **Cargar:** `fetchAllData()` no revisa el `error` de sus 5 consultas: una falla se ve como
  "Sin documentos aún". El signal `error` del facade no se muestra en ninguna pantalla.

## ACs Afectados

- AC propio — borrar un documento (alumno, instructor o escuela) muestra "Documento eliminado"; si
  falla, un toast de error con el motivo.
- AC propio — si la primera carga del DMS falla, un toast "Error al cargar documentos" con el
  motivo y el signal `error` queda seteado. El refresco silencioso (SWR) sigue sin toast.

## Cambio

- `dms.facade.ts` — los 3 `delete*Document` muestran el toast de éxito/error (y relanzan el
  error); `fetchAllData()` lanza el primer `error` de sus consultas; `initialize()` muestra el
  toast si la carga falló.

## Test de regresión

- `dms.facade.spec.ts` — borrar falla → toast de error; borrar bien → toast de éxito; consulta
  con error en la primera carga → `error()` + toast; en `refreshSilently()` → sin toast.

### Resultado (2026-10-18)

- ✅ `dms.facade.spec.ts` + `features/{admin,secretaria}/documentos`: 42/42; 4 de los 5 tests
  nuevos fallaron antes del cambio (el de SWR ya pasaba: documenta que no cambia).
- ✅ Navegador, admin, `v_dms_student_documents` respondiendo 500 (simulado con `page.route`) →
  toast "Error al cargar documentos — Ha ocurrido un error procesando la solicitud (XX000)."
  Primera versión mostraba el título repetido como detalle: el error de PostgREST es un objeto
  plano, no un `Error`; ahora se pasa siempre por el sanitizer.
- Los toasts de borrado (éxito / error / carnet) quedan cubiertos por los tests unitarios; no se
  borró otro documento real para verlos.
