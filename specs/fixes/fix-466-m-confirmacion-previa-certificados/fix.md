# Fix: Confirmaciones al generar certificados (Clase B y Profesional)
> id: fix-466-m-confirmacion-previa-certificados
> refs: fix-447-m-testing-documentos-certificacion · fix-465-m · spec 0010-i (AC8, AC-E5)
> status: done
> closed: 2026-10-19
> created: 2026-10-19

## Root Cause

Las reglas de emisión no estaban unificadas entre Clase B y Profesional:

1. **La deuda solo se controlaba en Clase B.** La spec 0010-i (AC8, Ignacio) dejó una convención:
   si la edge function rechaza por saldo pendiente (`DEUDA_PENDIENTE`), un modal pide el motivo,
   se registra la habilitación en `enrollment_payment_overrides` (`kind = 'certificado'`), se avisa
   a los admins y se reintenta. Vale para admin y secretaria. Profesional no tenía nada: el admin
   emitía con deuda sin dejar registro, y la secretaria quedaba bloqueada sin vía de excepción.
2. **La asistencia bloqueaba en Profesional.** La secretaria necesitaba teoría ≥ 75 %, y la ficha
   exigía teoría, pago y nota (en el piloto el botón ni aparecía, fix-332-m). Decisión de Matías:
   la asistencia nunca bloquea; si al levantar el piloto un alumno está bajo el mínimo, se avisa.
3. **Las confirmaciones eran filas inline dentro de la tabla** (prácticas incompletas del admin en
   Clase B, práctica < 100 % en Profesional, envío de email), distintas de los modales de la ficha.
   Matías: que todas sean modales.

## Decisiones (Matías, 2026-10-19)

- No hay un modal "siempre antes de emitir". Solo se confirma cuando hay algo que avisar.
- Se mantienen las confirmaciones que existían, convertidas a modal: prácticas incompletas (admin,
  Clase B), práctica < 100 % (Profesional), envío de email. Se suma teoría < 75 % (Profesional),
  que solo aparece cuando hay asistencia registrada (no en el piloto).
- "Regenerar" mantiene su modal. El drawer de "Generar pendientes" se queda igual.
- Deuda: convención de Ignacio en ambas licencias, solo cuando la edge function rechaza.
- Ficha Profesional: el botón aparece también en el piloto y sigue las reglas de la lista.

## ACs Afectados

- AC propio — Clase B: con las clases completas, "Generar" emite directo. Admin con clases
  incompletas → modal de aviso (lista y ficha). Secretaria → botón deshabilitado, sin cambios.
- AC propio — Profesional: sin avisos, "Generar" emite directo; con práctica < 100 % o teoría < 75 %
  → modal de aviso que nunca bloquea. Ni la asistencia ni la deuda deshabilitan el botón.
- AC propio — Deuda (ambas): si la edge function responde `DEUDA_PENDIENTE`, modal de 0010-i con
  motivo, se registra la habilitación y se reintenta. `generate-certificate-professional-pdf` exige
  la habilitación igual que la de Clase B (helper compartido).
- AC propio — "Generar pendientes" en Profesional toma solo a los que tienen el pago al día y, como
  en Clase B, salta y cuenta a los que la función rechace por deuda.
- AC propio — Envío de email (lista B y Prof.): modal en vez de fila inline.
- AC propio — Ficha Profesional: "Generar Certificado" visible también en el piloto, con las reglas
  de la lista.

## Cambio

- `core/utils/certificate-confirmation.utils.ts` (nuevo, puro): avisos, modal de avisos (`null` si
  no hay), modal de email, resumen del lote.
- `core/facades/certificado-autorizacion.facade.ts` (nuevo): `confirmarAvisos()`,
  `confirmarRegeneracion()`, `confirmarEnvioEmail()` y `autorizarDeuda()` (la lógica de 0010-i
  que vivía en `CertificacionClaseBFacade`, ahora compartida con Profesional).
- `CertificacionClaseBFacade` / `CertificacionProfesionalFacade`: generar, regenerar y enviar email
  confirman con ese facade; Profesional reintenta tras autorizar la deuda, como B.
- Profesional: `elegible` = pago al día (solo filtra el lote); se elimina
  `isEligibleForProfessionalCertificate` (fix-465-m) y `descargarPdf()` (sin callers).
- `certificacion-clase-b-content` / `certificacion-profesional-content`: sin filas inline.
- Ficha del alumno: delega las confirmaciones al facade.
- `supabase/functions/_shared/certificate-debt.ts` (nuevo) + ambas edge functions. **Requiere
  desplegar `generate-certificate-b-pdf` y `generate-certificate-professional-pdf`.**

## Test de Regresión

- `certificate-confirmation.utils.spec.ts` — avisos, modal o `null`, email, resumen.
- `certificado-autorizacion.facade.spec.ts` — sin avisos no abre modal; con avisos sí; email;
  deuda: motivo y registro.
- `certificacion-clase-b.facade.spec.ts` / `certificacion-profesional.facade.spec.ts` — sin avisos
  no confirma; cancelar no invoca; `DEUDA_PENDIENTE` autoriza y reintenta; email confirma antes.
- `supabase/functions/_shared/certificate-debt.test.ts` — con y sin saldo y habilitación.

## Progreso

- [x] Ajuste a lo decidido (sin modal "siempre"; filas → modales; email con modal). La primera
  versión de este fix (commit `a01dc81f`) abría un modal antes de toda emisión y pedía el motivo de
  deuda por adelantado; Matías lo descartó y se corrigió en el commit siguiente.
- [x] `npm run lint:arch` 0 errores (186 advertencias, igual que antes). `npm run test:ci`: 4408
  verdes; 1 falla intermitente ajena (`promociones.facade.spec.ts` AC3, timeout de 5 s; pasa en 2 de
  3 corridas sueltas). Specs del fix: 146/146.
- [x] `/verify` como admin: lista B (tarjetas) → "Generar" con 7/12 abre el modal de aviso; email
  y "Regenerar" abren sus modales; ninguna fila inline. Lista Prof. → "Generar" visible para un
  alumno con deuda (no se apretó: emitiría de verdad mientras la función no esté desplegada). Ficha
  Prof. → "Generar Certificado" visible en el piloto. Todo cancelado; consola sin errores.
- [x] Despliegue de `generate-certificate-b-pdf` y `generate-certificate-professional-pdf` (Matías,
  2026-10-19). Verificado: "Generar" en Profesional para un alumno con $90.000 de saldo → la función
  responde 409 `DEUDA_PENDIENTE` y aparece el modal "Certificado con deuda" con motivo; cancelado,
  el certificado sigue pendiente.
