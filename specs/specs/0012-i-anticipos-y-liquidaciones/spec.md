# Spec 0012-i — Anticipos y liquidaciones: tope, descuento sin negativos y pago registrado por la secretaria

> **Status:** draft
> **Created:** 2026-11-10
> **Owner:** Ignacio
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** testing de Contabilidad (`fix-073-i`, ASG-i-029), sospechas S11 y S12 confirmadas en
el navegador y en la base el 2026-11-10; decisiones de Ignacio del 2026-11-09.

**Persona afectada:** Admin (paga los sueldos y autoriza anticipos) y Secretaria (registra en el
sistema lo que el admin paga).

**Problema que resuelve:**
- Un anticipo puede ser de cualquier monto. Si los anticipos del mes superan el sueldo, la
  liquidación guarda un líquido negativo (Gabriel Molina, noviembre: base $11.500, anticipo
  $20.000 → `net_payment` −$8.500, pantalla $0) y el anticipo queda "descontado" completo aunque
  solo había $11.500 para descontar: los $8.500 restantes se pierden.
- El medio de pago y el código de transferencia que pide el modal no se guardan; "Deshacer pago"
  no pide confirmación.
- La secretaria tiene la pantalla de Liquidaciones pero la base no le deja leer horas ni pagos:
  ve $0, solo a los instructores con anticipos, y "Pagar" en una liquidación ya pagada.
- El admin paga pero, en la práctica, no va a marcar el pago en el sistema; quien lo registra es
  la secretaria. Hoy ni el pago de una liquidación ni los anticipos quedan en Auditoría.

**Hipótesis de valor:** la nómina queda registrada por quien opera el sistema todos los días, sin
montos negativos ni anticipos perdidos, y cada pago queda auditado con autor y montos.

---

## 2. User Stories

- **US1**: Como admin, quiero que un anticipo no pase de $300.000 en el mes sin una justificación,
  para controlar cuánto se adelanta.
- **US2**: Como admin, quiero que la liquidación nunca descuente más que el sueldo del mes y que el
  resto del anticipo se descuente el mes siguiente, para no perder ni regalar plata.
- **US3**: Como secretaria, quiero ver las liquidaciones de mi sede y marcarlas como pagadas cuando
  el admin paga, para que el sistema refleje lo que pasó.
- **US4**: Como admin, quiero ver en Auditoría quién marcó cada pago y cada anticipo, y con qué
  montos, para controlar lo que registra la secretaria.
- **US5**: Como admin, quiero un aviso cuando un mes ya terminado tenga instructores sin marcar como
  pagados, para que no quede nómina sin registrar.

---

## 3. Acceptance Criteria (Gherkin)

### Tope de anticipos

- **AC1**: Given un instructor con $250.000 anticipados en el mes, When se registra un anticipo de
  $50.000, Then se guarda sin pedir justificación (total del mes = $300.000).
- **AC2**: Given un instructor con $250.000 anticipados en el mes, When se intenta registrar
  $60.000, Then el formulario exige una justificación; sin ella no se guarda; con ella se guarda la
  justificación junto con quién lo autorizó. Aplica al formulario de Anticipos y al de "Agregar
  Egreso" de la Caja.
- **AC3**: Given el mismo caso de AC2, When se intenta insertar por fuera de la UI sin
  justificación, Then la base lo rechaza.

### Descuento al liquidar

- **AC4**: Given base del mes $11.500 y anticipos pendientes $20.000, When se paga la liquidación,
  Then `advances_deducted` = $11.500, `net_payment` = $0, y quedan $8.500 de anticipo pendiente
  que aparecen descontados en la liquidación del mes siguiente.
- **AC5**: Given base mayor que los anticipos, When se paga, Then el comportamiento es el de hoy
  (líquido = base − anticipos, anticipos "Descontado").
- **AC6**: Given el modal de pago, When se paga por transferencia con código, Then el medio de pago
  y el código quedan guardados y se ven en la fila pagada.
- **AC7**: Given una liquidación pagada, When el admin pulsa "Deshacer", Then pide confirmación; al
  confirmar vuelve a Pendiente y los anticipos descontados vuelven a pendientes (incluido el
  arrastre de AC4).

### Secretaria en Liquidaciones

- **AC8**: Given una secretaria de la sede 1, When abre Liquidaciones, Then ve los mismos
  instructores, clases, horas, base, anticipos y estado que el admin con la sede 1 elegida, y
  nada de la sede 2.
