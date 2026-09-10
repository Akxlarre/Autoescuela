# Acceptance 0041-b — Comunicado global a alumnos (1:N, email + in-app)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-09-09
> **Verifier:** Claude (Opus 5) · pendiente de validación del owner

---

## Resumen

- AC totales: **12** (8 + 4 edge cases)
- AC cumplidos: **12**
- AC fallidos: **0**
- AC con evidencia empírica (no solo código): **9**

**Veredicto final:** ✅ **PASA**, con una salvedad explícita: **el envío SMTP real nunca se
ejercitó** (ver "Riesgo residual"). Todo lo verificado se hizo en `dryRun` o sin llegar a
confirmar el envío, a propósito.

Commits: `0bdbd884` (datos/RLS), `ebd09085` (núcleo funcional + Edge Function),
`bfca66f3` (Facade), `310b7ad6` (UI y conexión).

---

## Verificación por AC

### AC1 — La secretaria ve la lista de destinatarios resueltos y el conteo

- **Estado:** ✅ cumplido
- **Evidencia:**
  - QA en browser (2026-09-09), `secretaria@test.com` contra la BD de desarrollo real:
    con tipo "Operativo" y estado "Activas", el compositor resolvió **62 destinatarios**
    con nombre por fila.
  - Contraste independiente: la consulta SQL del segmento (sede 2 · Clase B · activas)
    devuelve 62 alumnos. El número de la UI no salió de un mock.
  - Tests: `announcements.facade.spec.ts` — `loadPreview()` resuelve nombre/email y
    deduplica al alumno con dos matrículas.

### AC2 — Sin declarar el tipo, el envío se bloquea

- **Estado:** ✅ cumplido
- **Evidencia:**
  - QA en browser: el compositor abre con el selector en "Elegí el tipo…", sin valor.
  - `announcement-recipients.utils.spec.ts` — `validateAnnouncementDraft()` con
    `kind: null` devuelve `valid: false` y el error `kind_requerido`.
  - El botón de envío se ata a `validation().valid`, verificado deshabilitado en browser.

### AC3 — El promocional solo alcanza a quien tiene consentimiento vigente

- **Estado:** ✅ cumplido — **el AC mejor verificado de la spec**, en tres capas
- **Evidencia:**
  - **Servidor (la que manda):** verificación en `dryRun` contra la Edge Function real —
    con 2 de 8 alumnos con consentimiento otorgado, el comunicado promocional resolvió
    exactamente 2 destinatarios, y eran los ids correctos (3079, 3080).
  - **Servidor, caso revocado:** un consentimiento con `revoked_at` no habilita.
  - **UI:** al cambiar de operativo a promocional el alcance cayó de **62 a 0**, con el
    texto "62 alumno(s) del segmento quedan fuera por no tener consentimiento promocional
    vigente" y un badge "Sin consentimiento" por fila.
  - **Unitario:** `announcements.facade.spec.ts` cubre otorgado, revocado y el caso de
    varios registros (manda el más reciente).

### AC4 — El operativo NO filtra por consentimiento

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `dryRun` contra la Edge Function: el mismo segmento de 8 alumnos —de los cuales 6 no
    tenían consentimiento promocional— resolvió los 8 como destinatarios.
  - UI: 62 destinatarios con el mismo segmento donde el promocional daba 0.
  - Fundamento en el código: `materializeRecipients()` solo llama al filtro de
    consentimiento cuando `kind === 'promocional'` (Art. 13 c).

### AC5 — Destildar destinatarios puntuales

- **Estado:** ✅ cumplido
- **Evidencia:**
  - QA en browser: 62 checkboxes operativos, uno por destinatario.
  - `toggleRecipient()` alimenta `excludedUserIds`, que viaja en `segment_filters` del
    comunicado y lo aplica el servidor (`materializeRecipients` filtra por `excluded`).
  - Test: la facade manda las exclusiones en el INSERT, no en el body del lote.

### AC6 — Email + notificación in-app por destinatario

- **Estado:** ✅ cumplido para la notificación in-app · ⚠️ el email no se ejercitó
- **Evidencia:**
  - `dryRun`: 8 destinatarios → **8 notificaciones** con `reference_type='announcement'`.
  - El HTML del correo se construye también en `dryRun`, así que el armado y el escapado
    se ejercitaron; lo único que no corrió es la entrega SMTP.
  - Ver "Riesgo residual".

### AC7 — Historial con detalle de lo enviado

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `announcements` + `announcement_recipients` creadas y pobladas por la EF durante la
    verificación (asunto, tipo, emisor, sede, fecha, contadores, y una fila por
    destinatario con su resultado).
  - UI: pestaña "Comunicados a alumnos" con `<app-announcements-content>`; estado vacío
    verificado en browser.
  - Facade con SWR y `createRequestGuard()`, 3 tests.

### AC8 — La secretaría no puede enviar fuera de su sede

- **Estado:** ✅ cumplido — verificado contra RLS real, no solo ocultando UI
- **Evidencia:**
  - `secretaria@test.com` intentando `INSERT` en `announcements` con `branch_id` de otra
    sede → **403**.
  - Mismo rol intentando `branch_id: null` (multi-sede) → **403**.
  - La Edge Function repite el chequeo, porque `service_role` no pasa por RLS.
  - UI: el selector de Sede solo se renderiza para admin (verificado en browser).

---

### Edge cases

### AC-E1 — Segmento vacío: no se envía

- **Estado:** ✅ cumplido
- **Evidencia:** `validateAnnouncementDraft()` devuelve `sin_destinatarios` con 0
  incluidos; en browser, con el promocional en 0 destinatarios el botón quedó
  deshabilitado. La EF además devuelve `done: true` sin procesar nada.

