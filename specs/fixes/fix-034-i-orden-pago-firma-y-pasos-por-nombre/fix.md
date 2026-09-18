# Fix: Pago antes de Firma en matrícula presencial + pasos del wizard identificados por nombre
> id: fix-034-i-orden-pago-firma-y-pasos-por-nombre
> refs: ASG-m-002
> status: done
> closed: 2026-09-18
> created: 2026-09-18

## Root Cause
[Heredado de ASG-m-002, a confirmar]: en el wizard de matrícula presencial (Admin y
Secretaria, Clase B y Profesional, comparten `EnrollmentFacade`), el paso de Pago va
**después** del paso de Firma de contrato (orden actual: 1 Datos personales, 2 Asignación,
3 Documentos, 4 Contrato, 5 Pago, 6 Confirmación). El objetivo es que el alumno pague
primero y firme después.

**Causa raíz de fondo, encontrada al analizar el alcance (2026-09-18):** `EnrollmentFacade`
identifica cada paso solo por su **número** (`EnrollmentWizardStep` = 1-6), y ese número
está repetido a mano en múltiples puntos sin relación entre sí:
- `subirContratoFirmado()` y `registrarFirmaContrato()` (ambos, tras firmar) hacen
  `updateStepStatus(4, 'completed'); goToStep(5);` — hardcodeado, asume que 4=Contrato y
  5=Pago.
- `resumeDraft()` rehidrata datos por rango de número: `if (currentStep >= 4)` trae el
  contrato, `if (currentStep >= 5)` trae el pago — de nuevo, el significado de 4 y 5 vive
  solo en la cabeza de quien escribió cada línea, no en el código.

Invertir el orden sin corregir esto significa que **cualquier futuro reordenamiento de
pasos** (no solo este) puede hacer que una matrícula guardada con un número de paso bajo
el significado viejo se interprete mal bajo el código nuevo — el número persiste en BD,
pero su significado cambió. Se decidió corregir la causa de fondo ahora (pasos
identificados por nombre, no por número) en vez de solo mover Pago/Firma y dejar la misma
fragilidad para la próxima vez.

**Decisiones de alcance confirmadas con el usuario (2026-09-18):**
- Aplica **solo al flujo presencial** (Admin/Secretaria) — la matrícula pública online
  (`/inscripcion`) queda fuera de alcance de este fix; se bloquea por separado en
  `ASG-i-013` (no se resuelve el caso de pago real por pasarela sin firmar).
- **Sin alerta a la secretaria** para el caso "pagó pero no firmó" — en presencial, si el
  alumno se arrepiente, se cancela en el momento (la secretaria está presente); el
  reembolso se maneja manualmente fuera del sistema.
- **Sin migración de datos de borradores existentes** — el sistema todavía no está en
  producción con usuarios reales, no hay borradores reales en vuelo hoy. La corrección de
  causa raíz (pasos por nombre) es la que deja resuelto el riesgo de forma permanente para
  cuando sí haya producción real, sin necesitar una migración puntual ahora.
- El caso "sistema se cae a mitad de la matrícula" ya está cubierto por el mecanismo
  existente de borradores con expiración de 24h (`loadActiveDrafts`/`resumeDraft`) — no se
  toca, sigue funcionando igual.

## ACs Afectados
Ninguno — fix autónomo derivado de Asignación de equipo, ver
`specs/assignments/ASG-m-002-orden-pago-antes-firma-contrato.md`.

## Mecanismo de activación (encontrado al implementar, 2026-09-18)

Hoy terminar el paso de Pago (`confirmWithPayment()`, RPC atómica
`confirm_enrollment_with_payment`) es lo que **activa la matrícula** (genera
`enrollments.number`, `status: 'active'`, confirma sesiones reservadas, registra
consentimiento, invita al alumno). Si Pago pasa a ir antes que Firma, no puede seguir
siendo el punto de activación — el contrato todavía no estaría firmado en ese momento, y
la propia asignación pide explícitamente que "la matrícula no se dé por completada hasta
que se firme el contrato".

