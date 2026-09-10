# Acceptance 0042-b — Plantillas y programación de comunicados

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-09-10
> **Verifier:** Claude · validado por Benjamín

---

## Resumen

- AC totales: **12** (8 + 4 edge cases)
- AC cumplidos: **12**
- AC con evidencia empírica contra la BD de desarrollo real: **7**

**Veredicto final:** ✅ **PASA**

---

## Verificación por AC

### AC1 — El admin crea una plantilla y queda disponible en el compositor

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `notification-templates.facade.spec.ts` — "AC1 · una plantilla nueva se inserta"
  - `template-manager-drawer.component.ts` — CRUD completo, abierto desde el tab "Ajustes"
  - QA en browser: plantilla sembrada en la BD real apareció en el selector del compositor

### AC2 — Elegir una plantilla carga asunto y cuerpo, y quedan editables

- **Estado:** ✅ cumplido — **verificado en la UI real**
- **Evidencia:**
  - QA en browser como `admin@test.com` contra la BD real: al aplicar la plantilla, el asunto
    quedó en `"No hay clases el viernes"` y el cuerpo en
    `"Hola {{nombre}}, te avisamos que el viernes no habrá clases prácticas en {{sede}}…"`
  - **Los marcadores llegan sin resolver, y eso es lo correcto**: se sustituyen por
    destinatario al enviar, no al elegir la plantilla.
  - Los campos son `input`/`textarea` normales: el texto se puede editar antes de enviar.

### AC3 — Las variables se reemplazan con los datos de cada destinatario

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `announcement-template.utils.spec.ts` — 11 casos de `renderTemplate()`: una variable,
    varias, la misma repetida, con espacios dentro de las llaves, saltos de línea.
  - `_shared/announcement-send.ts` — la sustitución corre **por destinatario**, con su
    propio nombre y su propia sede, justo antes de armar el HTML.
  - **El escapado va después de sustituir**: al revés no alcanzaría al contenido de la
    variable, y un alumno con markup en el nombre podría inyectar HTML en el correo de todos.

### AC4 — La secretaría no puede crear, editar ni borrar plantillas

- **Estado:** ✅ cumplido
- **Evidencia:**
  - **No necesitó código.** La RLS de `notification_templates` ya restringe
    INSERT/UPDATE/DELETE a `admin` y deja SELECT a `admin` + `secretary`.
  - `notification-templates.facade.spec.ts` — "AC4 · si la BD rechaza la escritura, se expone
    el error y no se miente" y su equivalente en `remove()`.
  - La facade **expone** el rechazo de la base en vez de simularlo con un `if` de rol, que
    sería una comprobación que el cliente puede saltear.

### AC5 — Programar deja el comunicado agendado sin enviarlo

- **Estado:** ✅ cumplido — **verificado en la UI real**
- **Evidencia:**
  - `announcements.facade.spec.ts` — "AC5 · programar persiste el comunicado SIN despachar
    nada", afirmado con `expect(invokeSpy).not.toHaveBeenCalled()`.
  - QA en browser: fecha pasada → `canSend()` en `false`; fecha futura → válida, con la
    conversión de zona horaria correcta (09:39 local → `2026-09-11T12:39:00.000Z`).

### AC6 — Al vencer, se envía resolviendo el segmento en ese momento

- **Estado:** ✅ cumplido — **verificado contra la BD real**
- **Evidencia:**
  - El dispatcher usa el mismo núcleo de `_shared/`, que resuelve el segmento al enviar y
    re-aplica el filtro de consentimiento. Se guardan los **filtros**, nunca una lista.
  - Verificación en vivo (en `dryRun`): un comunicado programado con fecha de ayer fue
    tomado y despachado por el dispatcher invocado con el mismo `net.http_post` del cron.

### AC7 — El historial distingue lo programado de lo enviado

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `announcements-content.component.ts` — badge de estado para todo lo que no está
    `enviado`, y los programados muestran "Sale el …" con su fecha.
  - `AnnouncementsFacade.toRow()` mapea `status` y `scheduled_for` desde la BD.

