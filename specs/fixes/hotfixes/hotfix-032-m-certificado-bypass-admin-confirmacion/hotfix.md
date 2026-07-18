# Hotfix: Falta modal de confirmación al generar certificado con prácticas incompletas (admin) y falta el bypass en detalle de alumno

## Problema
1. **Vista de certificación (`certificacion-clase-b-content.component.ts`)**: el
   admin puede ver alumnos con menos de 12/12 prácticas en la tabla (la query
   de `certificacion-clase-b.facade.ts:fetchAlumnos` ya bypassea el filtro
   `certificate_enabled` para admin, mostrando todos los enrollments
   activos/completados). Al apretar "Generar" se genera el certificado de
   inmediato sin ningún aviso, sin importar cuántas prácticas lleve. El único
   camino de confirmación existente (`pendingConfirmId`, basado en
   `pctAsistenciaTeoria`) es código muerto: ese campo siempre es `null` desde
   que se eliminó la asistencia teórica de Clase B (Spec 0001).
2. **Vista de detalle del alumno (`admin-alumno-detalle.component.ts`)**: el
   botón "Certificado (X/12)" se deshabilita para TODOS los roles cuando
   `progreso.completadas < progreso.requeridas` — nunca se implementó el
   bypass de admin en esta vista (sí existe el bypass a nivel de query en la
   vista de certificación, pero no aquí).
3. **Paginación de la tabla de alumnos** en la vista de certificación: las
   flechas de "anterior/siguiente" no tienen `cursor: pointer`.

## Fix
1. `certificacion-clase-b-content.component.ts`: nuevo input `isAdmin`.
   `onClickGenerar()` ahora verifica `clasesCompletadas >= clasesTotales`;
   si no está completo y `isAdmin()` es true, abre la fila de confirmación
   inline (reutilizando `pendingConfirmId`, repurposeado con mensaje de
   "prácticas incompletas" en vez del dead-code de teoría); si no es admin,
   no hace nada (mantiene el bloqueo para secretaria).
2. `admin-certificacion.component.ts` y `secretaria-certificados.component.ts`:
   pasan `[isAdmin]="authFacade.currentUser()?.role === 'admin'"`.
3. `admin-alumno-detalle.component.ts`: nuevo `isAdmin` computed vía
   `AuthFacade`. El botón "Certificado" para Clase B ahora se habilita para
   admin aunque `!canEmitCert`, mostrando "Generar Certificado (X/12)". En
   `handleCertificado()`, si las prácticas están incompletas se pide
   confirmación con `ConfirmModalService` (mismo servicio ya usado para el
   caso de teoría incompleta) antes de generar; para secretaria el botón
   permanece deshabilitado (sin cambio de comportamiento).
4. Botones de paginación (`prevPageAlumnos`/`nextPageAlumnos`) en
   `certificacion-clase-b-content.component.ts`: agregar `cursor-pointer`
   (y `disabled:cursor-not-allowed` ya existente se mantiene).

## AC
- Admin: al generar certificado de un alumno con prácticas incompletas
  (tabla de certificación o detalle de alumno), se muestra una confirmación
  explícita antes de generar. Cancelar no genera nada.
- Secretaria: el botón/acción de generar permanece bloqueado si las
  prácticas no están completas, en ambas vistas.
- Las flechas de paginación de la tabla de alumnos en certificación muestran
  cursor pointer al pasar el mouse (cuando no están disabled).

## Cierre
- 4 botones de paginación (alumnos + log) en `certificacion-clase-b-content.component.ts`: agregado `cursor-pointer`.
- `certificacion-clase-b-content.component.ts`: nuevo input `isAdmin`; `onClickGenerar()` repurposea el flujo `pendingConfirmId` (antes dead-code atado a `pctAsistenciaTeoria`, siempre `null` desde Spec 0001) para confirmar "prácticas incompletas" — solo si `isAdmin()`; bloquea sin emitir si no es admin y las prácticas están incompletas.
- `admin-certificacion.component.ts` y `secretaria-certificados.component.ts`: pasan `[isAdmin]` derivado de `AuthFacade.currentUser()?.role === 'admin'`.
- `admin-alumno-detalle.component.ts`: nuevo `isAdmin` computed. Botón "Certificado" (Clase B) ahora habilitado para admin con prácticas incompletas (label `Generar Certificado (X/12)`); `handleCertificado()` pide confirmación vía `ConfirmModalService` (mismo servicio ya usado para el caso de teoría incompleta) antes de generar. Secretaria: sin cambios, botón sigue deshabilitado.
- Nuevo spec `certificacion-clase-b-content.component.spec.ts` (4 tests) cubriendo las 4 combinaciones rol × completitud de prácticas.
- `tsc --noEmit` limpio; `admin-alumno-detalle.facade.spec.ts` (21), `certificacion-clase-b.facade.spec.ts` (18) y el spec nuevo (4) — 43/43 verdes.

## Follow-up: fila de confirmación rota visualmente
La fila inline de confirmación (`pendingConfirmId`) tenía dos atributos `class`
duplicados en el mismo `<div>` — el HTML resultante solo respeta el último,
así que se perdía por completo el layout flex (`flex flex-col sm:flex-row
sm:items-center gap-3 rounded-xl px-4 py-3`), dejando ícono/texto/botones
apilados sin alinear ni espaciado. Corregido fusionando ambos `class` en uno
solo, igual que la fila de confirmación de email (ya correcta) que sirvió de
referencia. `tsc --noEmit` y el spec del componente (4/4) siguen verdes.

## Follow-up 2: fila pegada al borde superior
La `<td>` de la fila usaba `pb-4 pt-0` (sin padding superior), por lo que el
recuadro quedaba pegado a la línea separadora de la fila de arriba. Alineado
a `px-4 py-3`, igual que la fila de confirmación de email (misma estructura,
padding simétrico).

## Follow-up 3: eliminado el modal de "asistencia teórica incompleta" (Clase B)
`admin-alumno-detalle.component.ts:handleCertificado()` (rama Clase B) pedía
confirmación cuando `facade.porcentajeTeoricas() < 100`. Como la asistencia
teórica de Clase B fue eliminada por completo (Spec 0001 — Ciclos Teóricos),
`_progresoTeorico` quedó hardcodeado en `{ completadas: 0, requeridas: 8 }`
— es decir, `porcentajeTeoricas()` siempre devolvía `0`, por lo que este
modal aparecía en **todas** las generaciones de certificado Clase B sin
excepción, mostrando una advertencia sin sentido (0% de una asistencia que ya
no existe).

Eliminado el bloque de confirmación completo, y limpiado el estado muerto
que solo alimentaba ese cálculo en `admin-alumno-detalle.facade.ts`:
`TEORICAS_REQUERIDAS_B`, `_progresoTeorico`, `progresoTeorico` (readonly
expuesto) y `porcentajeTeoricas` (computed) — sin consumidores restantes en
el resto del código tras el cambio. Actualizado el test correspondiente en
`admin-alumno-detalle.facade.spec.ts`. La confirmación de "prácticas
incompletas" (bypass admin, agregada en este mismo hotfix) queda intacta.

`tsc --noEmit` limpio; `admin-alumno-detalle.facade.spec.ts` (20/20) y
`certificacion-clase-b-content.component.spec.ts` (4/4) verdes.
