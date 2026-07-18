# Hotfix: Falta estado de carga en el botón "Ver Contrato" del detalle de alumno

## Problema
En `admin-alumno-detalle.component.ts`, el botón de hero "Ver Contrato" llama
a `facade.verContrato(path)`, que crea una signed URL de Supabase Storage y
abre el visor DMS — una llamada async sin ningún feedback visual mientras
resuelve. El usuario puede volver a hacer clic sin saber que ya está en
curso. El mismo patrón ya existe resuelto para "Carnet"
(`isViewingCarnet` → label "Cargando...") y para "Ver Certificado"
(hotfix-033, `isViewingCertificado`).

## Fix
- `admin-alumno-detalle.facade.ts`: se agrega
  `private readonly _isViewingContrato = signal(false)` y se expone
  `readonly isViewingContrato = this._isViewingContrato.asReadonly()`,
  junto a `_isUploadingContract`/`_isDownloadingContract`. `verContrato(path)`
  se envuelve en `try/finally`, seteando el signal `true` al iniciar y
  `false` al terminar (éxito o error).
- `admin-alumno-detalle.component.ts`: en el `computed` `heroActions`, ambas
  ramas que arman el botón "Ver Contrato" (`presential` con
  `contractGenerated`, y `online` con `contractSigned`) leen
  `facade.isViewingContrato()` y aplican `label: 'Cargando...'`,
  `disabled: true`, `loading: true` mientras está en curso — mismo patrón
  que `isCarnetBusy`.

## AC
- [x] Al hacer click en "Ver Contrato", el botón muestra "Cargando..." y
  queda deshabilitado hasta que se resuelve la signed URL (éxito o error).
- [x] No se modifica el flujo de "Descargar"/"Subir Firmado" (sin cambios en
  esos métodos del facade).
- [x] `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos.

## Cierre
`_isViewingContrato` agregado al facade junto a `_isUploadingContract`/
`_isDownloadingContract`; `verContrato()` ahora usa `try/finally` para
setearlo. `heroActions` en el smart component consume el signal en ambas
ramas de "Ver Contrato" (presencial y online) con label/disabled/loading
"Cargando...". Se agregó cobertura en
`admin-alumno-detalle.facade.spec.ts` (`describe('verContrato', ...)`, 2
tests: éxito y fallo de la signed URL) — 22/22 tests verdes en ese archivo.
`npx tsc --noEmit -p tsconfig.app.json` limpio. **Hotfix cerrado.**