### AC8 — Cancelar impide el envío y queda registrado, sin borrar

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `announcements.facade.spec.ts` — "AC8 · cancelar pasa a cancelado y NO borra la fila" y
    "AC8 · cancelar solo afecta a lo que sigue programado".
  - **El filtro `status='programado'` del UPDATE no es redundante:** sin él, cancelar podría
    pisar un comunicado que el dispatcher ya empezó a despachar y dejarlo a mitad de camino.
  - En la UI, la acción de cancelar solo aparece con `canCancel` (derivado de `status`).

---

## Edge cases

### AC-E1 — Una variable inexistente no rompe el envío

- **Estado:** ✅ cumplido
- **Evidencia:** `announcement-template.utils.spec.ts` — "AC-E1 · una variable desconocida se
  reemplaza por vacío, sin lanzar", y el caso de una variable conocida sin valor para ese
  destinatario. Un typo en una plantilla no puede tumbar un envío a cientos de personas.

### AC-E2 — Un programado vencido se envía igual, no se saltea

- **Estado:** ✅ cumplido — **verificado contra la BD real**
- **Evidencia:** el dispatcher consulta `scheduled_for <= now()`, que incluye los atrasados.
  Verificado con un comunicado fechado ayer: el dispatcher lo tomó y lo despachó.

### AC-E3 — Segmento vacío al vencer queda cerrado, sin reintentar

- **Estado:** ✅ cumplido — **verificado contra la BD real**
- **Evidencia:** comunicado programado con un segmento imposible (sede 1 + profesional, que
  solo se dicta en sede 2) → quedó `status='enviado'` con `recipients_total = 0`. Al pasar a
  `enviado` sale del universo del dispatcher y no vuelve a intentarse.

### AC-E4 — Dos corridas solapadas no duplican el envío

- **Estado:** ✅ cumplido — **verificado con concurrencia real**
- **Evidencia:**
  - Dos `UPDATE ... WHERE status='programado'` disparados en paralelo sobre el mismo
    comunicado: **exactamente uno recibió fila**. Una toma posterior tampoco gana.
  - La exclusión mutua la resuelve la base, no la lógica de aplicación — que es donde este
    tipo de bug se escapa.

---

## Out-of-scope respetado

- ❌ **Envíos recurrentes** — no se implementaron.
- ❌ **Variables financieras o de agenda** — `TEMPLATE_VARIABLES` está acotado a
  `['nombre', 'sede']`.
- ❌ **Lógica condicional en plantillas** — el motor solo sustituye marcadores.
- ❌ **Editor de texto enriquecido** — sigue siendo textarea de texto plano escapado.
- ❌ **Plantillas por sede** — la tabla no tiene `branch_id` y no se agregó.
- ❌ **Envío de archivos** — diferido a `0043-b`, anotado en el backlog del ROADMAP.

---

## Hallazgos que solo aparecieron al correrlo

1. **Comparar la key contra la env var rechazaba al propio cron (401).** La
   `service_role_key` del vault es el JWT legacy y no coincide con
   `SUPABASE_SERVICE_ROLE_KEY` del runtime. Se corrigió validando el **claim `role`**: la
   autenticidad ya la garantiza el gateway, la función decide la autorización.

2. **`pg_net` corta a los 5 segundos, pero la función termina igual.** El cron dispara y
   olvida. **Implicancia operativa: los errores del dispatcher solo se ven en los logs de la
   Edge Function**, nunca en `net._http_response`.

3. **Se enviaron 8 correos reales a dominios inexistentes durante la verificación.** El
   dispatcher no aceptaba `dryRun` y el comunicado de prueba resolvía a 8 alumnos sembrados
   `@test-data.local`. Corregido: el dispatcher acepta `dryRun`, y la regla para adelante es
   que **todo comunicado de prueba en la BD compartida use un segmento que resuelva a cero**.

4. **El cambio de contrato de los modelos rompió 2 sitios que ningún test detectó** — el
   mapper de la facade y el `buildDraft()` del compositor. Los encontró `ng build`. Confirma
   por qué el plan lo tiene como paso propio y no confía solo en vitest.

---

## Deuda declarada

- **La granularidad real del envío programado es de 15 minutos**, no al minuto. La UI lo
  comunica ("± 15 minutos") en vez de prometer precisión que el cron no tiene.
- **Sin monitoreo del dispatcher.** Por el punto 2 de arriba, un fallo del despacho es
  silencioso para la base. Si el volumen de comunicados programados crece, conviene una
  alerta sobre comunicados que quedaron mucho tiempo en `enviando`.
