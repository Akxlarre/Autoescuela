# Fix: Testing — Matrícula presencial (Clase B, refuerzo y Clase Profesional)
> id: fix-058-i-testing-matricula-presencial
> refs: ASG-i-023
> status: in_progress
> created: 2026-10-18

> **Track de testing, no de corrección.** Acá se registra el resultado de cada caso (✅ / ❌ +
> evidencia). **Cada bug encontrado va a su propio fix/hotfix**; no se corrige dentro de este
> track.
>
> **Checklist que se ejecuta:** `specs/testing-piloto/023-matricula-presencial.md`.

## Root Cause

[Heredado de ASG-i-023, a confirmar]: La matrícula presencial es el flujo de entrada de dinero y
alumnos del piloto, y el que más módulos toca a la vez: crea alumno + matrícula, agenda clases
(Triple Match), genera contrato, registra el primer pago, sube documentos al DMS, crea la cuenta
del alumno y dispara notificaciones. Un error acá se propaga a agenda, pagos, cuadratura y
documentos.

**Clasificación:** Integración/E2E · dificultad Alta · rutas: `/app/admin/matricula`,
`/app/secretaria/matricula` (con `enrollmentDraftGuard`).

### Alcance confirmado al reclamar (Ignacio, 2026-10-18)

Las 3 capas de la ASG entran en este track:

1. **Funcional** — ACs de `0006-m` (refuerzo), `0009-m`/`0010-m` (consentimientos Ley 21.719),
   `0016-m` (plantillas de contrato), `ASG-m-002` (pago antes de la firma), `ASG-m-001` y
   `fix-089-m` (licencia B con 2 años para Profesional), `fix-064-b` (DV del RUT).
2. **E2E manual** — los casos A…Q del checklist, incluidas las sospechas S1–S24.
3. **Playwright** — candidatos "Auto ✓".

Fuera de alcance: matrícula pública `/inscripcion` y Webpay (bloqueadas en el piloto).

**Supuestos al reclamar:**

1. **El checklist (2026-09-29) se actualiza antes de ejecutar.** Varias sospechas ya pueden estar
   resueltas por tracks posteriores (ej. S9 fecha del pago en UTC → la pone la RPC
   `record_enrollment_payment` con `chile_today()` desde fix-050-i; el paso Pago cambió en
   fix-050/052/053/057-i). Las resueltas se ejecutan como regresión, no como sospecha.
2. **Datos de prueba:** las matrículas reales se crean al final, con RUT y N° de documento de
   prueba (`QA-058-*`), y se listan acá para limpiarlas.
3. **SQL:** los tests de BD los corre Ignacio en el SQL Editor; escriben en sub-bloques que
   abortan y no dejan datos.

## ACs Afectados

Ninguno de una spec: es un track de testing. Los ACs de las specs del alcance se verifican como
casos del checklist.

## Cambio

Ninguno de código en este track. Cada bug va a su propio fix/hotfix.

## Test de Regresión

- Los casos del checklist `specs/testing-piloto/023-matricula-presencial.md` con su resultado.

## Progreso

- [x] Bloque 0 — 24/24 sospechas revisadas contra el código actual (2026-10-18). Ver tabla abajo.
- [x] Bloque 1 — BD (2026-10-18): P04/P05 ✅; S8 confirmada (B1-1); limpieza vs consentimientos
      latente (B1-2); S12 a confirmar en la UI (Bloque 3).
- [x] Bloque 2 — pantallas sin guardar (2026-10-18): validaciones del paso 1 ✅; B2-1 (S10 error
      del pago mudo), B2-2 (S11 notarial), B2-3 (S21 cambio de sede), B2-4 (mensaje de duplicado
      engañoso). Los descuentos (H) ya se probaron en fix-048-i Bloque 4.
- [x] Bloque 3 — matrículas reales `QA-058` (2026-10-18/19): Clase B completa ✅ (N° 0084),
      Refuerzo y Profesional hasta el paso 2 ✅, borradores ✅; B3-1 (error crudo con alumno de
      otra sede), B3-2 (S7 RUT), B3-3 (S6 segundo borrador), B3-4 (S14 SENCE).
- [x] Bloque 4 — visual y accesibilidad (2026-10-19): oscuro y móvil ✅; B4-1 (tarjetas con
      botones anidados), B4-2 (ARIA inválido en el paso 1); contraste → ASG-i-065.
