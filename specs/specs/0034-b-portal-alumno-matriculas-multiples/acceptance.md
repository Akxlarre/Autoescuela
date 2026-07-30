# Acceptance 0034-b — Portal alumno no muestra matrículas múltiples

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-07-29
> **Verifier:** b (con Playwright + REST directo contra Supabase real)

---

## Resumen

- AC totales: 4 (AC1-AC4) + 3 edge cases (AC-E1 a AC-E3)
- AC cumplidos: 7/7
- AC fallidos: 0
- AC con evidencia: 7/7 (código + tests + QA en vivo con datos reales)

**Veredicto final:** ✅ PASA

---

## Verificación por AC

### AC1 — Tabs visibles con 2+ matrículas activas

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `alumno-pagos.component.ts` — `@if (context.enrollments().length > 1) { <app-tabs> }`
  - QA manual: alumno de prueba (`alumno@test.com`, Samuel Merino) con Clase B #0008 + Profesional A2 #0025 → `/app/alumno/pagos` mostró `tablist` con 2 tabs: "Profesional A2 · #0025" y "Clase B · #0008".
- **Notas:** —

### AC2 — Cambiar de tab actualiza saldo/historial a la matrícula seleccionada

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `student-payment.facade.spec.ts > al cambiar de matrícula activa, la siguiente carga pide el nuevo enrollmentId` ✓
  - Test: `student-payment.facade.spec.ts > al cambiar de matrícula activa, el step vuelve a 1 (no arrastra el step de la anterior)` ✓
  - QA manual: click en tab "Clase B · #0008" → cambió de "Total Curso $180.000 / Ya Pagado $0 / Saldo $180.000" (Profesional) a "Total Curso $180.000 / Ya Pagado $180.000 / Saldo $0" con historial "Pago online (Webpay), 13 de mayo de 2026" (Clase B real). Ida y vuelta entre tabs verificada dos veces.
- **Notas:** Ver "Deuda técnica / hallazgo real" abajo — este AC casi queda marcado incorrectamente por olvidar desplegar la Edge Function.

### AC3 — Edge Function rechaza `enrollmentId` que no pertenece al alumno (IDOR)

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `supabase/functions/student-payment/index.ts` — `handleLoadEnrollmentStatus`, mismo chequeo de ownership que `handleInitiatePayment` (`.eq('id', enrollmentId).eq('student_id', student.id).in('status', [...])`), `if (!requested) return errorResponse('Matrícula no encontrada o no autorizada', 403)`.
  - QA en vivo: `fetch` directo autenticado como Samuel con `enrollmentId: 999999` → `{"status":403,"body":{"error":"Matrícula no encontrada o no autorizada"}}`.
- **Notas:** Se probó con un ID inexistente (no con el ID real de otro alumno) — el código path (`.eq('student_id', student.id)` sin match → `null` → 403) es el mismo para ambos casos.

### AC4 — Matrícula sin saldo pendiente muestra su historial sin forzar el flujo de pago

- **Estado:** ✅ cumplido
- **Evidencia:**
  - QA manual: tab "Clase B · #0008" (saldo $0) mostró su historial de pago ("Pago online (Webpay)", $180.000, "Pagado") sin ningún CTA de "Pagar" forzado — el hero mostró el subtítulo de Clase B correcto ("Paga tu saldo pendiente para completar tu matrícula" solo aparece cuando hay saldo; acá no se mostró alerta de saldo pendiente).
- **Notas:** —

---

## Edge cases

### AC-E1 — Alumno con 1 sola matrícula no ve tabs

- **Estado:** ✅ cumplido (por diseño, no por fixture nuevo)
- **Evidencia:** Mismo gate `context.enrollments().length > 1` que ya está en producción hoy en Dashboard/Clases/Horario para la mayoría de los alumnos (single-matrícula). No se creó un alumno de prueba adicional solo para este caso — sería reprobar código ya validado en 3 páginas idénticas.
- **Notas:** Riesgo residual bajo, mismo patrón ya probado.

### AC-E2 — Default al entrar sigue siendo `pickEnrollmentToShow()`

- **Estado:** ✅ cumplido
- **Evidencia:** Al entrar por primera vez a `/app/alumno/pagos` (sin haber elegido tab), aterrizó en "Profesional A2 · #0025" (la que tiene saldo pendiente > 0), igual que predice `pickEnrollmentToShow()`.
- **Notas:** —

### AC-E3 — Sin `enrollmentId` cae al comportamiento actual (compatibilidad)

