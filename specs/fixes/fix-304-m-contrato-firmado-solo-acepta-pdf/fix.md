# Fix: El contrato firmado solo acepta archivos PDF
> id: fix-304-m-contrato-firmado-solo-acepta-pdf
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
En la ficha, "Subir Firmado" (matrícula online) solo filtra el tipo de archivo en el diálogo del
sistema (`accept="application/pdf"`), que el usuario puede saltarse eligiendo "Todos los
archivos". `AdminAlumnoDetalleFacade.subirContratoFirmado()` sube lo que reciba como
`contracts/<id>/signed_contract.pdf`, declarando que es un PDF, y lo registra como contrato
firmado: un `.txt` o una foto quedan guardados como contrato y el visor después no los abre.
Encontrado en la 4ª pasada de `fix-264-m` (`024b` K04). Es B43.

## ACs Afectados
- `024b` K04: un archivo que no es PDF se rechaza con un aviso claro y no se registra.

## Cambio
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts` — `subirContratoFirmado()`
  rechaza el archivo si no es PDF (por tipo o, si el navegador no lo informa, por extensión),
  con el aviso "El contrato firmado debe ser un archivo PDF.", antes de subir nada.

## Test de Regresión
- `admin-alumno-detalle.facade.spec.ts > subirContratoFirmado — fix-304-m` ✓ (4 tests)
- `e2e/alumnos-b-ficha.spec.ts > cuarta pasada > K03 · K04 · K05` (falla antes del arreglo: el
  `.txt` se subía como contrato firmado) ✓
