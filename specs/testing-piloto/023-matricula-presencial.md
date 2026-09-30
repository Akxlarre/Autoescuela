# Testing — Matrícula presencial (Clase B, Refuerzo y Clase Profesional)

> **Asignación:** `ASG-i-023` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** `/app/admin/matricula`, `/app/secretaria/matricula` (ambas con `enrollmentDraftGuard`).
> El mismo wizard (`SecretariaMatriculaComponent`) se abre **en drawer** desde Base de Alumnos
> ("Nueva Matrícula"), Ex-Alumnos B y Profesional ("Re-matricular") y el Dashboard de secretaria.
> **Incluye:** los 6 pasos del wizard (datos personales, asignación, documentos, pago, contrato,
> confirmación), borradores (crear, retomar, descartar, expirar), alumno existente / re-matrícula,
> consentimientos Ley 21.719, creación de la cuenta del alumno, entrada por ruta y por drawer,
> admin vs secretaria, sedes, concurrencia de horarios, y verificación cruzada en Base de Alumnos,
> Agenda, Pagos, Cuadratura y Documentos.
> **No incluye:** matrícula pública `/inscripcion` y Webpay (bloqueadas en el piloto), test
> psicométrico (spec `0010-m`, solo existe en el flujo público/pre-inscritos), el detalle interno de
> Agenda/Pagos/Cuadratura (ver `026`, `028`, `029`), la lista de Base de Alumnos (ver `024a`).
>
> **Código leído para armar esta lista:**
> `features/secretaria/matricula/secretaria-matricula.component.{ts,html}`,
> `features/admin/matricula/admin-matricula.component.ts`, `core/guards/enrollment-draft.guard.ts`,
> `shared/components/matricula-steps/{personal-data,assignment,documents,payment,contract,confirmation,draft-list}/`,
> `shared/components/schedule-grid/schedule-grid.logic.ts`,
> `core/facades/{enrollment,enrollment-payment,enrollment-documents,consents}.facade.ts`,
> `core/utils/{rut,age,license-seniority,reenrollment,image}.utils.ts`,
> `core/models/ui/enrollment-documents.model.ts`, `core/config/pilot-phase.config.ts`,
> `supabase/functions/generate-contract-pdf/`, `supabase/functions/activate-student-account/`,
> `supabase/config.toml`, migraciones de `cleanup_expired_drafts` (`20260308160000`,
> `20260805100000`), `v_class_b_schedule_availability` (`20260917110000`),
> `prevent_double_booking_class_b_sessions` (`20260812150000`), `get_next_enrollment_number`
> (`20260915100000`), `recalculate_enrollment_balance` (`20260301000008`), RLS de `users`
> (`indices/DATABASE.md`), `docs/UAT-PLAN.md` (Paquete 2), specs `0006-m`, `0009-m`, fixes
> `fix-020-m`, `fix-033-i`, `fix-034-i`, `fix-064-b`, `fix-241-m`, DG-050/DG-052/DG-060/DG-062.

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-023`, y **cada bug va a su
  propio fix/hotfix**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`).
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S24)** salen de leer el código, **no están confirmadas** en navegador.
  Confirmarlas o descartarlas es parte del trabajo.
- **Orden real del wizard (fix-034-i):** 1 Datos personales → 2 Asignación → 3 Documentos →
  4 **Pago** → 5 **Contrato** (al subir el firmado se activa la matrícula) → 6 Confirmación.
  El pago se registra **antes** de que la matrícula exista como activa.
- Toda matrícula de prueba deja datos reales (alumno, pagos, clases). Usar RUT de prueba y anotar
  cada uno para limpiarlo después.

---