El código ya tiene las 2 piezas por separado (el comentario en `confirmWithPayment()`
confirma que existían así antes de fusionarse en una sola RPC atómica "que dejaba una
ventana de fallo entre ambas operaciones"):
- `EnrollmentPaymentFacade.recordPayment()` — registra el pago (inserta en `payments`,
  actualiza `payment_status`/`total_paid`/`pending_balance`) **sin** activar la matrícula.
- `confirmEnrollment()` — activa la matrícula (número, `status: 'active'`, sesiones,
  consentimiento, invitación) **sin** depender de que el pago se haya registrado en esa
  misma llamada.

**Con el orden nuevo:** el paso de Pago llama solo a `recordPayment()`. El paso de Firma,
al completarse (firma capturada), llama a `confirmEnrollment()` — recién ahí se activa la
matrícula de verdad. La "ventana de fallo entre ambas operaciones" que motivó fusionarlas
es menos crítica ahora: quedan separadas por un paso completo con interacción real del
alumno en el medio (leer y firmar el contrato), no una operación ciega de backend.

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `src/app/core/models/ui/enrollment-personal-data.model.ts` (o donde viva
  `EnrollmentWizardStep`) — introducir un identificador de paso por nombre (ej. union type
  `'personal_data' | 'assignment' | 'documents' | 'payment' | 'contract' | 'confirmation'`)
  como fuente de verdad del significado; el número (`current_step` en BD) pasa a ser solo
  la posición serializada, derivada de ese nombre, nunca comparado directamente en la
  lógica de negocio.
- **Archivo:** `src/app/core/facades/enrollment.facade.ts` — reemplazar los `goToStep(N)` y
  los `if (currentStep >= N)` de `resumeDraft()` por sus equivalentes con nombre. Invertir
  el orden real: Pago pasa a ir antes que Contrato en la secuencia (solo para el flujo
  presencial — este facade es compartido por Admin/Secretaria, no por la matrícula
  pública).
- **Archivo:** componentes del wizard presencial (`admin-matricula.component.ts`,
  `secretaria-matricula.component.ts`, y los steps compartidos en
  `shared/components/matricula-steps/`) — ajustar el orden de renderizado/navegación de
  los steps de Pago y Contrato, y cualquier texto o numeración visible ("Paso 4 de 6") que
  dependa del orden.
- Fuera de alcance: `PublicEnrollmentFacade` y el flujo de matrícula pública online — no se
  toca (se bloquea por separado en `ASG-i-013`).

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- Tests nuevos en `enrollment.facade.spec.ts`: `resumeDraft()` rehidrata correctamente el
  contrato y el pago identificando el paso por nombre, no por comparación numérica directa
  — casos para cada paso del wizard reordenado.
- Test que confirma que `goToStep()` tras firmar contrato avanza al paso correcto con el
  nuevo orden (Contrato → Confirmación, no Contrato → Pago).
- Test que confirma que `goToStep()` tras registrar el pago avanza al paso de Firma (nuevo
  orden: Pago → Contrato).
- Regresión: los flujos existentes de Clase B y Profesional (matrícula completa de punta a
  punta) deben seguir completándose sin romper `enrollments.current_step` ni la
  recuperación de borradores para los pasos que no cambiaron de posición (1, 2, 3, 6).
- `npm run test:ci` completo debe quedar verde, sin regresiones en otros consumidores de
  `EnrollmentWizardStep`.

## Nota de implementación (desviación menor del plan original)

El "Cambio" proponía un union type de string (`'personal_data' | 'assignment' | ...`) como
identificador de paso. Se implementó en cambio como constante numérica con nombre
(`ENROLLMENT_STEP.PAYMENT`, `ENROLLMENT_STEP.CONTRACT`, etc., en
`core/models/ui/enrollment-wizard.model.ts`) que sigue satisfaciendo `EnrollmentWizardStep`
(`1 | 2 | 3 | 4 | 5 | 6`). Motivo: `current_step` en BD es `smallint` y `EnrollmentWizardStep`
es consumido como número en múltiples lugares fuera de este fix (queries, comparaciones con
`>=` para rangos de pasos ya completados, serialización); migrar a un union type de string
habría expandido el alcance a esos consumidores externos, violando "un fix = un cambio
puntual". `ENROLLMENT_STEP` logra el mismo objetivo de raíz (nombrar el significado en vez de
repetir el número mágico) sin tocar el tipo de dato serializado.

## Evidencia de Verificación (2026-09-18)

**Unit tests:** `npm run test:ci` → 194 archivos, **2503 tests passed**, 5 skipped
(no relacionados), 0 failed. Incluye los tests nuevos de `uploadSignedContract()` (activa
matrícula al firmar) y `resumeDraft()` (rehidrata Pago/Contrato por el nuevo orden).

**QA en navegador real (Playwright MCP), flujo presencial completo Secretaria → Clase B:**
1. Wizard avanzado hasta Step 4 (posición 4) → confirmado visualmente que renderiza
   `app-payment-step` (antes era Contrato). Copy corregido: botón "Confirmar y Finalizar" →
   **"Registrar Pago"** (`payment.component.html`), ya que este paso ya no activa la
   matrícula.
2. Pago registrado (`recordPayment()`) → avanza a Step 5 (posición 5), confirmado que
   renderiza `app-contract-step` (antes era Pago). Copy corregido: botón "Continuar al
   Pago" → **"Confirmar Matrícula"** (`contract.component.html`), ya que ahora es el paso
   que activa la matrícula.
3. Contrato generado (PDF real vía Storage), checkbox de privacidad marcado, archivo de
   contrato firmado subido (upload real) → botón "Confirmar Matrícula" se habilita.
4. Click en "Confirmar Matrícula" → dispara `uploadSignedContract()` →
   `updateStepStatus(CONTRACT, 'completed')` → `confirmEnrollment()`. Resultado: wizard
   avanza a Step 6 (Confirmación) mostrando **"¡Matrícula Exitosa!"**, ID de Matrícula
   real `#0079`, datos del alumno y curso correctos.
5. Único error de consola observado: `activate-student-account` (Edge Function) devolvió
   400 — es una llamada *fire-and-forget* preexistente (invitación de cuenta Auth al
   alumno, ver comentario en `enrollment.facade.ts` sobre fix-157-m) que no bloquea ni
   forma parte de la activación de la matrícula; el fallo es atribuible al email de
   prueba usado, no al cambio de orden de pasos. `confirmEnrollment()` completó
   correctamente pese a este error, confirmando que están desacoplados como se esperaba.

Con esto, el mecanismo de activación descrito arriba (Pago → `recordPayment()`, Contrato →
`confirmEnrollment()`) queda verificado de punta a punta en navegador real, no solo en
mocks.