- [ ] Abrir los fixes de los bugs (pendiente de prioridad con Ignacio) y limpiar los datos `QA-058`.

### Bloque 0 — sospechas contra el código actual (lectura, sin datos)

| # | Estado hoy | Evidencia |
|---|---|---|
| S1 contrato sin sesión | ✅ resuelta | `generate-contract-pdf` llama `requireStaff(req, ['admin','secretary'])` |
| S2 "no se confirmó" pero quedó activa | ✅ resuelta | `confirmEnrollment()` registra el consentimiento **antes** de activar y reusa el número en el reintento |
| S3 horarios ya pasados | ✅ resuelta | `fix-228-b`: la vista filtra `> now()` en hora de Chile |
| S4 DV reemplaza el último dígito | ✅ resuelta | `fix-213-b`: `completeRutDv` solo completa si falta, nunca reemplaza |
| S5 consentimiento promocional pegado | ✅ resuelta | `reset()` limpia ambos consentimientos |
| S7 corregir el RUT no se guarda | ❌ sigue | `upsertUser` con `userId` conocido: el `UPDATE` no incluye `rut` |
| S8 pagos de un borrador descartado/expirado se borran | ❌ sigue | `cleanup_expired_drafts` (fix-393) hace `DELETE FROM payments` de los borradores expirados |
| S9 fecha del pago en UTC | ✅ resuelta | `record_enrollment_payment` pone `chile_today()` (fix-050-i) |
| S10 errores de Pago/Documentos no se muestran | ❌ sigue | el wizard solo pinta `enrollment.error()`; nadie pinta `payment.error()` y `documents.component.html` no muestra `uploadError`. Ahora pesa más: los avisos de caja cerrada (fix-051-i) y de la RPC (fix-050-i) quedarían mudos en el paso Pago |
| S13 admin "mueve" de sede al alumno | ❌ sigue | `upsertUser` escribe `branch_id` = sede de la matrícula sobre el usuario existente |
| S14 código SENCE no se guarda | ❌ sigue | `loadSenceCodes()` no tiene llamadores: `_senceCodeMap` vacío → `sence_code_id` siempre `null` |
| S22 edad un día antes | ✅ resuelta | `calcAge` usa `toChileDate` + `chileToday()` |
| S6 cambiar el curso crea otro borrador | ❌ sigue | `savePersonalData` busca el borrador por (alumno, curso) con `findExistingDraft`; con otro curso inserta uno nuevo |
| S11 menor de 17 sin autorización notarial | ❓ probar | el aviso dice "súbela en la sección de documentos"; hay que ver si Clase B ofrece dónde subirla |
| S12 secretaria de otra sede duplica una matrícula activa | ❓ probar (SQL) | depende de la RLS de `enrollments` vista por la secretaria B |
| S15 retomar en el paso 2 deja horarios propios "ocupados" | ❓ probar | `resumeDraft` repone `_selectedSlotIds` pero no `_ownReservedSlotIds` |
| S16 grilla libre vs trigger ocupado (borrador expirado) | ❓ probar | depende del cron; caso E20 |
| S17 promociones llenas se pueden elegir | ✅ resuelta en la UI | `promotionOptionStatus` → `full` y la opción se deshabilita ("SIN CUPO"); la BD no lo valida |
| S18 la UI promete cosas que no hace | ◐ en parte | el correo con el contrato firmado ya existe (fix-318-m); quedan "Comprobante de Pago", "Activar Cámara", "Máx 2MB", HVC 30 días |
| S19 aviso falso de "no se pudo crear la cuenta" | ⏸ no aplica en el piloto | fix-393-m: con el portal alumno bloqueado no se invoca `activate-student-account`; el aviso por 409/400 sigue latente para después del piloto |
| S20 re-matrícula: Retirado y Refuerzo | ❌ sigue (decisión de negocio) | `HISTORICAL_STATUSES` = `completed`, `cancelled` (sin `withdrawn`); Clase B y Refuerzo comparten `license_class` (casos C08–C10) |
| S21 admin cambia de sede a mitad del wizard | ❓ probar | el efecto limpia el formulario del paso 1 y recarga cursos, pero el borrador sigue en la sede original |
| S23 N° del contrato impreso ≠ N° final | ❓ probar | número "previsto" sin reservar |
| S24 descuentos (% sobre el abono, motivo manual no se guarda) | ❓ probar (decisión H02/H08/H15) | el motivo del descuento manual sigue sin `discount_applications` (solo los predefinidos la crean) |