## 1. Sospechas de bug encontradas en el código

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🔴 Alta | **El contrato se puede descargar sin iniciar sesión.** `generate-contract-pdf` tiene `verify_jwt = false` y no revisa el header `Authorization` ni el rol: cualquiera que conozca la URL de la función puede pedir `{ enrollment_id: N }`, recorrer los IDs y recibir una URL firmada del contrato (RUT, dirección, fecha de nacimiento, teléfono, foto). Además la llamada **sobrescribe** `digital_contracts.file_url` de esa matrícula con el PDF sin firmar. | `supabase/config.toml:357-358`; `generate-contract-pdf/index.ts:52-67,186-195` |
| S2 | 🔴 Alta | **"La matrícula no se confirmó" pero sí quedó activa.** `confirmEnrollment()` pasa la matrícula a `active` con número **antes** de registrar el consentimiento; si el consentimiento falla, muestra "No se pudo registrar el consentimiento… La matrícula no se confirmó" y corta: la matrícula queda `active`, con sus 12 clases en `reserved` (invisibles en Dashboard/Asistencia, DG-050) y sin cuenta de alumno. Al reintentar (botón habilitado porque `contract_accepted = true`) genera **otro número** (N+1, porque la propia matrícula ya cuenta como no-draft). | `enrollment.facade.ts:1414-1443,799-803`; `20260915100000_fix252…:101-110` |
| S3 | 🟠 Media-Alta | **Se pueden agendar clases en horas que ya pasaron.** La grilla no tiene límite inferior de hora: la vista genera slots desde el inicio de `CURRENT_DATE` y ni el facade ni la grilla filtran los ya pasados. Una clase agendada en el pasado podría terminar marcada como inasistencia por el cron nocturno. | `enrollment.facade.ts:845-852`; `20260917110000_hotfix003…:52-56`; `schedule-grid.logic.ts:35-44` |
| S4 | 🟠 Media-Alta | **El DV automático convierte cualquier error de tipeo en otro RUT "válido".** Al salir del campo, `autocompleteRutDv` **reemplaza** el último carácter por el DV calculado: si tipeas solo el cuerpo `12345678` queda `1.234.567-4` (otra persona); si equivocas un dígito, el DV ya no lo detecta. Después el blur precarga los datos de ese otro RUT si existe ("Datos precargados"). | `rut.utils.ts:78-86`; `personal-data.component.ts:258-265`; `fix-064-b/fix.md:70` (el propio fix documenta `99999999 → 9.999.999-3`) |
| S5 | 🟠 Media-Alta | **Consentimiento promocional "pegado" (Ley 21.719).** `reset()` no limpia `_privacyConsentAccepted` ni `_promotionalConsentAccepted`. La casilla vuelve a verse desmarcada (estado local del componente), pero el facade conserva el `true` de la matrícula anterior (o de antes de pulsar "Volver"): se registra "acepta promociones" sin que nadie lo marcara. | `enrollment.facade.ts:1316-1338,2054-2077`; `contract.component.ts:44,63` |
| S6 | 🟠 Media | **Volver al paso 1 y cambiar el curso crea un segundo borrador.** `savePersonalData` busca un borrador por (alumno, curso): con otro curso inserta una matrícula nueva y el borrador anterior queda vivo con sus 12 horarios `reserved` bloqueando la agenda hasta que expire. | `enrollment.facade.ts:692-744` |
| S7 | 🟠 Media | **Tras crear el borrador, corregir el RUT o el email no hace lo esperado.** Con `userId` ya conocido se saltan las validaciones de RUT/email duplicado y el `UPDATE` de `users` no incluye `rut`: el RUT corregido **no se guarda** (el resumen y la confirmación muestran el nuevo, la BD guarda el viejo). Un email de otra persona termina en error crudo de BD. | `enrollment.facade.ts:564,2106-2131` |
| S8 | 🟠 Media | **Pagos cobrados que desaparecen.** El pago se inserta en el paso 4, con la matrícula aún en `draft`. Si luego se descarta el borrador, o expira (14 h) y corre el cron, **se borran los `payments`** — el dinero ya está en caja pero sale de Pagos/Cuadratura sin rastro. | `enrollment.facade.ts:1914,2324-2327`; `20260805100000_fix_cleanup…:63`; `secretaria-matricula.component.ts:749-763` |
| S9 | 🟠 Media | **Fecha del pago en UTC.** `payment_date = new Date().toISOString().split('T')[0]`: un pago registrado después de las 21:00 (hora Chile, UTC-3) queda con la fecha de **mañana** y no cuadra en la caja del día. | `enrollment-payment.facade.ts:254` |
| S10 | 🟠 Media | **Errores de Pago y de Documentos no se muestran.** El banner del wizard solo lee `enrollment.error()`. Si falla `recordPayment` (o la subida de un documento/foto a Storage) el error queda en otro facade: el spinner se apaga y no pasa nada, sin mensaje. | `secretaria-matricula.component.html:148-156`; `enrollment-payment.facade.ts:264-269`; `documents.component.html` (no pinta `uploadError`) |
| S11 | 🟠 Media | **A un alumno de 17 años (Clase B) nunca se le pide la Autorización Notarial.** El paso 1 dice que se adjuntará en Documentación y el paso 3 dice "súbela en la sección de documentos", pero para Clase B la lista de documentos es vacía y solo se exige la foto. El consentimiento de menores (spec `0009-m` AC7) se apoya justamente en esa autorización. | `secretaria-matricula.component.ts:307-310`; `documents.component.html:317-328`; `personal-data.component.html:198-213` |
| S12 | 🟠 Media | **Secretaria de otra sede puede duplicar una matrícula activa.** El bloqueo de re-matrícula consulta `enrollments` con la sesión del usuario; la RLS oculta a la secretaria B la matrícula activa del alumno en la sede A → veredicto `allow`. Además, sus `UPDATE` a `users`/`students` de otra sede no aplican (RLS, sin error) aunque el aviso diga "sus datos se actualizarán". | `enrollment.facade.ts:537-551,1630-1633,2140-2151`; `indices/DATABASE.md` (`update_users`) |
| S13 | 🟠 Media | **Admin "mueve" de sede al alumno (o al funcionario).** `upsertUser` escribe `users.branch_id = sede de la matrícula` sobre el usuario existente: matricular en la sede B a un alumno de A lo saca de A; matricular a una secretaria/instructor como alumno le cambia su sede de trabajo. | `enrollment.facade.ts:2106-2112,2140-2151` |
| S14 | 🟠 Media | **El código SENCE se pide pero nunca se guarda.** fix-241-m agregó el input obligatorio, pero el facade lo traduce con `_senceCodeMap`, que solo llena `loadSenceCodes()` — que nadie llama. `sence_code_id` queda siempre `null`. | `enrollment.facade.ts:685-689,398-424`; `fix-241-m/fix.md:17-21` |
| S15 | 🟡 Baja-Media | **Retomar un borrador en el paso 2 deja los horarios propios como "ocupados".** `resumeDraft` repone los slots seleccionados pero no `_ownReservedSlotIds`: la grilla los pinta ocupados por el propio borrador y no se pueden deseleccionar para cambiarlos. | `enrollment.facade.ts:1802-1814,2490-2492`; `schedule-grid.logic.ts:57` |
| S16 | 🟡 Baja-Media | **La grilla dice libre, el guardado dice ocupado.** La vista ignora reservas de borradores expirados, pero el trigger anti doble-agendamiento no (hasta que corre el cron a las 00:00 Chile). Y como antes de insertar se borran las reservas previas del borrador, al fallar se pierden todas. | `20260917110000…:74`; `20260812150000_fix163…:25-33`; `enrollment.facade.ts:1055-1072`; cron `20260308160000:75-79` |
| S17 | 🟡 Baja-Media | **Promociones llenas se pueden elegir (sobrecupo).** Solo se deshabilitan las `finished`; ni la UI ni `saveAssignment` comparan inscritos vs cupo. | `assignment.component.html:318`; `enrollment.facade.ts:1086-1131` |
| S18 | 🟡 Baja | **La UI promete cosas que no hace:** "Comprobante de Pago" no hace nada (TODO); "Se ha enviado una copia del contrato al email del alumno" (no existe ese envío); "Activar Cámara" no tiene acción; "Máx 2MB" no se valida; la HVC exige fecha de emisión pero no se pide y su validación de 30 días nunca se ejecuta. | `secretaria-matricula.component.ts:405-408,820-822`; `documents.component.html:105-110,221`; `enrollment-documents.model.ts:52-61`; `enrollment-documents.facade.ts:469` (solo lo usa el spec) |
| S19 | 🟡 Baja | **Aviso falso de "no se pudo crear la cuenta".** `activate-student-account` responde 409 si el alumno ya activó su cuenta y 400 si el usuario no tiene rol alumno (funcionario): en una 2ª matrícula o al matricular a un funcionario aparece el toast de advertencia aunque todo esté bien. | `activate-student-account/index.ts:308-318`; `enrollment.facade.ts:1543-1549` |
| S20 | 🟡 Baja | **Re-matrícula: reglas que chocan con el negocio.** `withdrawn` (Retirado) no es "histórico" → bloquea con "ya tiene una matrícula en curso". Clase B y Refuerzo comparten `license_class = 'B'` → un alumno con Clase B activa no puede tomar Refuerzo, y un egresado de Clase B ve "Re-matrícula en el mismo curso" al tomar Refuerzo. | `reenrollment.utils.ts:14-25,58`; `enrollment.facade.ts:569-580` |
| S21 | 🟡 Baja | **Admin cambia de sede en el topbar a mitad del wizard:** se borra el formulario del paso 1 y se recargan cursos/instructores/descuentos de la sede nueva, pero el borrador sigue en la sede original y el paso actual no cambia (instructor de B para matrícula de A, precio de respaldo, sin descuentos). | `secretaria-matricula.component.ts:132-152,120-127` |
| S22 | 🟡 Baja | **Edad un día antes.** `calcAge` usa `new Date('YYYY-MM-DD')` (medianoche UTC = día anterior en Chile): quien cumple 17/18/20 **mañana** ya aparece con esa edad hoy. | `age.utils.ts:40-48` |
| S23 | 🟡 Baja | **Número del contrato impreso ≠ número final.** El PDF usa un número "previsto" que no se reserva; si otra matrícula de la sede se confirma entre la impresión y la firma, el alumno firma un contrato con un número que termina siendo de otro. | `generate-contract-pdf/index.ts:133-152`; `enrollment.facade.ts:2301-2322` |
| S24 | 🟡 Baja | **Descuentos:** el % se calcula sobre el monto a pagar hoy (en pago parcial, sobre el 50%); el motivo del descuento manual se pide pero no se guarda (no hay `discount_applications`); el manual acepta decimales. El tipo de licencia previa en Profesional no se valida (A5 con licencia previa "B" solo avisa antigüedad). | `enrollment-payment.facade.ts:143-145,272-290`; `payment.component.ts:59-79`; `license-seniority.utils.ts:60-64` |

**Otras observaciones menores** (sin sospecha propia, cubiertas por casos): "Cancelar" del paso 1 y
"Volver al Inicio" navegan al Dashboard también desde el drawer (`secretaria-matricula.component.ts:810-818`);
el canal Realtime de la grilla no se cierra al salir (`ngOnDestroy` no llama `reset`, `:467-471`);
el borrador dura 14 h, no 24 h como dice el comentario de `resumeDraft` (`enrollment.facade.ts:1717,2324-2327`);
re-matricular a un alumno archivado lo reactiva sin avisar (`upsertStudent` pone `status: 'active'`,
`:2197`); la confirmación atómica `confirm_enrollment_with_payment` ya no la usa el wizard (`:1481`,
sin llamadores).

---

## 2. Datos de prueba necesarios

Preparar antes de ejecutar (seed de spec `0008-i` + ajustes). Anotar acá el RUT/ID real usado.

