# Hotfix: Falta estado de carga en el botón "Generar Certificado" del detalle de alumno

## Problema
En `admin-alumno-detalle.component.ts`, el botón de hero "Generar Certificado"
(tanto para Clase Profesional como para Clase B, incluido el bypass admin
agregado en hotfix-032) no refleja ningún estado de carga mientras la Edge
Function genera el PDF (`certFacade.generarCertificado()` /
`certProfFacade.generarCertificado()`, que pueden tardar varios segundos).
El usuario puede volver a hacer clic o confirmar de nuevo sin feedback visual
de que la generación ya está en curso.

Ambos facades (`certificacion-clase-b.facade.ts`,
`certificacion-profesional.facade.ts`) ya exponen `generatingId` (signal
`number | null`, igual al `enrollmentId` en curso) — no se estaba consumiendo
en esta vista.

## Fix
En el `computed` `heroActions`, para las 3 variantes del botón "Generar
Certificado" (profesional elegible, Clase B completo, Clase B bypass admin),
se deriva `isGeneratingCert` desde el `generatingId()` del facade
correspondiente y se aplica `loading`, `disabled` e ícono/label de
"Generando..." — mismo patrón ya usado para el botón de Carnet
(`isCarnetBusy`).

## AC
- Al confirmar la generación de un certificado (Clase B o Profesional), el
  botón muestra spinner + "Generando..." y queda deshabilitado hasta que la
  Edge Function responde.

## Cierre
- `heroActions` computed: agregado `isGeneratingCert` (derivado de `certProfFacade.generatingId()` / `certFacade.generatingId()` comparado contra `alumno.enrollmentId`) para las 3 variantes de "Generar Certificado" (profesional elegible, Clase B completo, Clase B bypass admin).
- Cada variante aplica `loading`, `disabled` e ícono/label "Generando..." mientras la generación está en curso — mismo patrón que `isCarnetBusy`.
- `tsc --noEmit` limpio; specs de `admin-alumno-detalle.facade`, `certificacion-clase-b.facade`, `certificacion-profesional.facade` y `certificacion-clase-b-content.component` — 63/63 verdes.

## Follow-up: estado de carga en "Ver Certificado"
Igual problema en el botón "Ver Certificado" (cuando el PDF ya existe): no
mostraba ningún feedback mientras se firmaba la URL de storage
(`certFacade.verCertificado()` / `certProfFacade.verCertificado()`).

Como `verCertificado()` no expone un signal propio en ninguno de los dos
facades (a diferencia de `generatingId()`), y este estado es puramente local
a esta vista (un solo alumno a la vez, sin necesidad de trackear por
`enrollmentId` como en la tabla de certificación), se agregó un signal local
al componente: `isViewingCertificado` — mismo patrón que
`admin-alumno-detalle.facade.ts:isViewingCarnet`, pero sin tocar los facades
compartidos que también usa la vista de lista de certificación.
`handleCertificado()` lo setea `true`/`false` alrededor de ambas llamadas a
`verCertificado()` (profesional y Clase B); `heroActions` lo consume para
mostrar "Cargando..." + ícono `loader-2`, igual que el botón de Carnet.

`tsc --noEmit` limpio; mismas 63 pruebas verdes (no se tocó lógica de
facades, solo estado local del smart component).