### Bloque 1 — BD (`supabase/tests/rls/fix-058-i-b1-matricula-bd.sql`, corrido por Ignacio 2026-10-18)

| Caso | Resultado | Evidencia |
|---|---|---|
| P04 secretaria B lee matrículas de un alumno de A | ✅ | 0 filas |
| P04 secretaria A modifica una matrícula de B | ✅ | 0 filas |
| P05 secretaria A descarta un borrador de B | ✅ | 0 filas |
| S12 secretaria B encuentra al alumno de A por RUT | pregunta | 0 filas en `users`: el wizard no lo encuentra |
| S12 secretaria B crea otra matrícula al alumno de A | pregunta | la BD lo permite ("insertó"). En la UI probablemente choca antes al crear el `users` con RUT repetido → confirmar en Bloque 3 |
| S8 hoy | pregunta | 0 borradores con pagos cobrados (sin daño real aún) |
| S8 limpieza de un borrador vencido con pago | ❌ **B1-1** | re-test con una matrícula sin consentimientos: "pagos borrados". Confirmada: `cleanup_expired_drafts()` borra los `payments` cobrados de un borrador vencido. Hoy no hay borradores con pagos (sin daño real aún) |
| Limpieza vs consentimientos | ⚠️ **B1-2** (latente) | con consentimientos registrados, `cleanup_expired_drafts()` falla entera (`consents_enrollment_id_fkey`) y no limpia ningún borrador. Hoy: 0 borradores con consentimientos y 0 vencidos sin limpiar → la limpieza funciona. Se daría si `confirmEnrollment()` registra el consentimiento (va antes de activar desde el arreglo de S2) y la activación falla, y el borrador vence |

**B1-1 — S8 confirmada.** Decisión de negocio pendiente (casos K12/K13/O11 del checklist): un pago
ya cobrado en un borrador que se descarta o vence, ¿se conserva, se anula con registro, o el pago
se registra recién al firmar? → su propio fix cuando haya decisión.

**B1-2 — La limpieza de borradores se cae con un borrador que tenga consentimientos.** Latente: hoy
no hay ninguno. Arreglo probable: borrar (o desvincular) `consents` del borrador en
`cleanup_expired_drafts()`, o no registrar el consentimiento hasta activar. → su propio fix.

### Bloque 2 — pantallas sin guardar (Playwright, todas las escrituras interceptadas, 2026-10-18)

| Caso | Resultado | Evidencia |
|---|---|---|
| S10 error del pago en el paso 4 | ❌ **B2-1** | RPC simulada con el aviso de caja cerrada (fix-051-i): `payment.error()` = "Error al registrar pago: La caja del 18-10-2026 ya está cerrada…", pero **no se ve en pantalla**; el wizard queda en el paso 4 sin mensaje (el banner solo lee `enrollment.error()`) |
| S11 menor de 17 en Clase B | ❌ **B2-2** | el paso 3 solo tiene la foto (1 input de archivo); el aviso "Se requiere Autorización Notarial… Súbela en la sección de documentos del expediente" no ofrece dónde subirla ni la exige. Ver si el DMS la permite (ASG-i-033, Matías) |
| B07–B10, B12, B15 validaciones del paso 1 | ✅ | `canAdvance` de `personal-data`: nombre/apellido < 2 letras o solo espacios, email `juan@` / `juan@x`, teléfono de 7 dígitos, fecha vacía y sin curso → no avanza. Sin apellido materno sí avanza. RUT con DV malo → no avanza |
| B12 fecha 31/02 | ✅ (no alcanzable) | `canAdvance` la dejaría pasar (edad "none"), pero `app-date-input` es un calendario que solo emite fechas válidas |
| D06 SENCE | ✅ | sin código no avanza; con código sí (que se guarde es S14, Bloque 3) |
| D08–D12 edad mínima | ✅ | 16 a. 364 d. y "cumple 17 mañana" bloquean; 17 años + Clase B avanza con aviso de autorización; 19 + A2 bloquea; "cumple 20 hoy" avanza y "cumple 20 mañana" bloquea |
| D13 Profesional sin licencia previa | ✅ | no avanza |
| D14 A2 con licencia B de hace 1 año | ✅ | aviso no bloqueante "Le faltan 13 meses para cumplir los 2 años de licencia clase B…" |
| D17 A2 / A2 conv. A4 (mismo `type`) | ✅ | se distinguen por `convalidatesSimultaneously`; solo queda marcado el elegido |
| D18 licencia previa con fecha futura | ◐ baja | se acepta con el aviso "Le faltan 27 meses…": no dice que la fecha es imposible |
| C01 precarga por RUT (egresado Alumno62) | ✅ | nombre, email, teléfono, nacimiento se precargan |
| C04 / C05 egresado + Clase B | ✅ | aviso "Re-matrícula en el mismo curso… se conserva como historial" con confirmación; "Cancelar" deja el paso 1 sin crear nada |
| C06 Clase B activa (Alumno79) + Clase B | ✅ | "Matrícula duplicada… No es posible crear una nueva" |
| C08 Clase B activa + Refuerzo | ❌ **B2-4** + decisión | bloquea (S20, decisión de negocio pendiente) y además el mensaje es **engañoso**: "ya tiene una matrícula en curso en Refuerzo Clase B", cuando lo activo es Clase B (nombra el curso elegido, no el existente) |
| C13 / C14 email de otra persona (también con mayúsculas) | ✅ | "Este correo ya está registrado por otra persona…"; no avanza y el botón no queda pegado |
| C07, C10–C12, C15–C17 | → Bloque 3 | requieren datos que no existen hoy (retirado, cancelado, funcionario, archivado, otra sede) o crear la matrícula |
| S21 admin cambia de sede a mitad del wizard | ❌ **B2-3** | en el paso 3, sede 1 → 2: sigue en el paso 3 con el mismo borrador (de la sede 1), el formulario del paso 1 queda vacío, se cargan los cursos de la sede 2 (aparece Profesional) y no hay aviso |