| Dato | Cómo debe estar | Para qué | Dato usado |
|---|---|---|---|
| D1 | RUT nunca registrado, 25 años, email nuevo | Happy path Clase B / Profesional | |
| D2 | Alumno con matrícula Clase B `completed` (egresado) y foto carnet en esa matrícula | Re-matrícula, foto anterior | |
| D3 | Alumno con Clase B `active` en la sede A | Bloqueo de re-matrícula | |
| D4 | Alumno con Clase B `active` en la sede B | S12 (secretaria de A lo matricula) | |
| D5 | Alumno con Clase B `withdrawn` y otro con `cancelled` | S20 | |
| D6 | Funcionario (secretaria o instructor) sin perfil de alumno | "Personal de la autoescuela", S13, S19 | |
| D7 | Fechas de nacimiento: 16 años 364 días · cumple 17 **mañana** · 17 años · cumple 18 mañana · 19 años · cumple 20 hoy · cumple 20 mañana | Edad mínima y bordes (S22) | |
| D8 | Email ya usado por otra persona (anotar en minúsculas y variante con mayúsculas) | Email duplicado | |
| D9 | Instructores sede A: 2 con vehículo activo; 1 sin vehículo; 1 con `both_branches`; 1 sin horarios libres | Paso 2 Clase B | |
| D10 | Cursos activos por sede: Clase B, Clase B SENCE, Refuerzo Clase B, A2, A3, A4, A5; uno sin `base_price` (solo si se puede crear en local) | Paso 1 y precios | |
| D11 | Promociones Profesional: abierta con cupo; **llena** (inscritos = cupo); iniciada hace > 3 días; de la otra sede; `finished` | Paso 2 Profesional, S17 | |
| D12 | Descuentos: % vigente, monto fijo vigente, vencido, de la otra sede, de un curso específico, `applicable_to = professional` | Paso 4 | |
| D13 | Borradores en sede A detenidos en los pasos 1, 2, 3, 4 y 5; uno con `expires_at` ya pasado (aún sin cron); uno en sede B | Retomar/descartar | |
| D14 | Archivos: JPG y PNG normales, JPG > 1200 px, HEIC/WEBP, PDF, archivo > 10 MB, un `.txt` renombrado a `.jpg` | Documentos y contrato | |
| D15 | Alumno archivado (Papelera) con matrícula B `completed` | Re-matricular archivado | |
| D16 | Licencias previas: B de hace 1 año, B de hace 3 años, A2 de hace 3 años | Validación Profesional | |

**Cuentas:** admin; secretaria sede A; secretaria sede B; secretaria con grant multi-sede
(`can_access_both_branches = true`); secretaria sin sede asignada; un navegador **sin sesión**
(S1). Para los casos de 2 sesiones: 2 navegadores o perfiles distintos.

---

## 3. Casos

### A. Acceso y entradas al wizard

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Secretaria entra a `/app/secretaria/matricula` sin borradores | Skeleton → paso 1 limpio. Consola sin errores, red sin 4xx/5xx | ✓ | |
| A02 | Admin con una sede elegida entra a `/app/admin/matricula` | Paso 1 limpio (o lista de borradores de esa sede) | ✓ | |
| A03 | Admin con "Todas las sedes" entra a la ruta | Pantalla "¿En qué sede trabajas hoy?"; al elegir, arranca el wizard en esa sede | ✓ | |
| A04 | En la pantalla de sede, elegir la sede desde el topbar en vez del botón | Arranca igual (mismo camino) | — | |
| A05 | Mientras está el wizard, abrir el selector de sede del topbar | No ofrece "Todas las sedes" (`requiresSpecificBranch`) | — | |
| A06 | Salir del wizard (admin) | El topbar vuelve a ofrecer "Todas"; ¿la sede elegida en la pantalla de sede queda puesta? — anotar | — | |
| A07 | Secretaria escribe `/app/admin/matricula` | Acceso denegado | ✓ | |
| A08 | "Nueva Matrícula" desde Base de Alumnos (admin y secretaria) | Wizard en drawer con badge "Paso 1 de 6" | ✓ | |
| A09 | "Nueva Matrícula" desde el Dashboard de secretaria | Wizard en drawer | ✓ | |
| A10 | "Re-matricular" desde Ex-Alumnos B **(§4)** | Confirma, abre el wizard con los datos de D2 precargados y toast "Datos precargados" | ✓ | |
| A11 | Tras A10, cerrar el drawer y abrir "Nueva Matrícula" de nuevo | ¿Vuelve a precargar a D2? (el `?rut=` queda en la URL) — no debería | — | |
| A12 | Con borradores en la sede | Lista "Matrículas en progreso" con nombre, RUT, curso, paso N/6 y fecha | ✓ | |
| A13 | Recargar con F5 en medio del wizard | Vuelve a la lista de borradores; el borrador está ahí | ✓ | |

### B. Paso 1 — Campos del formulario

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| B01 | Tipear RUT con puntos y guion | Se formatea al vuelo; "RUT válido" en verde | ✓ | |
| B02 | Tipear letras distintas de K, símbolos | No se aceptan | ✓ | |
| B03 | Pegar RUT sin formato (`123456785`) | Se formatea `12.345.678-5` | ✓ | |
| B04 | Tipear cuerpo + DV equivocado y salir del campo | Hoy lo "corrige" solo (fix-064-b). Verificar el mensaje: ¿queda claro que cambió? | ✓ | |
| B05 | Tipear **solo el cuerpo** (8 dígitos, sin DV) y salir **(§4)** | Esperado de negocio: agregar el DV. Probable: toma el último dígito como DV y deja otro RUT (S4) | ✓ | |
| B06 | RUT con DV K | Acepta `K` y `k`; guarda en mayúscula | ✓ | |
| B07 | Nombres / Apellido paterno con 1 letra o solo espacios | Borde rojo; "Guardar y Continuar" deshabilitado | ✓ | |
| B08 | Sin apellido materno | Permite avanzar; sin "undefined" en resumen, contrato ni lista | ✓ | |
| B09 | Email mal escrito (`juan@`, `juan@x`) | Error en el campo; botón deshabilitado | ✓ | |
| B10 | Teléfono con menos de 8 caracteres | Botón deshabilitado (no hay mensaje: ¿se entiende por qué?) | ✓ | |
| B11 | Sexo | Viene preseleccionado "Masculino"; solo M/F — confirmar que es lo deseado | — | |
| B12 | Fecha de nacimiento vacía o imposible (31/02) | Botón deshabilitado | ✓ | |
| B13 | Dirección vacía | Permite avanzar (no es obligatoria) — confirmar | — | |
| B14 | Nombre con tildes y ñ, nombre muy largo | Se guarda y se ve bien en resumen, contrato PDF y confirmación | — | |
| B15 | Llenar todo menos el curso | Botón deshabilitado | ✓ | |
| B16 | Doble clic rápido en "Guardar y Continuar" | Un solo alumno y un solo borrador creados | ✓ | |
| B17 | "Cancelar" en el paso 1 | Vuelve al Dashboard sin preguntar; desde el drawer también sale de Base de Alumnos — ¿es lo esperado? | — | |

### C. Paso 1 — Alumno existente, re-matrícula y duplicados

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | RUT de D2 (egresado): al salir del campo | Precarga nombre, email, teléfono, nacimiento, sexo, dirección; no toca el curso | ✓ | |
| C02 | Precarga con datos ya tipeados a mano | Hoy los sobrescribe. ¿Es aceptable? | — | |
| C03 | Tipear el RUT despacio (pausa > 0,5 s) y luego salir | ¿Aparece 2 veces el toast "Datos precargados"? | — | |
| C04 | D2 + Clase B → Guardar **(§4)** | Modal "Re-matrícula en el mismo curso"; al confirmar crea matrícula nueva y conserva la anterior | ✓ | |
| C05 | D2 + Clase B → Cancelar en ese modal | No crea nada; sigue en el paso 1 | ✓ | |
| C06 | D3 (Clase B activa) + Clase B | Modal "Matrícula duplicada", no avanza | ✓ | |
| C07 | D3 + Profesional A2 | "RUT ya registrado… nuevo curso"; se crea; ambas matrículas separadas en la ficha | ✓ | |
| C08 | D3 + Refuerzo Clase B | Hoy bloquea (misma licencia B, S20) — **decisión** | ✓ | |
| C09 | D2 (egresado Clase B) + Refuerzo | ¿Mensaje "Re-matrícula en el mismo curso" tiene sentido? (S20) | — | |
| C10 | D5 retirado + Clase B | Hoy bloquea con "matrícula en curso" (S20) — **decisión** | ✓ | |
| C11 | D5 cancelado + Clase B | Pide confirmación de re-matrícula | ✓ | |
| C12 | D6 funcionario **(§4)** | Modal "Personal de la autoescuela"; crea perfil alumno; revisar que su sede y su rol de staff no cambien (S13) y su acceso siga igual | — | |
| C13 | Email de D8 con RUT nuevo | Banner "Este correo ya está registrado por otra persona"; botón no queda pegado | ✓ | |
| C14 | Email de D8 con mayúsculas | Igual que C13 | ✓ | |
| C15 | Email con `_` (ej. `juan_perez@…`) cuando existe `juanXperez@…` | No debe marcarlo como duplicado (el chequeo usa `ilike`) | — | |
| C16 | D15 (archivado) + curso nuevo | ¿Avisa que está archivado? Hoy lo reactiva en silencio — **decisión** | — | |
| C17 | Secretaria de A matricula a D4 (activo en B) **(§4)** | Debe bloquear el duplicado (S12) | — | |