### AC-E2 — Alumno sin email: se reporta, y recibe la notificación in-app

- **Estado:** ✅ cumplido (con matiz de esquema)
- **Evidencia:**
  - La EF crea la notificación in-app **antes** de intentar el correo, y marca
    `send_error: 'sin_email'` sin abortar el lote.
  - `loadPreview()` normaliza un email en blanco a `null` y lo deja **incluido**; test
    explícito en la facade.
  - **Matiz:** `users.email` es `NOT NULL` en el esquema, así que en la práctica este caso
    se manifiesta como string vacío, no como `NULL`. El AC es más defensivo que lo que el
    esquema permite hoy — se dejó igual porque `NOT NULL` no garantiza no-vacío.

### AC-E3 — Fallo parcial: se registra y no aborta

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `announcements.facade.spec.ts` — un lote que falla no corta el envío: los siguientes
    se despachan igual y los fallidos se acumulan en `progress`.
  - La EF escribe `send_error` por destinatario y crea la notificación in-app aunque el
    correo falle.

### AC-E4 — Revocar entre el preview y el envío excluye de verdad

- **Estado:** ✅ cumplido — **verificado empíricamente, no por lectura de código**
- **Evidencia:**
  - Secuencia real contra la BD: se creó el comunicado promocional (equivalente a que la
    secretaria ya vio el preview con 2 destinatarios), **luego** el alumno 3080 revocó, y
    recién ahí se confirmó el envío → resolvió **1** destinatario, y fue el que no revocó.
  - Sostenido por dos mecanismos: la resolución ocurre en el servidor al enviar, y además
    se re-chequea el consentimiento por lote.

---

## Out-of-scope respetado

- ❌ **CRUD de plantillas** — confirmado: `notification_templates` sigue vacía y sin tocar.
- ❌ **Comunicados a instructores/secretarias** — confirmado: solo alumnos.
- ❌ **Bidireccionalidad** — confirmado: el alumno no puede responder.
- ❌ **WhatsApp** — confirmado: solo SMTP.
- ❌ **Programar envíos / recurrencia** — confirmado: no entró.
- ❌ **Adjuntos** — confirmado: no entró.
- ❌ **Avisos derivados automáticos** — confirmado: no se tocó ningún productor existente.
- ❌ **Segmentación por ciclo teórico** — confirmado: solo sede, tipo de curso y estado.
- ✅ `features/instructor/tareas/` no se modificó (verificado).

---

## Riesgo residual — leer antes de desplegar

**El envío SMTP real nunca se ejecutó.** Los 200 alumnos de la BD de desarrollo tienen
email `@test-data.local`, un TLD inexistente: una prueba de envío habría sido ~200 rebotes
duros contra el dominio de la escuela, que es exactamente el daño que este feature existe
para evitar (`indices/NOTIFICATIONS-MAP.md` §9.4).

**Antes de producción hace falta un smoke test** con una casilla real (uno o dos
destinatarios) que confirme dos cosas: que el correo efectivamente sale, y que el HTML se
ve bien en un cliente de correo de verdad. La función acepta `dryRun` para todo lo demás.

---

## Deuda técnica detectada

- **Detalle por destinatario en el historial.** El plan lo preveía; quedó fuera porque
  ningún AC lo pide. `announcement_recipients` ya guarda el dato, así que la vista de
  drill-down es puramente frontend cuando se quiera.
- **Sin tope de throttling entre lotes.** El espaciado hoy es implícito (la latencia de
  cada llamada). Si el volumen real resulta alto, conviene una pausa explícita.
- **`ANNOUNCEMENT_MAX_RECIPIENTS = 500` es un número elegido, no medido.** Sale del límite
  de tiempo de la Edge Function y del riesgo de reputación, no de una prueba de carga.

---

## Bugs reales encontrados durante la verificación

1. **Reintentar un lote duplicaba la notificación in-app y habría reenviado el correo.**
   El `UNIQUE (announcement_id, user_id)` protegía las filas, pero el INSERT en
   `notifications` corría en cada reintento. Un corte de red a mitad de un envío le habría
   duplicado el comunicado a cientos de alumnos. Lo encontró la verificación empírica
   (16 notificaciones para 8 destinatarios), no la revisión de código. Corregido.

2. **`branch_visible(NULL)` devuelve `TRUE`.** Usar ese helper en el `WITH CHECK` del
   INSERT —como hace el resto del esquema— habría dejado a una secretaria crear un
   comunicado multi-sede y alcanzar alumnos de otra sede, rompiendo AC8 en silencio.
   En las otras tablas no es problema porque su `branch_id` es `NOT NULL`.

3. **ARCH-12:** el compositor importaba el DTO crudo. Resuelto re-exportando el tipo desde
   el modelo de UI, siguiendo el precedente de `ConsentType`.

---

## Cambios en índices

- `indices/DATABASE.md` — `announcements` y `announcement_recipients` con columnas y policies
- `indices/MODELS.md`, `UTILS.md`, `FACADES.md`, `COMPONENTS.md`, `USAGE-MAP.md`, `STYLES.md`
- Pendiente en el cierre: `indices/NOTIFICATIONS-MAP.md` §9.3 — el comunicado global deja
  de ser "sin implementar"

---

## Semáforos

| Check | Resultado |
|---|---|
| `npm run lint:arch` | ✅ exit 0, sin regresión de ratchet |
| `npm run test:ci` | ✅ 2389 passed · 5 skipped (40 nuevos de esta spec) |
| `npx ng build` | ✅ exit 0 |
| QA en browser | ✅ como secretaria, contra la BD de desarrollo real |
| Verificación server-side (RLS + consentimiento) | ✅ 13/13 checks |
