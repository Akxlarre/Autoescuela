# fix-017-m — Clase B: agendar siempre las 12 clases (desacople pago/agenda)

## Contexto

Cambio de requerimiento de negocio: al matricularse en **Clase B** (vista pública
o admin/secretaria), el alumno **siempre agenda las 12 clases prácticas**. Ya no
se agenda solo la primera mitad cuando elige abonar.

La modalidad de pago **se conserva**: se puede seguir matriculando pagando solo la
primera mitad (50%, ~$90.000 con precios actuales), pero el agendamiento es
independiente del pago — siempre son las 12.

Hoy la app acopla ambas cosas con la fórmula
`payment_mode === 'partial' ? Math.ceil(total/2) : total` en ~10 lugares. El fix
corta ese vínculo: el agendamiento usa siempre el total (12); solo el **monto**
mira `payment_mode`.

## Decisiones de negocio (confirmadas con el dueño)

- **Datos legacy:** los alumnos de test con 6 clases agendadas NO se migran (no
  son reales). No causan crash; solo quedan inservibles para probar el flujo de
  12 clases/certificado.
- **Portal del alumno:** la sección "Pagos y Clases" pasa a llamarse **"Pagos"**.
  Solo se habilita el pago del saldo para quienes abonaron la primera mitad
  (igual que hoy), pero **sin agendar nada** (ya tienen las 12).
- **Agenda (admin/secretaria):** la reprogramación de clases ya agendadas vive en
  la ficha del alumno (`AdminAlumnoDetalleFacade.reprogramarClase`) y **se
  mantiene**. El agendamiento de clases faltantes desde la Agenda **se elimina**
  (era su único propósito). Al hacer click en un slot **disponible**, se muestra
  un drawer de **solo lectura** con el detalle del horario libre (instructor /
  vehículo) — no permite agendar.

## Hallazgos / Lógica afectada

1. **Núcleo del conteo (origen del "6"):**
   `public-enrollment.facade.ts:325` (`requiredSlotCount`),
   `enrollment.facade.ts:128` (`_requiredSlotCount`),
   `secretaria-matricula.component.ts:220`,
   `public-enrollment.component.ts:605-621`.
2. **Edge Function `student-payment`:** crea las clases 7-12 al pagar la segunda
   mitad (`:633`). Con la matrícula creando siempre 12, esto duplicaría sesiones
   → debe eliminarse. `needsSlotSelection` (`:284`) pasa a fijo `false` para B.
3. **Edge Function `public-enrollment`:** verificar que `reserve-slots`/
   `slot_holds` toleren 12 slots (sin tope de 6). Monto 50% se mantiene.
4. **Portal alumno:** `alumno-pagos.component.ts:52` (título),
   `alumno-pagar.component.ts` (wizard con selección de 6 horarios),
   `student-payment.facade.ts:83` (`requiredCount = 6`).
5. **Agenda:** `secretaria-agenda.component.ts:46` (+ admin si existe),
   `agenda-schedule-drawer.component.ts` (a eliminar),
   `agenda.facade.ts:272-330` (`loadAgendableStudents`, `scheduleClass`,
   `agendableStudents`), `agenda.model.ts` (`AgendableStudent`).
6. **Textos de matrícula:** `public-enrollment.component.ts:677-683`
   (card "Abono 50%"), `public-payment-mode.component.ts`,
   `assignment.component.html:85` (`ceilHalf`), `payment.component.ts`.

## Acceptance Criteria

- [x] AC0: Matricular Clase B con "abono 50%" (público y admin/secretaria) exige
  seleccionar las **12** clases; el monto cobrado sigue siendo el 50%.
- [x] AC1: Pagar el saldo (segunda mitad) registra el pago y actualiza
  `payment_status`/`pending_balance` **sin crear sesiones nuevas** (no hay
  duplicados); el alumno conserva sus 12 sesiones ya agendadas.
- [x] AC2: El portal del alumno muestra la sección como **"Pagos"**; quien abonó
  ve "Pagar saldo" sin paso de agenda; quien pagó completo no ve acción
  pendiente. Sin copys de "elegir/agendar 6 horarios".
- [x] AC3: En la Agenda no se puede agendar clases restantes de nadie. Click en
  slot **disponible** abre drawer de **solo lectura** (instructor/vehículo).
  La reprogramación desde la ficha del alumno sigue funcionando.
- [x] AC4: Ningún texto de matrícula (público ni admin) afirma que el abono
  agenda solo la mitad; la card de abono indica que igual se agendan las 12.
- [x] AC5: `enrollments.payment_mode` se conserva (cobro/saldo); sin cambios de
  esquema en BD; sin migración de datos.

## Test de regresión

`src/app/core/facades/enrollment.facade.spec.ts` (partial → 12)
`src/app/core/facades/public-enrollment.facade.spec.ts` (requiredSlotCount = total)
`src/app/core/facades/student-payment.facade.spec.ts` (sin selección de slots)
`src/app/core/facades/agenda.facade.spec.ts` (sin agendableStudents)