### D. Paso 1 — Curso, edad y requisitos por curso

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | Categorías visibles | "No Profesional" y "Profesional"; "Singular" oculto; una categoría sin cursos en la sede no aparece | ✓ | |
| D02 | Elegir categoría | Lista solo sus cursos; mientras cargan, spinner | ✓ | |
| D03 | Cambiar de categoría con un curso ya elegido | Botón se deshabilita hasta elegir curso de la nueva categoría | ✓ | |
| D04 | Cursos de la sede | Solo los de la sede activa (no los de la otra sede) | ✓ | |
| D05 | "Refuerzo Clase B" aparece con su nombre y precio (spec 0006-m AC1/AC6) | Precio = mitad de Clase B de esa sede | ✓ | |
| D06 | "Clase B SENCE" | Aparece campo "Código SENCE" obligatorio; sin él no avanza | ✓ | |
| D07 | SENCE con código → completar matrícula **(§4)** | El código queda guardado en la matrícula (S14: probablemente no) | — | |
| D08 | Edad 16 años 364 días (D7) | "Menor de 17 años — No se puede matricular"; botón deshabilitado | ✓ | |
| D09 | Cumple 17 **mañana** (D7) | Debe seguir bloqueado hoy (S22) | ✓ | |
| D10 | 17 años + Clase B | Aviso "Requiere Autorización Notarial"; permite avanzar | ✓ | |
| D11 | 19 años + Profesional | "Menor de 20 años — No puede matricularse en Clase Profesional" | ✓ | |
| D12 | Cumple 20 hoy / cumple 20 mañana + Profesional | Hoy: permitido. Mañana: bloqueado (S22) | ✓ | |
| D13 | Profesional sin licencia previa o sin fecha | Botón deshabilitado | ✓ | |
| D14 | A2 con licencia B de hace 1 año (D16) | Aviso naranja no bloqueante "…2 años de licencia clase B…" | ✓ | |
| D15 | A5 con licencia A2 de hace 3 años | Sin aviso | ✓ | |
| D16 | A5 con licencia previa "Clase B" de hace 3 años | Hoy no avisa nada (solo mira la antigüedad, S24) — ¿debería? | — | |
| D17 | "Profesional A2 conv. A4" y "A5 conv. A3" | Se pueden elegir; queda marcado solo el elegido (no ambos A2) | ✓ | |
| D18 | Fecha de licencia en el futuro | ¿Aviso coherente o error? | — | |

### E. Paso 2 — Clase B: modalidad, instructor y horarios

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | Llegar al paso 2 (Clase B) | "1. Modalidad de Pago" sin nada elegido; instructores de la sede con vehículo y patente | ✓ | |
| E02 | Instructor sin vehículo activo (D9) | No aparece | ✓ | |
| E03 | Sede sin instructores con vehículo | "No hay instructores disponibles" | — | |
| E04 | Elegir instructor sin modalidad | La grilla no aparece hasta elegir modalidad | ✓ | |
| E05 | Total o Parcial → grilla | "Elige las 12 clases prácticas", hasta 2 por día | ✓ | |
| E06 | Refuerzo Clase B **(§4)** | Sin selector de modalidad (forzada a Total); pide **6** clases (spec 0006-m AC5) | ✓ | |
| E07 | Seleccionar 12 clases | Contador llega a 12; "Continuar a Documentos" se habilita; no deja una 13ª | ✓ | |
| E08 | 3ª clase el mismo día | No la deja seleccionar | ✓ | |
| E09 | Deseleccionar una clase | Se libera y baja el contador | ✓ | |
| E10 | Slots ocupados | Se ven ocupados y no se pueden elegir | ✓ | |
| E11 | Horarios de **hoy** anteriores a la hora actual **(§4)** | No deben ofrecerse (S3) | ✓ | |
| E12 | Instructor sin disponibilidad | "Sin disponibilidad" | — | |
| E13 | Menos de 12 slots posibles en el horizonte | Aviso de disponibilidad insuficiente; no se puede avanzar | — | |
| E14 | Cambiar de instructor con clases elegidas | Se limpia la selección y carga la grilla nueva | ✓ | |
| E15 | Límite de semanas | La grilla no pasa del máximo configurado en Agenda | — | |
| E16 | Instructor con `both_branches` (D9) en sede A | ¿Muestra horarios de la otra sede? Solo deben ser los de A | — | |
| E17 | Aviso de documento de vehículo vencido | Se ve en los slots de ese vehículo; ¿bloquea o solo avisa? | — | |
| E18 | Guardar → volver al paso 2 → cambiar 2 clases → guardar | Quedan exactamente las 12 nuevas en BD (sin duplicados) | — | |
| E19 | Doble clic en "Continuar a Documentos" | 12 sesiones, no 24 ni error | ✓ | |
| E20 | Horario tomado por otro borrador ya expirado (D13) **(§4)** | Grilla y guardado coherentes (S16) | — | |

### F. Paso 2 — Profesional: promociones

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | A2 con promociones abiertas | Agrupadas por promoción, con código y "inscritos / cupo" | ✓ | |
| F02 | Sin promociones abiertas para esa clase | "Sin promociones abiertas"; no avanza | ✓ | |
| F03 | Promoción de la otra sede (D11) | No aparece | ✓ | |
| F04 | Promoción `finished` | No aparece o aparece deshabilitada | — | |
| F05 | Promoción **llena** (D11) | No debería poder elegirse (S17) | ✓ | |
| F06 | Promoción iniciada hace > 3 días | Modal "Matrícula tardía… hace N días"; Cancelar no guarda; Confirmar guarda | ✓ | |
| F07 | Promoción iniciada hace exactamente 3 días | Sin modal | — | |
| F08 | Aviso de antigüedad contra la fecha de inicio de la promoción | Se recalcula al elegir la promoción; no bloquea | ✓ | |
| F09 | Conv. A4 / Conv. A3 | Banner "Matrícula con Convalidación Simultánea"; resumen "+ conv. A4" | ✓ | |
| F10 | Contador de inscritos | Cuenta matrículas no canceladas ni borrador; sube en 1 tras confirmar | — | |

### G. Paso 3 — Documentos

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| G01 | Clase B: subir foto JPG | Skeleton "Subiendo foto…" → miniatura; "Continuar" habilitado | ✓ | |
| G02 | Clic en la miniatura | Vista ampliada; se cierra con X o clic afuera | — | |
| G03 | Arrastrar y soltar la foto | Funciona igual | — | |
| G04 | "Cambiar foto" | Reemplaza la foto (mismo archivo en Storage) | — | |
| G05 | "Quitar foto" | Desaparece; "Continuar" se deshabilita | ✓ | |
| G06 | Foto > 1200 px / HEIC / WEBP | Se normaliza y sube (HEIC puede fallar en algunos navegadores) | — | |
| G07 | `.txt` renombrado a `.jpg` | Toast "El archivo no es una imagen…"; el spinner se apaga | ✓ | |
| G08 | Falla la subida a Storage (red cortada al subir) | Mensaje de error visible (S10) | — | |
| G09 | Pestaña "Tomar foto" → "Activar Cámara" | Hoy no hace nada (S18) | — | |
| G10 | Re-matrícula (D2) **(§4)** | Muestra la foto anterior con "Usar esta foto"; no avanza hasta confirmarla o subir otra | ✓ | |
| G11 | 17 años Clase B **(§4)** | Debe exigir la Autorización Notarial (S11) | ✓ | |
| G12 | Profesional | Pide HVC (obligatoria), Cédula y Licencia (opcionales) | ✓ | |
| G13 | Profesional sin HVC | "Continuar" deshabilitado; el texto dice "Sube la foto carnet para continuar" aunque falta la HVC — ¿se entiende? | — | |
| G14 | HVC | ¿Se pide la fecha de emisión y avisa si tiene > 30 días? (S18: no) | — | |
| G15 | Documento > 10 MB o formato no permitido | Error visible (S10) | — | |
| G16 | Botón de cada documento mientras sube | "Subiendo…" y deshabilitado; luego "LISTO" | — | |
| G17 | Continuar → en BD `docs_complete = true` | Documentos quedan en el DMS de **esa** matrícula | — | |

