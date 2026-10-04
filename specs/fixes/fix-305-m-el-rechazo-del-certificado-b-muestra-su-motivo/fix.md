# Fix: El rechazo del certificado Clase B muestra su motivo
> id: fix-305-m-el-rechazo-del-certificado-b-muestra-su-motivo
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
Cuando `generate-certificate-b-pdf` rechaza el pedido (HTTP 400, p. ej. "El alumno no cumple el
mínimo de clases prácticas completadas (11/12)."), `functions.invoke()` devuelve `data: null` y un
`error` con mensaje fijo; el texto real queda en el cuerpo de la respuesta (`error.context`).
`CertificacionClaseBFacade.invokeGenerateCertificate()` buscaba el motivo en `data?.error`, que en
un rechazo nunca existe, así que siempre mostraba "No se pudo generar el certificado". `fix-011-i`
quiso mostrar el motivo, pero su test simulaba una respuesta que la función real no produce. Mismo
patrón de `fix-268-m` (DG-085). Encontrado en la 4ª pasada de `fix-264-m` (`024b` L06). Es B44.

## ACs Afectados
- `024b` L06: si la función rechaza el certificado, el aviso dice el motivo real.

## Cambio
- **Archivo:** `src/app/core/facades/certificacion-clase-b.facade.ts` — ante un error, lee la
  respuesta con `readEdgeFunctionError()` y muestra su mensaje si es un rechazo de negocio (4xx).
  Un 5xx o un fallo de red siguen con el aviso genérico.

## Test de Regresión
- `certificacion-clase-b.facade.spec.ts > generarCertificado() > fix-305-m: …` (2 tests) ✓
- `e2e/alumnos-b-ficha.spec.ts > cuarta pasada > L06` (falló antes del arreglo: aviso genérico) ✓