### Bloque 3 — matrículas reales `QA-058` (Playwright como secretaria sede 1, 2026-10-18)

**Datos de prueba creados (limpiar al final):**

| Qué | IDs |
|---|---|
| Alumno "QA Cincuentaiocho Claseb Prueba", RUT 33.058.001-1, `qa058.claseb@test-data.local` | users 9080 · students 8787 |
| Matrícula Clase B N° 0084 (activa) | enrollments 8495 |
| 12 clases con Instructor1 (id 222), 16-nov a 01-dic 15:00 | class_b_sessions de la 8495 |
| Pago pendiente $150.000 ("Cobrar después") | payments 3632 (reemplazó a 3631) |
| Descuento "Padre Hurtado" $30.000 | discount_applications 6 |
| Foto carnet y contrato firmado de prueba | student_documents / digital_contracts 215 (`contracts/8495/contract.png`) |
| Consentimientos | consents de la 8495 (3 filas) |
| Alumno "QA Cincuentaiocho Borrador Prueba", RUT 33.058.002-K (sede 2, secretaria2) | users 9082 · students 8788 |
| 2 borradores del mismo alumno (S6) | enrollments 8496 (Clase B, **ya descartado** en K) y 8497 (Clase B SENCE, paso 2), sin horarios ni pagos |
| Alumna "QA Cincuentaiocho Refuerzo Prueba", RUT 33.058.003-8 (sede 2) | users 9102 · students 8808 · borrador 8517 (Refuerzo, paso 2) |
| Alumno "QA Cincuentaiocho Profesional Prueba", RUT 33.058.004-6 (sede 2) | users 9103 · students 8809 · borrador 8518 (Profesional A2, paso 2) |