### H. Paso 4 — Pago y descuentos

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| H01 | Pago total Clase B | Valor base = precio del curso; Total Final = precio | ✓ | |
| H02 | Pago parcial Clase B | Total Final = 50%. ¿Queda claro que es un abono y cuánto queda pendiente? (no hay línea explicativa) | ✓ | |
| H03 | Refuerzo | Total = precio del refuerzo, nunca 50% | ✓ | |
| H04 | Curso sin precio (D10) | Hoy "Registrar Pago" queda deshabilitado sin explicación — anotar | — | |
| H05 | Sin método elegido | "Registrar Pago" deshabilitado | ✓ | |
| H06 | Descuentos disponibles | Solo vigentes, de la sede (o sin sede) y del curso/tipo; no los vencidos ni de la otra sede (D12) | ✓ | |
| H07 | Descuento % en pago total | Monto = % del precio; total baja | ✓ | |
| H08 | Descuento % en pago parcial | Hoy = % del 50% (S24) — **decisión** | ✓ | |
| H09 | Descuento fijo mayor al monto a pagar | Total no negativo; revisar saldo pendiente resultante | — | |
| H10 | Quitar descuento | Total vuelve al original | ✓ | |
| H11 | Descuento manual válido con motivo | Se aplica; se ve "Descuento aplicado" con el motivo | ✓ | |
| H12 | Manual sin motivo / en 0 / negativo | Botón deshabilitado o sin efecto; ¿mensaje? | ✓ | |
| H13 | Manual mayor al monto a pagar | "El descuento no puede superar el monto a pagar ($…)" | ✓ | |
| H14 | Manual con decimales (`1000.5`) | ¿Lo acepta? En CLP no debería (S24) | — | |
| H15 | Motivo del descuento manual en BD/auditoría | Debe quedar guardado (S24: probablemente no) | — | |
| H16 | Método "Pendiente" | Sin N° de documento; matrícula queda con pago pendiente y saldo = precio − descuento | ✓ | |
| H17 | N° de documento | Se guarda en el pago | ✓ | |
| H18 | Registrar pago → Volver → cambiar método → Registrar **(§4)** | Queda **un** pago con el nuevo método; ¿llegan 2 notificaciones "Pago registrado" al alumno? | — | |
| H19 | Falla la red al registrar el pago | Mensaje visible y el botón vuelve a la normalidad (S10) | — | |
| H20 | Pago después de las 21:00 **(§4)** | `payment_date` con la fecha de Chile (S9) | — | |
| H21 | Doble clic en "Registrar Pago" | Un solo pago | ✓ | |

### I. Paso 5 — Contrato y consentimientos

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| I01 | "Generar PDF" | "Generando…" → "PDF generado", vista previa embebida y "Descargar PDF" | ✓ | |
| I02 | Contenido del PDF Clase B **(§4)** | Datos del alumno, curso, precio, descuento, total pagado, saldo, modalidad, foto, sede y N° coinciden con lo ingresado | — | |
| I03 | Contrato Profesional | Usa la plantilla profesional de la sede (spec 0016-m) | — | |
| I04 | Plantilla editada en Configuración | El PDF refleja el texto actual de la sede | — | |
| I05 | N° de matrícula en el PDF vs número final (S23) | Iguales | — | |
| I06 | Falla la generación | Mensaje de error en el recuadro y banner; se puede reintentar | — | |
| I07 | Zona de subida | Solo aparece después de generar el PDF | ✓ | |
| I08 | Subir PDF / JPG / PNG firmado | "Archivo seleccionado" con nombre; se puede quitar | ✓ | |
| I09 | Subir `.docx` o > máximo | Mensaje de formato/tamaño; no avanza | ✓ | |
| I10 | Casilla de privacidad | Desmarcada por defecto; sin ella "Confirmar Matrícula" deshabilitado (spec 0009-m AC3) | ✓ | |
| I11 | Texto y enlace de privacidad | Nombra a la sociedad de **la sede de la matrícula**; el enlace abre `/politica-privacidad/<slug>` correcto | ✓ | |
| I12 | Alumno menor | Texto "El apoderado declara…" y nota de la autorización notarial | — | |
| I13 | Casilla promocional | Desmarcada por defecto; no bloquea | ✓ | |
| I14 | Consentimiento promocional "pegado" **(§4)** | Se registra lo que se ve marcado (S5) | — | |
| I15 | Confirmar → tabla `consents` **(§4)** | Un registro por consentimiento, `source = secretaria`, sede correcta, IP, versión, `granted_by_representative` si es menor (spec 0009-m AC5/AC7) | — | |
| I16 | Doble clic en "Confirmar Matrícula" | Un solo número, un solo juego de consentimientos y notificaciones | ✓ | |
| I17 | Falla del consentimiento **(§4)** | No debe quedar una matrícula activa "a medias" (S2) | — | |
| I18 | Volver al paso 4 desde el 5 | Muestra el pago ya registrado (método y descuento) | — | |

### J. Paso 6 — Confirmación y cuenta del alumno

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| J01 | Pantalla final | "¡Matrícula Exitosa!", N° de matrícula, fecha, alumno, curso | ✓ | |
| J02 | N° correlativo | Siguiente número de la sede y del tipo (B / Profesional por separado) | ✓ | |
| J03 | "Comprobante de Pago" | Hoy no hace nada (S18) | — | |
| J04 | "Contrato Firmado" | Abre el archivo firmado que se subió (no el PDF sin firmar) | ✓ | |
| J05 | Textos de "Próximos pasos" | "Se ha enviado una copia del contrato al email" — verificar si llega (S18) | — | |
| J06 | Aviso "Documentos Pendientes" | Solo si quedó algún documento pendiente | — | |
| J07 | Correo "Activa tu cuenta" | Llega al email del alumno con la marca de la sede | — | |
| J08 | Portal alumno bloqueado en el piloto | El alumno que activa su cuenta ve "módulo no disponible" — **decisión** (§5) | — | |
| J09 | Email con formato que Auth rechaza | Toast "La matrícula se confirmó, pero no se pudo crear la cuenta…" (fix-157-m) | — | |
| J10 | 2ª matrícula de un alumno que ya activó su cuenta | Hoy muestra el toast de error aunque no hay error (S19) | — | |
| J11 | Notificaciones | Alumno: "Matrícula confirmada"; admins: "Nueva matrícula confirmada — nombre (curso)" | — | |
| J12 | "Volver al Inicio" | Va al Dashboard del rol; desde el drawer cierra el drawer (¿y sale de Base de Alumnos?) | ✓ | |

### K. Borradores

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | Retomar borrador del paso 1 | Paso 1 con los datos guardados | ✓ | |
| K02 | Retomar del paso 2 (Clase B) **(§4)** | Instructor y 12 clases seleccionadas; se pueden cambiar (S15) | ✓ | |
| K03 | Retomar del paso 3 | Foto y documentos ya subidos visibles | ✓ | |
| K04 | Retomar del paso 4 | Precio, modalidad, descuento y método restaurados | ✓ | |
| K05 | Retomar del paso 5 | Hay que generar el PDF de nuevo; casillas desmarcadas | — | |
| K06 | Retomar Profesional con convalidación | Promoción elegida y banner de convalidación | — | |
| K07 | Retomar un borrador SENCE | ¿Conserva el código SENCE? (se reconstruye como `null`) | — | |
| K08 | Descartar → Cancelar | No borra nada | ✓ | |
| K09 | Descartar → Confirmar | Desaparece; si era el último, arranca wizard limpio; sus horarios se liberan en la Agenda | ✓ | |
| K10 | Descartar un borrador de alumno **nuevo** | Se borran también el alumno y su usuario (no queda "fantasma" en Base de Alumnos) | — | |
| K11 | Descartar un borrador de alumno **existente** (D2) | Se borra solo el borrador; el alumno y su historial quedan intactos | — | |
| K12 | Descartar un borrador **con pago ya registrado** **(§4)** | ¿Qué pasa con ese dinero? (S8) | — | |
| K13 | Borrador expira (14 h) **(§4)** | Desaparece de la lista; sus horarios se liberan; tras el cron se borra todo (incluido el pago, S8) | — | |
| K14 | "Nueva matrícula" desde la lista de borradores | Wizard limpio; los borradores siguen | ✓ | |
| K15 | Mismo RUT + mismo curso que un borrador vivo, desde "Nueva matrícula" | Reutiliza ese borrador (no crea otro) | — | |
| K16 | Volver al paso 1 y cambiar el curso **(§4)** | No debe quedar un borrador huérfano con horarios tomados (S6) | — | |
| K17 | Volver al paso 1 y corregir el RUT **(§4)** | El RUT corregido se guarda (S7) | — | |
| K18 | Borradores de la otra sede | No aparecen (admin con sede A, secretaria A) | ✓ | |
| K19 | Acción "Reiniciar" del drawer | Wizard limpio sin preguntar; el borrador queda en la lista — ¿es lo esperado? | — | |

