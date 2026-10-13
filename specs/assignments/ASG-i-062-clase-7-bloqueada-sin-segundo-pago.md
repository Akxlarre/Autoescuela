# Asignación ASG-i-062 — Clase 7 bloqueada sin el segundo pago (con habilitación rápida y forzado)

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P0
> **created:** 2026-10-13
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

**Requisito del cliente (Ignacio, 2026-10-13):** el alumno de Clase B empieza siempre con sus 12
clases agendadas, pero **no puede tomar la clase 7 si no pagó la segunda parte**. En el mesón el
caso es rápido: el alumno llega, paga y sube al auto. La secretaria tiene que ver que la clase está
bloqueada, cobrar y habilitarla en el momento, o forzarla en un caso especial.

Hoy el sistema no aplica nada de esto (verificado en código el 2026-10-13):

- Con saldo pendiente se inician y completan las 12 clases. Ni la agenda, ni los facades, ni
  ningún trigger miran `pending_balance`.
- "Dejar pago pendiente — Cobrar después" (paso 4 del wizard de matrícula) deja la matrícula activa
  con el 100% del saldo, y tampoco frena nada.
- El certificado Clase B se habilita al completar la clase 12 sin mirar el saldo
  (`verify_class_b_certificate_enablement`). Profesional sí exige saldo 0.
- El único aviso de cobro (`notify_deposit_reminder`, tras la clase 6) solo cubre
  `payment_mode = 'partial'` y solo le llega al alumno, no al personal.
- La matrícula online promete lo contrario del requisito: *"Pagas el 50% ahora y agendas
  igualmente tus N clases. El saldo lo completas cuando quieras"*.

Objetivo: bloquear el inicio de la clase 7+ con saldo pendiente, con una salida rápida (registrar el
pago ahí mismo) y otra excepcional (forzar con motivo), sin ocultarle la clase a la secretaria.

## Alcance sugerido

1. **Bloqueo en la BD.** No se puede pasar a `in_progress` una `class_b_sessions` con
   `class_number >= 7` si su matrícula tiene `pending_balance > 0` y no fue habilitada a mano. Cubre
   abono y "Cobrar después". Agendar sigue libre: las 12 clases quedan en la agenda. Va en la BD
   porque hay dos puntos de inicio (Asistencia Clase B y la app del instructor).
2. **La secretaria ve el bloqueo y lo resuelve en el momento.** En Asistencia Clase B la clase 7
   aparece como "Bloqueada: pago pendiente $X" (visible, no oculta), con un botón **"Registrar
   pago"** que abre el drawer de pago existente precargado con la matrícula y el saldo. Al guardar,
   el saldo queda en 0 y la clase se puede iniciar al tiro, sin recargar ni cambiar de pantalla.
3. **Forzar en un caso especial.** Botón "Habilitar sin pago" con motivo obligatorio. Pueden
   hacerlo **secretaria y admin** (decisión de Ignacio: la secretaria resuelve en el mesón y el admin
   puede no estar). Queda registrado quién, cuándo y por qué, y se avisa al admin. Habilita las
   clases restantes de esa matrícula.
4. **App del instructor.** Si intenta iniciar una clase bloqueada, mensaje claro ("Pago pendiente:
   el alumno debe pasar por secretaría"), no un error genérico.
5. **Aviso tras la clase 6.** Ampliar `notify_deposit_reminder()` a toda matrícula con
   `pending_balance > 0` (no solo `partial`) y avisar también al personal de la sede.
6. **Certificado Clase B con deuda.** Emitirlo pide confirmación con motivo obligatorio y queda
   registrado (mismo criterio que el punto 3: secretaria y admin).
7. **Texto de la matrícula online.** Corregir la promesa de
   `public-enrollment.component.ts` (~línea 792): la segunda parte se paga antes de la clase 7.

## Referencias

- `src/app/core/facades/asistencia-clase-b.facade.ts` → `startClass()`
- `src/app/core/facades/instructor-clases.facade.ts` → `startClass()`
- `src/app/core/facades/enrollment-payment.facade.ts` → `recordPayment()` (cómo se guarda el pago
  pendiente: `status = 'pending'`, `payment_date = null`)
- `supabase/migrations/20260710000200_fix_deposit_reminder_payment_mode.sql` (aviso actual)
- `supabase/migrations/20260412000001_fix_certificate_b_trigger.sql` (certificado sin mirar saldo)
- `src/app/core/facades/certificacion-profesional.facade.ts` (Profesional ya exige saldo 0)
- `ASG-i-060`: descartada como bug, porque los pagos `pending` tienen `payment_date` nula y no
  entran a los reportes. De esa revisión salió esta asignación.

## Archivos involucrados (opcional, para detectar solapes)

- Migración nueva: trigger de bloqueo en `class_b_sessions`, registro del forzado, ampliación de
  `notify_deposit_reminder()`
- `src/app/core/facades/asistencia-clase-b.facade.ts` y su `*-content` de Asistencia
- `src/app/core/facades/instructor-clases.facade.ts`
- `src/app/core/facades/certificacion-clase-b.facade.ts`
- `src/app/features/admin/pagos/registrar-pago-drawer.component.ts` (reutilizar, no duplicar)
- `src/app/features/public-enrollment/public-enrollment.component.ts`

## Notas para quien la reclame

- El trigger debe lanzar un código reconocible (ej. `PAGO_PENDIENTE_CLASE_7`) para que ambas
  pantallas muestren el mensaje correcto; manejarlo con `assertWriteOk`/mapeo de errores, no con un
  toast genérico.
- Un pago parcial de la segunda parte **no** desbloquea: el criterio es `pending_balance > 0`.
- El saldo solo cuenta pagos `status = 'paid'` (`recalculate_enrollment_balance()`); un pago
  `pending` no desbloquea.
- `notify_deposit_reminder` es `SECURITY DEFINER` y nunca debe abortar el UPDATE de la clase si
  falla; mantener ese patrón.
- Usar `public.chile_today()` / `chileToday()` si se agregan fechas (ARCH-27/28).
- Validar en el piloto con un alumno de prueba: abono sin segundo pago, "Cobrar después", pago en el
  mesón que desbloquea al tiro, y forzado con motivo.