| Caso | Resultado | Evidencia |
|---|---|---|
| Happy path Clase B (pasos 1→6) | ✅ | borrador 8495 → paso 2 con 12 horarios → foto → pago → contrato → "¡Matrícula Exitosa! #0084" |
| Paso 4 con descuento predefinido + "Cobrar después" | ✅ | 1 pago `pending` $150.000 sin fecha; `discount_applications` $30.000; saldo $150.000 `pending` |
| H18 volver al paso 4 y guardar otra vez | ✅ | sigue 1 pago (3631 → 3632) y 1 descuento (fix-050-i) |
| H — texto del botón con "Cobrar después" | ◐ baja | el botón sigue diciendo "Registrar Pago" aunque no se registra un pago |
| I contrato | ✅ | PDF con N° 0084, "domingo, 18 de octubre de 2026" (día de Chile a las 23:2x), datos y foto del alumno |
| S23 N° previsto vs final | ✅ (esta vez) | el PDF dijo 0084 y la matrícula quedó 0084 (sin otra matrícula en paralelo) |
| I / S5 consentimientos | ✅ | `matricula_datos` y `comunicaciones_operativas` true; `comunicaciones_promocionales` false (no se marcó) |
| J activación | ✅ | `active`, N° 0084, `expires_at` null, 12 clases `scheduled`, foto `approved`, contrato firmado guardado |
| O Pagos / Base de Alumnos | ✅ | deudor "N° 0084 · Clase B" $150.000; aparece en Base de Alumnos |
| S12 / C17 secretaria sede 2 matricula al alumno de la sede 1 | ❌ **B3-1** | no precarga (no lo ve) y al guardar muestra el error crudo "Error al crear usuario: duplicate key value violates unique constraint "users_rut_key"". No duplica (lo frena la unicidad del RUT), pero el mensaje no dice qué pasa ni qué hacer. Decisión M07/M08 pendiente: ¿quién matricula a un alumno de otra sede? |
| S7 corregir el RUT tras guardar el paso 1 | ❌ **B3-2** | se cambió a 33.058.003-8 y se guardó: la BD sigue con 33.058.002-K (el `UPDATE` de `users` no incluye `rut`) y la pantalla muestra el nuevo |
| S6 volver y cambiar el curso | ❌ **B3-3** | Clase B → Clase B SENCE: se creó el borrador 8497 y el 8496 sigue vivo (con horarios elegidos los bloquearía hasta que venza) |
| S14 código SENCE | ❌ **B3-4** | con código "1237958058", `enrollments.sence_code_id` de la 8497 quedó `null`; al retomar el borrador el campo vuelve vacío |
| K lista de borradores | ✅ | "Matrículas en progreso" lista los 2 borradores del alumno (paso 1 y paso 2) |
| K descartar | ✅ | "¿Descartar matrícula? … no se puede deshacer" → la 8496 se borra de la BD |
| K retomar en el paso 2 | ✅ | la 8497 vuelve al paso 2 con alumno, RUT y curso |
| E06 Refuerzo Clase B (spec 0006-m) | ✅ | con la página recién cargada: 6 clases requeridas (4,5 h / 45 min), solo "Total Adelantado", sin pago parcial |
| F Profesional A2 — paso 2 | ✅ | lista las promociones abiertas con cupos ("0 / 25 cupos · DISPONIBLE"), de la 279 a la 283 |
| O03 Agenda | ◐ | en BD las 12 clases de la 8495 quedaron `scheduled` con Instructor1; la vista de Agenda no se abrió (la cubre ASG-i-026 de Benjamín) |

### Bloque 4 — visual y accesibilidad (axe WCAG 2 A/AA, 2026-10-19)

| Pantalla | Resultado | Evidencia |
|---|---|---|
| Oscuro y móvil 375 px (paso 1) | ✅ | se ve bien; sin scroll horizontal |
| Lista "Matrículas en progreso" | ❌ **B4-1** | `nested-interactive` (serio) ×3: cada tarjeta de borrador es clicable y tiene botones adentro ("Retomar", "Descartar"); un lector de pantalla no puede anunciarlos bien |
| Paso 1 | ❌ **B4-2** | `aria-required-children` y `aria-valid-attr-value` (críticos) en el contenedor del formulario: un `role` ARIA sin sus hijos esperados y un atributo ARIA con valor inválido |
| Contraste (lista y paso 1) | ❌ (ASG-i-065) | `color-contrast` ×19 en la lista y ×7 en el paso 1: el gris `text-muted` (ej. "FECHA DE NACIMIENTO *", subtítulos). Es del sistema de diseño, no de la matrícula → va con ASG-i-065 |
| Etiquetas de fecha | ◐ baja | "FECHA DE NACIMIENTO *" y "FECHA DE OBTENCIÓN…" salen en mayúsculas grises (estilo `micro-label` de `app-date-input`), distintas del resto de las etiquetas del formulario |

**Resumen Bloque 0:** 8 resueltas (S1, S2, S3, S4, S5, S9, S17, S22), 1 no aplica en el piloto
(S19), 1 en parte (S18), 6 siguen abiertas por código (S6, S7, S8, S10, S13, S14 + S20 de
negocio) y 7 hay que probarlas en navegador o SQL (S11, S12, S15, S16, S21, S23, S24).