### L. Navegación, abandono y errores

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| L01 | Ruta: con borrador, clic en otro ítem del menú **(§4)** | Modal "¿Deseas salir?"; "Quedarse" no navega; "Sí, salir" navega y el borrador queda | ✓ | |
| L02 | Ruta: sin borrador (paso 1 sin guardar) | Navega sin preguntar | ✓ | |
| L03 | Ruta: después de confirmar (paso 6) | Navega sin preguntar | ✓ | |
| L04 | Drawer: cerrar con X o clic afuera en el paso 3 **(§4)** | ¿Avisa? (el guard es de ruta). Reabrir ofrece retomar el borrador | — | |
| L05 | Botón "Atrás" del navegador en medio del wizard | Mismo comportamiento que L01 | — | |
| L06 | Cerrar la pestaña en medio del wizard | ¿Aviso del navegador? El borrador queda | — | |
| L07 | "Volver" en cada paso | Retrocede un paso sin perder lo guardado | ✓ | |
| L08 | Red cortada al guardar el paso 1 | Error visible; botón vuelve a la normalidad; sin alumno a medias | — | |
| L09 | Red cortada al guardar el paso 2 | Error visible; ¿se perdieron las reservas anteriores? | — | |
| L10 | Red cortada al generar contrato / al confirmar | Error visible; se puede reintentar sin duplicar | — | |
| L11 | Sesión expirada a mitad del wizard | Mensaje claro o redirección al login; el borrador queda | — | |
| L12 | Tras salir del wizard, revisar DevTools → WS | No debe quedar abierto el canal `schedule-instructor-N` | — | |

### M. Sedes y roles

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| M01 | Admin en sede A completa una matrícula | Matrícula, alumno, pago y consentimiento con sede A; N° de la secuencia de A | ✓ | |
| M02 | Admin cambia de sede en el topbar en el paso 3 **(§4)** | Comportamiento coherente (S21) | — | |
| M03 | Admin desde el drawer de Base de Alumnos con "Todas" | Pide sede; la lista de fondo pasa a esa sede | — | |
| M04 | Secretaria A | Solo cursos, instructores, promociones, descuentos y borradores de A | ✓ | |
| M05 | Secretaria con grant multi-sede | ¿Puede matricular en la otra sede? Hoy siempre usa su sede propia — **decisión** | — | |
| M06 | Secretaria sin sede asignada | Error claro; nunca crea la matrícula en la sede 1 por defecto | — | |
| M07 | Admin matricula en B a un alumno de A (D3 con otro curso) | ¿Cambia la sede del alumno? (S13) | — | |
| M08 | Secretaria B intenta la misma operación | ¿Se actualizan sus datos o no? (S12) | — | |

### N. Concurrencia y tiempo real (2 sesiones)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| N01 | A y B en el paso 2 con el mismo instructor; A guarda sus 12 **(§4)** | En B esos horarios pasan a ocupados sin recargar; si B los tenía elegidos, se deseleccionan (¿con aviso?) | ✓ | |
| N02 | A y B eligen el mismo slot y guardan casi a la vez | Uno guarda; el otro recibe "El instructor ya tiene una clase…" y puede reelegir | — | |
| N03 | A y B confirman matrículas de la misma sede a la vez | Números distintos y correlativos; ninguno falla por número duplicado | — | |
| N04 | A deja un borrador en el paso 2 y no vuelve | Esos horarios siguen ocupados para B hasta que expire | — | |
| N05 | Dos operadores retoman el mismo borrador | Comportamiento coherente (sin duplicar pagos ni sesiones) | — | |

### O. Verificación cruzada después de matricular

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| O01 | Base de Alumnos | Aparece primero, estado y curso correctos, Nº de expediente (ver 024a) | ✓ | |
| O02 | Ficha del alumno | 12 (o 6) clases, instructor, saldo, documentos, contrato firmado | ✓ | |
| O03 | Agenda **(§4)** | Las 12 clases como ocupadas en el instructor/vehículo, en la hora correcta (Chile) | ✓ | |
| O04 | Dashboard / Asistencia B | Las clases se ven (estado `scheduled`, no `reserved`) | — | |
| O05 | Pagos | El pago con monto, método, N° de documento y fecha correctos | ✓ | |
| O06 | Cuadratura del día **(§4)** | El pago en efectivo suma en la caja del día | ✓ | |
| O07 | Saldo del alumno con pago parcial / pendiente | Saldo = precio − descuento − pagado | ✓ | |
| O08 | Documentos (DMS) | Foto y documentos en la matrícula correcta; en re-matrícula, separados por matrícula | — | |
| O09 | Profesional | Aparece en Alumnos Profesional y en la promoción; Libro de clases (convalidación) | — | |
| O10 | Borrador sin confirmar | **No** aparece en Base, Agenda de instructor, Dashboard ni Asistencia (DG-050) | — | |
| O11 | Pagos/Cuadratura mientras el borrador está en paso 5 (pago ya registrado) | ¿Se ve el pago de una matrícula que aún no existe? — **decisión** | — | |

### P. Seguridad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| P01 | `generate-contract-pdf` sin sesión **(§4)** | 401; nunca un PDF (S1) | ✓ | |
| P02 | `generate-contract-pdf` con sesión de secretaria A para una matrícula de B | 403 (S1) | ✓ | |
| P03 | `activate-student-account` como secretaria A para un alumno de B | Debería rechazarse (hoy solo valida el rol) | — | |
| P04 | RLS: secretaria A lee borradores/matrículas de B desde la consola | 0 filas | ✓ | |
| P05 | Descartar borrador como secretaria | Solo puede descartar los de su sede | — | |

### Q. Visual y accesibilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| Q01 | Modo oscuro y claro en los 6 pasos | Todo legible (grilla, tarjetas de modalidad, banners, datepicker) | ✓ | |
| Q02 | Drawer en 375 / 768 / 1440 px | Sin scroll horizontal; botones inferiores visibles | ✓ | |
| Q03 | Ruta en desktop | Ocupa el alto de pantalla; el contenido scrollea por dentro | — | |
| Q04 | Solo teclado | Se puede completar el paso 1 y elegir curso con Tab/Enter; el foco se ve | — | |
| Q05 | Badge "Paso N de 6" del drawer | Coincide con el paso real | ✓ | |
| Q06 | Skeleton de carga | Misma forma que el paso 1, sin saltos | — | |

---

## 4. Casos con pasos numerados

### A10 — Re-matricular desde Ex-Alumnos

**Precondición:** D2 en Ex-Alumnos B; sesión admin con "Todas las sedes".
1. Ex-Alumnos B → buscar D2 → "Re-matricular" → "Continuar".
2. Verificar que el topbar cambió a la sede de D2 y que se abrió el drawer.
3. Verificar que el paso 1 tiene RUT, nombres, email, teléfono, nacimiento, sexo y dirección de D2.
4. Verificar que el curso está sin elegir.
5. Cerrar el drawer y abrir "Nueva Matrícula" desde Base de Alumnos.

**Esperado:** en el paso 5 el wizard está limpio (sin precargar a D2 otra vez). **Evidencia:** URL
con/sin `?rut=` y captura del paso 1.

### B05 — RUT tecleado sin DV

**Precondición:** conocer un RUT real de prueba, por ejemplo `12.345.678-5`.
1. En el paso 1 tipear `12345678` (sin DV) y presionar Tab.
2. Anotar qué RUT queda en el campo y si dice "RUT válido".
3. Si aparece "Datos precargados", anotar de quién son los datos.
4. Repetir tipeando `12.345.679-5` (un dígito del cuerpo mal) y Tab.

**Esperado:** en el paso 2 el RUT termina en `…678-5`, o el sistema avisa que falta el DV. Si queda
`1.234.567-4` como "válido", S4 confirmada. En el paso 4, el sistema no debería aceptar
silenciosamente un RUT distinto al tipeado.