- **AC9**: Given una liquidación pendiente de su sede, When la secretaria la marca como pagada,
  Then queda "Pagado" con `paid_by` = la secretaria.
- **AC10**: Given una liquidación pagada, When la secretaria la mira, Then no tiene "Deshacer";
  si lo intenta por fuera de la UI, la base lo rechaza.
- **AC11**: Given la secretaria exporta la nómina, Then el archivo trae solo su sede y coincide con
  su pantalla.

### Auditoría y aviso

- **AC12**: Given cualquiera marca o deshace un pago de liquidación, Then Auditoría muestra quién,
  cuándo, instructor, período, base, anticipos descontados, líquido y medio de pago.
- **AC13**: Given se registra, modifica o borra un anticipo, Then Auditoría lo muestra con quién,
  instructor, fecha, monto y justificación si la hubo.
- **AC14**: Given un mes ya terminado con instructores sin marcar como pagados, When admin o
  secretaria abren Liquidaciones, Then ven un aviso con cuántos faltan y de qué mes.

### Edge cases obligatorios

- **AC-E1**: Given un instructor sin clases en el mes y con anticipos, When se liquida, Then el
  líquido es $0 y todo el anticipo pasa al mes siguiente.
- **AC-E2**: Given un anticipo arrastrado de un mes anterior, When se mira Anticipos, Then se ve
  como pendiente con su fecha original.
- **AC-E3**: Given dos pestañas pagan la misma liquidación, Then queda un solo pago (no se pisan
  los montos).

---

## 4. Out of scope

- ❌ Portal del instructor para ver su liquidación (fuera del piloto).
- ❌ Que el pago de una liquidación en efectivo salga como egreso de la Caja Diaria (J17, sin decidir).
- ❌ Pagar clases profesionales o teóricas en la liquidación (J12, sin decidir).
- ❌ Cambiar la tarifa por hora por sede (spec 0014-m).

---

## 5. Dependencias

### Specs previas
- `0014-m` (tarifa por hora por sede), `fix-445-m` (anticipos bloqueados en días con caja cerrada).

### Capacidades del proyecto que se asumen existentes
- `LiquidacionesFacade`, `AnticiposFacade`, `instructor_monthly_hours` (autorecálculo por trigger),
  `log_change()` y la vista de Auditoría (fix-363-m, fix-206).

### Capacidades nuevas requeridas
- Columnas de justificación en `instructor_advances`; medio de pago y código en
  `instructor_monthly_payments`; registro del monto descontado por anticipo (para el arrastre).
- RLS de lectura por sede para la secretaria en `instructor_monthly_hours` e
  `instructor_monthly_payments`; INSERT de pago para la secretaria; DELETE solo admin.
- Triggers de auditoría en `instructor_monthly_payments` e `instructor_advances`.

---

## 6. Datos y modelo (preliminar)

- Tablas modificadas: `instructor_advances`, `instructor_monthly_payments` (detalle en `plan.md`).
- RLS requerida: ver §5.

---

## 7. UX y flujos (preliminar)

- Pantallas: Liquidaciones (admin y secretaria), modal de pago, drawer de anticipo (Anticipos y
  Caja), Auditoría.
- Flujo principal: el admin paga en persona → la secretaria marca "Pagado" con el medio de pago →
  Auditoría lo registra.

---

## 8. Métricas de éxito post-launch

- Cero liquidaciones con `net_payment` negativo.
- Meses cerrados sin liquidaciones pendientes.

---

## 9. Notas / decisiones abiertas

- [ ] **Horas:** ¿se pagan exactas (3 clases = 2,25 h = $11.250) o redondeadas a 1 decimal
  (2,3 h = $11.500, como hoy)? (checklist J02)
- [ ] **Reportes:** ¿los anticipos cuentan como gasto del mes en Reportes Contables? (checklist H05)
- [ ] ¿El tope de $300.000 se configura en Ajustes o queda fijo?
- Decisiones ya tomadas por Ignacio (2026-11-09): tope $300.000 por **total del mes** con
  justificación para superarlo; la secretaria ve y exporta su sede, marca pagado y no deshace;
  auditoría obligatoria del pago; aviso de meses sin marcar.
- Originado de Asignación ASG-i-029 (`specs/assignments/ASG-i-029-testing-contabilidad.md`), track
  de testing `fix-073-i`.

---

## Changelog

- 2026-11-10 — draft inicial por Ignacio (con Claude), a partir de `fix-073-i`.
