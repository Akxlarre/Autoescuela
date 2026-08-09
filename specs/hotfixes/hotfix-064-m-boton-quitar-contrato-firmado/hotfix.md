# Hotfix: Botón quitar contrato firmado no funciona (paso 4 matrícula)
> id: hotfix-064-m-boton-quitar-contrato-firmado
> refs: —
> status: done
> closed: 2026-08-09
> created: 2026-08-09

## Problema
En el paso 4 (Firma del Contrato) de matrícula, el botón "X" para quitar el archivo del
contrato firmado no hace nada: `ContractComponent.clearUpload()` emite `signedContract:
null` correctamente, pero `SecretariaMatriculaComponent.onStep4DataChange()` solo aplica
el cambio cuando `data.signedContract` es truthy (`if (data.signedContract) this.
_signedContractUpload.set(...)`), así que el `null` se ignora y el signal padre nunca se
limpia. Adicionalmente, el dueño prefiere reemplazar el botón "X" icon-only por un botón
con texto "Quitar archivo" (icono `trash-2` + label), igual al patrón ya usado para
"Quitar foto" en el paso 3 (`documents.component.html`).

## Cambios
- **Archivo:** `src/app/features/secretaria/matricula/secretaria-matricula.component.ts` — `onStep4DataChange` debe aplicar siempre `data.signedContract` (incluyendo `null`), no solo cuando es truthy.
- **Archivo:** `src/app/shared/components/matricula-steps/contract/contract.component.html` — reemplazar el botón icon-only `x` por un botón con icono `trash-2` + texto "Quitar archivo", con el mismo estilo que el botón "Quitar foto" de `documents.component.html`.