### C04 — Re-matrícula en el mismo curso

**Precondición:** D2 (Clase B `completed`).
1. Paso 1 → RUT de D2 → verificar precarga.
2. Cambiar el teléfono → elegir Clase B → "Guardar y Continuar".
3. Verificar el modal "Re-matrícula en el mismo curso" con nombre, email y la lista de campos que
   se actualizarán.
4. Confirmar → completar la matrícula hasta el final.
5. Abrir la ficha de D2.

**Esperado:** dos matrículas Clase B separadas (la antigua como historial, la nueva activa), el
teléfono nuevo guardado, documentos de cada matrícula por separado.

### C12 — Matricular a un funcionario

**Precondición:** D6 (secretaria de la sede A, con cuenta activa). Anotar su sede y rol.
1. Con sesión admin en la sede B, paso 1 → RUT de D6.
2. Verificar el modal "Personal de la autoescuela" → confirmar → completar la matrícula.
3. Revisar en BD o en Secretarias: `users.branch_id` y rol de D6.
4. Cerrar sesión e iniciar como D6.

**Esperado:** D6 sigue siendo secretaria de la sede A y entra normalmente a su panel. Si su sede
cambió a B (S13) o no puede entrar, reportar. Anotar si apareció el toast "no se pudo crear la
cuenta del alumno" (S19).

### C17 — Duplicado entre sedes

**Precondición:** D4 con Clase B `active` en la sede B; sesión de secretaria de la sede A.
1. Paso 1 → RUT de D4 → Clase B → "Guardar y Continuar".
2. Anotar qué modal aparece.

**Esperado:** "Matrícula duplicada" (no se puede). Si aparece "RUT ya registrado… nuevo curso" y deja
avanzar, S12 confirmada → no completar la matrícula y reportar.

### D07 — Código SENCE persistido

**Precondición:** curso Clase B SENCE en la sede.
1. Matricular D1 en Clase B SENCE con el código `12-3456-78`; completar la matrícula.
2. En BD: `SELECT sence_code_id FROM enrollments WHERE id = <id>`; revisar también la ficha y el
   contrato.

**Esperado:** el código queda asociado a la matrícula. Si `sence_code_id` es `null` y el código no
aparece en ningún lado, S14 confirmada.

### E06 — Refuerzo Clase B

1. Paso 1 → D1 → "Refuerzo Clase B" → avanzar.
2. Verificar que no hay "Modalidad de Pago" y que pide 6 clases.
3. Elegir 6 clases → avanzar hasta Pago.
4. Verificar que el total es el precio completo del refuerzo (no 50%).
5. Completar la matrícula y revisar la ficha: progreso "0/6".

**Esperado:** como arriba (spec 0006-m AC1, AC2, AC5).

### E11 — Horarios ya pasados

**Precondición:** hacerlo a media tarde, con un instructor que tenga bloques en la mañana de hoy.
1. Paso 2 → instructor → modalidad.
2. Mirar la columna de hoy.

**Esperado:** los horarios de hoy anteriores a la hora actual no se ofrecen (o se ven deshabilitados).
Si se pueden elegir, S3 confirmada: **no guardar** la matrícula de prueba con clases en el pasado.

### E20 — Horario de un borrador expirado

**Precondición:** borrador D13 con `expires_at` ya pasado y aún no limpiado por el cron (antes de
las 00:00 Chile), con horarios reservados del instructor X.
1. Matricular D1 con el instructor X.
2. Verificar si esos horarios aparecen libres.
3. Elegir uno de ellos + 11 más → "Continuar a Documentos".

**Esperado:** o aparecen ocupados, o se guardan sin error. Si aparecen libres y el guardado falla con
"El instructor ya tiene una clase agendada…", S16 confirmada; anotar además si las reservas
anteriores del borrador se perdieron.

### G10 — Foto de la matrícula anterior

**Precondición:** D2 con foto en su matrícula anterior.
1. Re-matricular a D2 hasta el paso 3.
2. Verificar el aviso "Foto de una matrícula anterior" y que "Continuar" está deshabilitado.
3. "Usar esta foto" → verificar que se habilita.
4. Completar y revisar el DMS: la foto está en la matrícula nueva y sigue en la anterior.

**Esperado:** como arriba. Repetir subiendo una foto nueva en vez del paso 3: la anterior no cambia.

### G11 — Menor de 17 años en Clase B

**Precondición:** D7 con 17 años.
1. Paso 1 → Clase B → verificar el aviso "Requiere Autorización Notarial".
2. Llegar al paso 3.
3. Buscar dónde subir la Autorización Notarial.
4. Subir solo la foto y avanzar.

**Esperado:** el paso 3 pide la Autorización Notarial como obligatoria. Si solo pide la foto y deja
avanzar, S11 confirmada (afecta el consentimiento de menores, spec 0009-m AC7).

### H18 — Pagar dos veces con "Volver"

1. Paso 4 → Efectivo → "Registrar Pago".
2. En el paso 5, "Volver".
3. Cambiar a Transferencia → "Registrar Pago".
4. En BD/Pagos: contar los pagos de esa matrícula; revisar las notificaciones del alumno.

**Esperado:** un solo pago, por transferencia. Anotar cuántas notificaciones "Pago registrado"
recibió el alumno.

### H20 — Pago de noche

**Precondición:** ejecutar después de las 21:00 (hora Chile), o cambiar la hora del equipo.
1. Completar una matrícula con pago en efectivo.
2. Revisar `payments.payment_date` y la Cuadratura del día.

**Esperado:** fecha de hoy (Chile) y el pago cuadra hoy. Si queda con la fecha de mañana, S9 confirmada.

### I02 — Contenido del contrato

**Precondición:** D1 Clase B, pago parcial con descuento de monto fijo.
1. Llegar al paso 5 → "Generar PDF" → "Descargar PDF".
2. Revisar: nombre completo, RUT, nacimiento, dirección, email, teléfono, curso, horas, precio base,
   descuento, total pagado, saldo, modalidad, foto, datos de la sede, N° de matrícula.
3. Comparar el N° con el que aparece al confirmar.

**Esperado:** todo coincide con lo ingresado y con el paso 4. Anotar cualquier campo vacío o "—".

### I14 — Consentimiento promocional "pegado"

1. Matrícula 1: en el paso 5 marcar **ambas** casillas → confirmar → "Volver al Inicio".
2. Matrícula 2 (otro alumno): en el paso 5 marcar **solo** privacidad; dejar la promocional
   desmarcada → confirmar.
3. En BD: `SELECT consent_type, granted FROM consents WHERE enrollment_id = <matrícula 2>`.
4. Variante: en una matrícula 3 marcar la promocional, pulsar "Volver", "Continuar", dejarla
   desmarcada y confirmar.

**Esperado:** la promocional de las matrículas 2 y 3 figura como **no** otorgada. Si figura otorgada,
S5 confirmada → reportar como P1 (consentimiento sin acción del titular).

### I15 — Registro de consentimientos

1. Completar una matrícula de un adulto y otra de un menor de 17.
2. En BD revisar `consents` de ambas.

**Esperado:** registros de privacidad y comunicaciones con `source = 'secretaria'`, `branch_id` de
la sede de la matrícula, `ip` no nula, versión de política, `enrollment_id`; en el menor
`granted_by_representative = true`. Desde la ficha (admin) se pueden consultar y no editar.

### I17 — Falla al registrar el consentimiento

**Precondición:** entorno local o de pruebas. Simular la falla bloqueando en DevTools → Network la
petición `POST …/consents` ("Block request URL").
1. Completar hasta el paso 5 → subir contrato → marcar privacidad → "Confirmar Matrícula".
2. Anotar el mensaje.
3. En BD revisar `enrollments.status`, `number` y `class_b_sessions.status` de esa matrícula.
4. Desbloquear la URL → "Confirmar Matrícula" de nuevo → revisar `number` otra vez.

**Esperado:** si dice "La matrícula no se confirmó", la matrícula sigue en `draft`. Si está `active`
con clases `reserved`, o el número cambia en el paso 4, S2 confirmada.

### K02 — Retomar en el paso 2

**Precondición:** borrador Clase B en el paso 3 o posterior (horarios ya guardados).
1. Retomar el borrador → "Volver" hasta el paso 2.
2. Verificar que se ven el instructor y las 12 clases elegidas.
3. Intentar deseleccionar una clase y elegir otra.