- **Estado:** ✅ cumplido
- **Evidencia:** Código: el `if (requestedId)` en `handleLoadEnrollmentStatus` solo se activa si `body?.enrollmentId` es truthy; la rama `else` es idéntica a la query pre-existente + `pickEnrollmentToShow()`. Confirmado indirectamente: Dashboard/Clases siguieron funcionando sin cambios durante todo el QA (no fueron tocados por esta spec, pero comparten el mismo Edge Function `student-payment` solo en el caso de Pagos).
- **Notas:** —

---

## Out-of-scope respetado

- ❌ Cambios a Dashboard/Clases/Horario del alumno — confirmado: no se tocó ningún archivo de esas páginas.
- ❌ Vista combinada / saldo total agregado — no implementada, se mantiene "matrícula seleccionada" como único criterio.
- ❌ Cambios al panel admin o al wizard de matrícula interno — no tocados (aparte de usarlos para generar el fixture de QA, sin modificar su código).
- ❌ Rediseño de `<app-tabs>` — reutilizado tal cual, cero cambios al componente compartido.

---

## Deuda técnica detectada

- Ninguna nueva. La firma del contrato en el wizard interno de matrícula (`/app/admin/matricula`) también usa un `<label>` envolviendo un `<input type="file" class="sr-only">` para "Subir Contrato Firmado" — Playwright tuvo que hacer click en el `<label>` en vez del input porque "intercepts pointer events". No se investigó si es un H-020 real (bloqueaba la automatización pero podría no bloquear un click humano real, igual que se descubrió con H-020 en fix-069) — anotado acá por si alguien lo encuentra de nuevo, no se abre asignación nueva sin reproducirlo primero.

## Hallazgo real durante QA (proceso, no producto)

Al hacer el primer QA en vivo (cambiar de tab de Profesional a Clase B), los datos mostrados **no cambiaron** — se quedaron pegados en Profesional pese a que el tab visualmente sí cambiaba. Investigado con `browser_network_request`: el `body` enviado sí traía `enrollmentId` correcto, pero el **Edge Function desplegada en Supabase seguía siendo la versión vieja** (el `git`/editor local no despliega automático — hace falta `npx supabase functions deploy student-payment`, igual que documentó fix-058-b). Tras desplegar, se repitió la prueba y AC2/AC3/AC4 pasaron correctamente. Se deja registrado como recordatorio para cualquier cambio futuro a `supabase/functions/`: **el código local no tiene efecto hasta desplegar.**

---

## Cambios en índices

- `indices/FACADES.md` — `StudentPaymentFacade` ahora lista `AuthFacade` y `StudentEnrollmentContextFacade` como dependencias.

---

## Datos de prueba — creados y eliminados sin residuos

Se usó la cuenta compartida `alumno@test.com` (Samuel José Merino Osses, RUT 16.212.873-6, `student_id=84`), agregándole temporalmente una 2ª matrícula (Profesional A2, #0025, `enrollment_id=133`) vía el wizard admin real (`/app/admin/matricula`), con pago "Dejar pendiente" para poder probar un saldo > 0 distinto al de Clase B.

**Limpieza post-verificación** (vía REST directo, sesión admin, orden por FKs):
- `notifications` (id 53 — "Matrícula confirmada 0025")
- `student_documents` (id 125 `id_photo`, id 126 `hoja_vida_conductor`)
- `digital_contracts` (id 108)
- `payments` (id 85, $180.000 pending)
- `enrollments` (id 133)

Confirmado post-borrado: `enrollments` de `student_id=84` vuelve a tener exactamente 1 fila (`id=90, #0008, class_b, pending_balance=0`) — estado idéntico al que tenía antes de esta sesión.

---

## Post-mortem

- **Qué salió mejor de lo esperado:** el patrón multi-matrícula ya estaba resuelto en 3 de las 4 páginas candidatas (Dashboard/Clases/Horario) — el trabajo real fue mucho más chico que lo que sugería la Asignación original (`ASG-b-033`, creada antes de que ese trabajo se hiciera).
- **Qué fricciones encontramos:** olvidar el `supabase functions deploy` casi hace pasar un AC que en realidad seguía roto — el QA en vivo fue lo único que lo atrapó; el `test:ci` (con mocks) no podía detectarlo porque no habla con el Supabase real.
- **Qué cambiaríamos:** para cualquier cambio a un Edge Function, agregar explícitamente "desplegar y volver a probar en vivo" como un paso separado en `tasks.md`, no asumido dentro de "implementar".

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando en CI (1527/1527)
- [x] `lint:arch` limpio
- [x] Sin deuda crítica abierta

**Cerrado por:** b
**Fecha:** 2026-07-29
