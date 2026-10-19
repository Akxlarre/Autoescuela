# Fix: Confirmación previa al generar certificados (Clase B y Profesional)
> id: fix-466-m-confirmacion-previa-certificados
> refs: fix-447-m-testing-documentos-certificacion · fix-465-m · spec 0010-i (AC8, AC-E5)
> status: in_progress
> created: 2026-10-19

## Root Cause

Hay tres reglas de emisión que no estaban unificadas entre Clase B y Profesional:

1. **Generar no pedía confirmación.** En Clase B, con las clases completas, "Generar" emitía de
   inmediato; "Regenerar" también. En Profesional solo se confirmaba si la práctica estaba bajo
   100 %, con una fila inline. Matías: siempre debe haber un modal antes de emitir.
2. **La deuda solo se controlaba en Clase B.** La spec 0010-i (AC8) dejó una convención: con saldo
   pendiente, quien genera (admin o secretaria) confirma con un motivo, queda registrado en
   `enrollment_payment_overrides` (`kind = 'certificado'`) y se avisa a los admins. La edge function
   `generate-certificate-b-pdf` lo exige. Profesional no tenía nada de eso: el admin emitía con
   deuda sin dejar registro, y la secretaria quedaba bloqueada sin vía de excepción.
3. **La asistencia bloqueaba en Profesional.** La secretaria necesitaba teoría ≥ 75 %, y la ficha
   del alumno exigía teoría, pago y nota. Decisión de Matías: la asistencia nunca bloquea; cuando
   vuelva el módulo (al levantar el piloto) y el alumno esté bajo el mínimo, se avisa en el modal.

## ACs Afectados

- AC propio — "Generar" y "Regenerar" (lista B, lista Prof. y ficha del alumno) abren siempre un
  modal de confirmación antes de emitir. "Generar pendientes" se queda con su drawer actual, que
  ya funciona como confirmación.
- AC propio — el modal lista los avisos que correspondan: prácticas incompletas en Clase B (solo
  admin puede seguir), teoría bajo 75 % y práctica bajo 100 % en Profesional (solo si hay registros).
  Ningún aviso de asistencia bloquea.
- AC propio — con saldo pendiente, el mismo modal muestra el monto y pide el motivo obligatorio de
  0010-i, tanto para admin como para secretaria, en Clase B y Profesional. Si la deuda ya se había
  autorizado antes, no se vuelve a pedir el motivo.
- AC propio — `generate-certificate-professional-pdf` rechaza con `DEUDA_PENDIENTE` (409) una
  matrícula con saldo sin habilitación, igual que la de Clase B (helper compartido).
- AC propio — "Generar pendientes" en Profesional omite a los alumnos con deuda (0010-i AC-E5):
  se emiten uno a uno desde su fila.

## Cambio

- `core/utils/certificate-confirmation.utils.ts` (nuevo, puro): avisos y texto del modal.
- `core/facades/certificado-autorizacion.facade.ts` (nuevo): lee el saldo y si ya hay
  habilitación, muestra el modal, registra la habilitación con motivo. Reemplaza la lógica de
  deuda que vivía en `CertificacionClaseBFacade`.
- `CertificacionClaseBFacade` / `CertificacionProfesionalFacade`: `generarCertificado()` (y
  `regenerarCertificado()` en B) confirman antes de invocar; Profesional reintenta tras autorizar
  la deuda, como B.
- Profesional: `elegible` pasa a ser "pago al día" (solo filtra el lote); se elimina
  `isEligibleForProfessionalCertificate` (fix-465-m).
- `certificacion-clase-b-content` / `certificacion-profesional-content`: se quitan las filas de
  confirmación inline de "Generar" (la del email se queda); en Profesional, la deuda ya no
  deshabilita el botón.
- Ficha del alumno: delega la confirmación al facade. En Profesional, el botón "Generar
  Certificado" deja de depender de los criterios académicos y aparece también en el piloto.
- `supabase/functions/_shared/certificate-debt.ts` (nuevo) + ambas edge functions. **Requiere
  desplegar `generate-certificate-b-pdf` y `generate-certificate-professional-pdf`.**

## Test de Regresión

- `certificate-confirmation.utils.spec.ts` — avisos, monto, motivo requerido o no.
- `certificado-autorizacion.facade.spec.ts` — sin deuda: confirm simple; con deuda sin
  habilitación: pide motivo y registra; con habilitación previa: no pide motivo; cancelar: false.
- `certificacion-clase-b.facade.spec.ts` / `certificacion-profesional.facade.spec.ts` — cancelar
  el modal no invoca la edge function; Prof. con `DEUDA_PENDIENTE` autoriza y reintenta.
- `supabase/functions/_shared/certificate-debt.test.ts` — con y sin saldo y habilitación.

## Progreso

- [x] Tests: util 11/11, `CertificadoAutorizacionFacade` 6/6, facade B 41/41, facade Prof. 25/25,
  contenido B 8/8, `certificate-debt.test.ts` (Deno) 4/4.
- [x] `npm run lint:arch` 0 errores (186 advertencias, igual que antes); `npm run test:ci` 4405 verdes.
  `deno check` de las dos edge functions: los mismos 12 errores de tipos preexistentes, ninguno nuevo.
- [x] `/verify`: lista Prof. (secretaria sede 2, alumno con $90.000 de saldo) → botón habilitado y
  modal con el monto y motivo obligatorio; lista B (secretaria) → modal simple "¿Generar…?"; ficha
  Prof. como admin, en el piloto → aparece "Generar Certificado" y abre el modal con deuda. Se
  canceló en todos los casos (sin habilitaciones nuevas). Consola sin errores.
- Eliminado `CertificacionProfesionalFacade.descargarPdf()`: sin callers y re-emitía sin confirmar.
- [ ] Despliegue de `generate-certificate-b-pdf` y `generate-certificate-professional-pdf`. Hasta
  entonces, Profesional valida la deuda solo en la UI.