**Esperado:** se puede cambiar la clase. Si las 12 aparecen como "ocupadas" y no se pueden
deseleccionar, S15 confirmada.

### K12 — Descartar un borrador que ya tiene pago

1. Matricular D1 hasta el paso 5 con pago en **efectivo** (Registrar Pago). Anotar el monto.
2. Verificar el pago en Pagos y en la Cuadratura del día.
3. Salir, volver a Matrícula → lista de borradores → "Descartar" ese borrador → confirmar.
4. Revisar Pagos y Cuadratura.

**Esperado:** definido por negocio (§5). Hoy probablemente el pago desaparece y la caja queda
descuadrada por ese monto (S8).

### K13 — Expiración del borrador

**Precondición:** entorno de pruebas; borrador en paso 5 con pago registrado y 12 clases reservadas.
1. En BD, poner `expires_at` 1 minuto en el pasado.
2. Volver a Matrícula: verificar que el borrador ya no aparece.
3. En Agenda, verificar que sus horarios ya aparecen libres.
4. Ejecutar `SELECT cleanup_expired_drafts();` (solo en local/pruebas).
5. Revisar que se borraron matrícula, sesiones, documentos, contrato y **pago**, y si el alumno nuevo
   se borró.

**Esperado:** anotar exactamente qué se borra; el pago borrado es S8.

### K16 — Cambiar el curso después del paso 2

1. D1 → Clase B → elegir 12 clases → avanzar al paso 3.
2. "Volver" hasta el paso 1 → cambiar a Refuerzo Clase B → "Guardar y Continuar".
3. Salir y volver a Matrícula: mirar la lista de borradores.
4. En Agenda, mirar los 12 horarios del paso 1.

**Esperado:** un solo borrador (Refuerzo) y los 12 horarios liberados. Si hay 2 borradores del mismo
alumno o los horarios siguen tomados, S6 confirmada.

### K17 — Corregir el RUT después de guardar

1. D1 → paso 1 → avanzar al paso 2.
2. "Volver" → cambiar un dígito del RUT (queda válido) → "Guardar y Continuar".
3. Completar la matrícula.
4. Buscar al alumno por el RUT nuevo y por el viejo en Base de Alumnos.

**Esperado:** el alumno tiene el RUT nuevo. Si tiene el viejo (y la confirmación mostró el nuevo), S7
confirmada.

### L01 — Salir del wizard con borrador (ruta)

**Precondición:** sesión de secretaria de la sede A, en `/app/secretaria/matricula`.
1. Completar el paso 1 de D1 → llegar al paso 2.
2. Clic en "Agenda" del menú lateral.
3. Verificar el modal "¿Deseas salir?" → "Quedarse" → seguir en el paso 2.
4. Repetir el clic → "Sí, salir" → llega a Agenda.
5. Volver a Matrícula.

**Esperado:** en el paso 5 aparece la lista de borradores con D1 en "Paso 2/6 — Asignación".

### L04 — Cerrar el drawer a mitad

1. Base de Alumnos → "Nueva Matrícula" → completar pasos 1 y 2 de D1 → llegar al paso 3.
2. Cerrar el drawer (X y, en otro intento, clic afuera).
3. Verificar que D1 **no** aparece en la lista de Base de Alumnos.
4. Abrir "Nueva Matrícula" otra vez.

**Esperado:** en el paso 2 idealmente un aviso (hoy no hay guard en el drawer); en el paso 4 la lista
de borradores con D1 para retomar.

### M02 — Admin cambia de sede a mitad

**Precondición:** admin con sede A.
1. D1 → Clase B → pasos 1 y 2 → llegar al paso 3.
2. En el topbar cambiar a la sede B.
3. Anotar qué pasa en la pantalla (paso actual, resumen del alumno, curso).
4. Continuar hasta el paso 4 y anotar precio y descuentos ofrecidos.

**Esperado:** el wizard avisa y reinicia o bloquea el cambio de sede. Si sigue en el paso 3 con datos
mezclados de las 2 sedes, S21 confirmada — no completar la matrícula.

### N01 — Dos operadores con el mismo instructor

**Precondición:** 2 navegadores (A y B) en el paso 2 con el mismo instructor.
1. En B elegir 3 horarios (sin guardar).
2. En A elegir esos mismos 3 horarios + 9 más → "Continuar a Documentos".
3. Sin tocar B, esperar 5 segundos.

**Esperado:** en B los 3 horarios pasan a ocupados y se deseleccionan solos; idealmente con un aviso.
Si B guarda igual, debe recibir un error claro (trigger anti doble-agendamiento).

### O03 / O06 — La matrícula aparece en Agenda y Cuadratura

1. Completar una matrícula Clase B con pago total en efectivo; anotar las 12 fechas/horas.
2. Agenda → instructor → recorrer las semanas: las 12 clases en su hora local exacta.
3. Cuadratura del día → el monto suma en efectivo.

**Esperado:** coincidencia exacta de horas (sin desfase de zona horaria) y de monto.

### P01 — Contrato sin sesión (S1)

**Precondición:** conocer el `enrollment_id` de una matrícula de prueba y la URL del proyecto.
1. En una ventana **sin sesión**, en Console:
   `fetch('<SUPABASE_URL>/functions/v1/generate-contract-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enrollment_id: <id> }) }).then(r => r.json()).then(console.log)`
2. Si responde `pdfUrl`, abrirla.
3. Repetir con la sesión de una secretaria de otra sede (copiar la petición desde Network con
   "Copy as fetch" y cambiar el `enrollment_id`).

**Esperado:** 401/403 y nunca un PDF. Si devuelve el contrato, S1 confirmada → **P0 inmediato**.
Anotar también si cambió `digital_contracts.file_url` de esa matrícula (quedaría apuntando al PDF
sin firmar).

---

## 5. Decisiones de negocio pendientes

No se pueden marcar ✅/❌ hasta que alguien defina la regla:

| Caso | Pregunta |
|---|---|
| B04 / B05 | ¿El DV se debe **agregar** (si falta) o **reemplazar** (si está mal)? Reemplazarlo anula la protección contra errores de tipeo. |
| B11 | ¿Sexo con solo M/F y preseleccionado en "Masculino"? |
| B13 | ¿La dirección debe ser obligatoria (aparece en el contrato)? |
| C02 | ¿La precarga por RUT puede sobrescribir lo que el operador ya tipeó? |
| C08 / C09 | ¿Un alumno con Clase B activa o egresado puede tomar Refuerzo? (spec 0006-m dice "cualquier alumno") |
| C10 | ¿Un alumno Retirado puede volver a matricularse en Clase B? |
| C16 | ¿Re-matricular a un alumno archivado lo saca de la Papelera? ¿Con aviso? |
| D16 | ¿Hay que validar el **tipo** de licencia previa (A5/A3 exigen A2 o A4), no solo la antigüedad? |
| F05 | ¿Se permite sobrecupo en promociones profesionales (con confirmación) o se bloquea? |
| G14 | ¿La HVC con más de 30 días bloquea, avisa o no importa? |
| H02 / H08 | En pago parcial, ¿el descuento % se aplica sobre el total del curso o sobre el abono? ¿Cómo se muestra el saldo? |
| H15 | ¿Hay que registrar quién aplicó un descuento manual y por qué? |
| H16 | ¿Se permite matricular con pago "Pendiente" (sin pagar nada)? ¿Quién? |
| J05 | ¿Se envía el contrato por email al alumno? (la pantalla lo afirma) |
| J08 | Con el portal alumno bloqueado en el piloto, ¿se debe enviar igual el correo "Activa tu cuenta"? |
| K12 / K13 / O11 | Un pago ya cobrado en un borrador que se descarta o expira: ¿se conserva, se anula con registro, o el pago debe registrarse recién al firmar? |
| K19 | ¿"Reiniciar" debe pedir confirmación o descartar el borrador? |
| L04 | ¿Cerrar el drawer a mitad debe avisar como el guard de ruta? |
| M05 | ¿La secretaria con grant multi-sede puede matricular en la otra sede? |
| M07 / M08 | Alumno de la sede A matriculado en la sede B: ¿cambia de sede, queda en ambas, o se prohíbe? |
| J12 / B17 | Al terminar o cancelar desde el drawer de Base de Alumnos, ¿volver al Dashboard o quedarse en la lista? |
