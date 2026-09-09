# Plan 0041-b — Comunicado global a alumnos (1:N, email + in-app)

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-09-09
> **Approved:** 2026-09-09
> **Talla:** L — facade nueva, 2 tablas nuevas, Edge Function nueva, dominio de negocio nuevo.

---

## 1. Resumen ejecutivo

Se construye el comunicado 1:N en tres capas: (1) persistencia — dos tablas nuevas
(`announcements` + `announcement_recipients`) que dejan el registro auditable de qué se envió y a
quién; (2) envío — una Edge Function `send-announcement` que generaliza el patrón ya probado de
`send-zoom-email`, **resolviendo la lista de destinatarios en el servidor** para que el filtro de
consentimiento no dependa del cliente; (3) UI — un compositor en drawer y un historial, ambos
colgados del módulo Comunicación existente.

La decisión estructural del plan es que **el cliente nunca decide a quién se le envía**: manda la
definición del segmento y las exclusiones manuales, y el servidor resuelve la lista final en el
momento del envío. Eso es lo que hace que AC3/AC4/AC-E4 sean reales y no cosméticos.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260909140000_announcements_create.sql` | Migration | Tablas `announcements` + `announcement_recipients`, índices y RLS |
| `supabase/functions/send-announcement/index.ts` | Edge Function | Resuelve destinatarios server-side, envía SMTP por lote, escribe el detalle y las notificaciones in-app |
| `src/app/core/models/dto/announcement.model.ts` | DTO | Mapea ambas tablas nuevas |
| `src/app/core/models/ui/announcement.model.ts` | UI Model | `AnnouncementDraft`, `RecipientSegmentFilters`, `AnnouncementRow`, `RecipientPreview` |
| `src/app/core/utils/announcement-recipients.utils.ts` | Util (núcleo funcional) | Funciones puras: armado de lotes, conteo de excluidos, validación del draft |
| `src/app/core/utils/announcement-recipients.utils.spec.ts` | Test | Tests del núcleo funcional |
| `src/app/core/facades/announcements.facade.ts` | Facade | Estado del compositor, preview, orquestación del envío por lotes, historial |
| `src/app/core/facades/announcements.facade.spec.ts` | Test | Tests de la facade |
| `src/app/features/comunicados/announcement-composer-drawer.component.ts` | Smart (drawer) | Compositor: tipo, filtros, lista con destilde, redacción, preview, envío con progreso |
| `src/app/shared/components/announcements-content/announcements-content.component.ts` | Dumb | Historial de comunicados + detalle por destinatario |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/features/secretaria/observaciones/secretaria-observaciones.component.ts` | `<app-tabs>` a nivel página (Tareas / Comunicados) + acción de hero "Nuevo comunicado" | Alojar el feature sin ítem de menú nuevo |
| `src/app/features/admin/tareas/admin-tareas.component.ts` | Ídem | Mismo módulo, rol admin (multi-sede) |
| `src/app/app.config.ts` | Registrar íconos Lucide nuevos (`megaphone`, `send`, `mail-check`, `user-x`) | Sin registrar, la app falla en runtime |
| `indices/DATABASE.md`, `COMPONENTS.md`, `FACADES.md`, `MODELS.md`, `UTILS.md`, `NOTIFICATIONS-MAP.md` | Documentar lo nuevo; §9.3 pasa de "sin implementar" a implementado | Paso SINCRONIZAR |

> **`src/app/features/instructor/tareas/` NO se toca.** El instructor no envía comunicados a alumnos.

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `<app-tabs variant="line">` — tabs a nivel página, ya usado en 10+ pantallas (alumno-pagos, dms-list-content, reportes-contables). No se inventa un tab bar.
- `<app-section-hero>` — ya soporta múltiples `SectionHeroAction`; "Nuevo comunicado" entra como segunda acción sin tocar el componente.
- `<app-empty-state>` — historial vacío y segmento sin destinatarios.
- `<app-skeleton-block>` — carga del historial y resolución de la lista (regla del proyecto: skeleton dentro del mismo componente, nunca `*-skeleton.component.ts`).
- `<app-badge>` — estado por destinatario (entregado / fallido / sin email).
- `<p-paginator>` — lista de destinatarios y historial largos (precedente spec 0032/0039-b: paginar > virtualizar).
- `LayoutDrawerFacadeService.open()` — el compositor se abre igual que `TaskCreateDrawerComponent`.
- `ConfirmModalService` — confirmación antes de un envío masivo (acción irreversible).
- `ToastService` — resultado del envío.

### Facades/Services existentes que extendemos
- `NotificationsFacade` — ninguna modificación: las notificaciones in-app las inserta la Edge Function con `service_role`. El portal del alumno ya las muestra vía Realtime.
- `BranchFacade` — scope de sede del filtro (admin ve todas, secretaria la suya).

### Infraestructura existente que se generaliza
- `supabase/functions/send-zoom-email/index.ts` — precedente directo: mismo transporte nodemailer, mismos secrets (`SMTP_HOST/PORT/USER/PASS/FROM`), misma forma `recipients: {name,email}[]`, mismo wrapper HTML de marca. `send-announcement` copia esa estructura cambiando asunto/cuerpo por parámetros y agregando la resolución server-side.
- Tabla `notification_templates` — **se deja vacía y sin tocar** (fuera de alcance, spec futura).

### Componentes/Facades que NO existen y debemos crear
- `AnnouncementsFacade` — no hay ninguna facade de comunicados salientes. `TasksFacade` es del canal interno (`tasks.to_role` excluye al alumno a nivel de esquema, H2 del diagnóstico) y `NotificationsFacade` es el buzón del receptor, no el emisor.
- `<app-announcements-content>` — `<app-task-list-content>` está tipado para `Task`, no para comunicados.

---

## 4. Modelo de datos

### Migración requerida

```sql
-- supabase/migrations/20260909140000_announcements_create.sql

CREATE TABLE IF NOT EXISTS announcements (
  id                  BIGSERIAL PRIMARY KEY,
  subject             TEXT NOT NULL,
  body                TEXT NOT NULL,
  kind                TEXT NOT NULL CHECK (kind IN ('operativo','promocional')),
  branch_id           INT REFERENCES branches(id),      -- NULL = admin, multi-sede
  segment_filters     JSONB NOT NULL DEFAULT '{}',      -- qué se pidió (auditoría)
  sent_by             INT NOT NULL REFERENCES users(id),
  sent_at             TIMESTAMPTZ,
  recipients_total    INT NOT NULL DEFAULT 0,
  email_ok_count      INT NOT NULL DEFAULT 0,
  email_failed_count  INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_recipients (
  id               BIGSERIAL PRIMARY KEY,
  announcement_id  BIGINT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id          INT NOT NULL REFERENCES users(id),
  email            TEXT,                    -- snapshot al momento del envío (puede ser NULL, AC-E2)
  email_sent_ok    BOOLEAN NOT NULL DEFAULT false,
  send_error       TEXT,
  notification_id  INT REFERENCES notifications(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (announcement_id, user_id)         -- idempotencia entre lotes reintentados
);

CREATE INDEX IF NOT EXISTS idx_announcements_branch_sent
  ON announcements (branch_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_recipients_user
  ON announcement_recipients (user_id);
```

El `UNIQUE (announcement_id, user_id)` es lo que hace que reintentar un lote no duplique envíos ni
filas — importante porque el envío se orquesta en varias llamadas (ver §5).

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `announcements` | admin | SELECT / INSERT / UPDATE | Todas las sedes |
| `announcements` | secretary | SELECT / INSERT / UPDATE | Solo `branch_id` de su sede (mismo patrón que `select_enrollments`) |
| `announcements` | — | DELETE | **Ninguna policy.** Un comunicado enviado es registro, no se borra |
| `announcement_recipients` | admin | SELECT | Todas |
| `announcement_recipients` | secretary | SELECT | Vía el `announcement_id` de su sede |
| `announcement_recipients` | — | INSERT / UPDATE | Solo la Edge Function (`service_role`, bypassea RLS). Ningún rol escribe desde el cliente |
| ambas | alumno | — | **Sin acceso.** Ve el comunicado por `notifications`, no por estas tablas |

> El `UPDATE` de `announcements` para admin/secretary existe solo para que la Facade pueda cerrar
> los contadores al terminar el envío; el `service_role` de la EF también puede.

### Modelos UI/DTO

- `core/models/dto/announcement.model.ts` → `Announcement`, `AnnouncementRecipient`, `AnnouncementKind`
- `core/models/ui/announcement.model.ts` → `AnnouncementDraft` (lo que edita el compositor),
  `RecipientSegmentFilters` (`branchId`, `courseType`, `enrollmentStatus`), `RecipientPreview`
  (`userId`, `name`, `email`, `included`, `exclusionReason`), `AnnouncementRow` (fila del historial),
  `SendProgress` (`total`, `processed`, `ok`, `failed`).

---

## 5. Arquitectura del feature

### Decisión central: el servidor resuelve los destinatarios

```
Compositor (cliente)                      send-announcement (service_role)
  filtros + exclusiones manuales   ──►     1. re-resuelve el segmento desde la BD
  (preview, solo informativo)              2. si kind='promocional' → filtra por consents
                                              (granted AND revoked_at IS NULL)   ← AC3 / AC-E4
                                           3. aplica excludedUserIds             ← AC5
                                           4. toma el slice del lote
                                           5. envía SMTP + inserta notifications
                                           6. escribe announcement_recipients
```

El preview del cliente sirve para que la secretaria vea y ajuste (AC1/AC5), pero **no es la fuente
de verdad**. Si un alumno revoca entre el preview y el envío, la EF lo excluye igual (AC-E4).

### Envío por lotes orquestado desde la Facade

Una sola invocación no puede enviar cientos de correos: las Edge Functions tienen límite de tiempo
de ejecución y `send-zoom-email` envía secuencialmente (~200-500 ms por correo). Por eso:

```
AnnouncementsFacade.send(draft)
  1. INSERT announcements  → announcementId
  2. loop de lotes (batchSize = 25):
       POST send-announcement { announcementId, offset, batchSize }
       ← { sent, failed, done }
       actualiza progress signal   → la UI muestra "120 / 340"
  3. UPDATE announcements SET sent_at, contadores
```

Esto resuelve tres cosas de una: evita el timeout, da la barra de progreso que pide la spec (§7), y
**es el throttling** — la pausa natural entre llamadas espacia el envío en vez de dispararlo de
golpe (mitiga §9.4, reputación del dominio).

### Capas tocadas

- **Smart (drawer)**: `features/comunicados/announcement-composer-drawer.component.ts`
- **Dumb**: `shared/components/announcements-content/announcements-content.component.ts`
- **Facade**: `core/facades/announcements.facade.ts`
- **Núcleo funcional**: `core/utils/announcement-recipients.utils.ts`
- **Edge Function**: `supabase/functions/send-announcement/index.ts`
- **Migration**: `supabase/migrations/20260909140000_announcements_create.sql`

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Patrón Facade, OnPush, Signals. Lógica de lotes/validación en `core/utils/` (núcleo funcional), no en la Facade.
- [x] `facades.md` — Branch-scoped: `AnnouncementsFacade` inyecta `BranchFacade` y filtra por `selectedBranchId()`; `createRequestGuard()` en el fetch del historial.
- [x] `models.md` — DTO (`dto/announcement.model.ts`) y UI (`ui/announcement.model.ts`) separados.
- [x] `visual-system.md` — Tokens semánticos, `.card`, `<app-icon>`, patrón app-like en la pestaña del historial (`.bento-fill`).
- [x] `swr-pattern.md` — El historial cachea entre navegaciones: `initialize()` + `refreshSilently()`.
- [x] `notifications.md` — Toast al terminar el envío. Las notificaciones in-app se crean vía EF, nunca desde la UI.
- [x] `testing-tdd.md` — `.spec.ts` obligatorio para la facade y el util; se escriben **antes** de la implementación.
- [x] `ai-readability.md` — `data-llm-action="enviar-comunicado"` en el botón de envío.
- [x] `database.md` — Migración idempotente, RLS activada, documentada en `indices/DATABASE.md`.

---

## 7. Plan de testing

**Unitarios (`core/utils/announcement-recipients.utils.spec.ts`):**
- Armado de lotes: N destinatarios / tamaño de lote → cantidad y límites correctos; resto exacto; lista vacía.
- Validación del draft: sin `kind` → inválido (AC2); sin asunto o cuerpo → inválido; lista vacía → inválido (AC-E1).
- Conteo de excluidos por motivo.

**Unitarios (`core/facades/announcements.facade.spec.ts`):**
- `send()` inserta el announcement, itera los lotes y actualiza `progress` (mock de la EF).
- Fallo parcial de un lote: no aborta el resto, acumula `failed` (AC-E3).
- Historial: SWR (`initialize()` dos veces no re-muestra skeleton).
- Scope de sede: con `selectedBranchId()` no nulo, la query filtra.

**Verificación server-side (no unitaria — contra la BD de desarrollo, como en 0040-b):**
- AC3: comunicado `promocional` con un alumno de consentimiento revocado → no recibe.
- AC4: comunicado `operativo` con ese mismo alumno → sí recibe.
- AC-E4: revocar entre preview y envío → excluido.
- AC8: secretaria de sede A intentando `INSERT` con `branch_id` de sede B → rechazado por RLS.

**QA manual (`/verify`, browser real):**
- Golden path completo como secretaria: filtros → destilde → redacción → preview → envío → historial.
- AC-E2: alumno sin email → reportado, con notificación in-app igual.
- Verificar la notificación in-app en el portal del alumno (login como `alumno@test.com`).

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| **Reputación del dominio SMTP.** Un envío masivo mal calibrado manda a spam también contratos, certificados y facturas (§9.4) | **Alta** | Lotes de 25 con pausa entre llamadas; tope duro de destinatarios por comunicado; advertencia en la UI por encima de 200; la métrica de tasa de fallo SMTP es el indicador temprano |
| Timeout de la Edge Function con muchos destinatarios | Alta | Resuelto por diseño: el envío se parte en lotes desde la Facade, cada llamada procesa 25 |
| Envío duplicado al reintentar un lote | Media | `UNIQUE (announcement_id, user_id)` + upsert idempotente en la EF |
| El cliente manda una lista adulterada y alcanza a alumnos que revocaron | Media | Resuelto por diseño: el cliente manda filtros, no destinatarios; la EF re-resuelve y re-filtra por consentimiento |
| La secretaria envía un promocional creyendo que es operativo (o al revés) para saltear el filtro | Media | `kind` obligatorio sin default (AC2), queda registrado en `announcements.kind` con `sent_by` — auditable |
| Emails inválidos o vacíos en la base | Media | AC-E2: se reportan, no rompen el envío, y la notificación in-app llega igual |

---

## 9. Orden de implementación

1. **Migración SQL + RLS** — tablas, índices, políticas. Verificar contra la BD de desarrollo con `supabase db query --linked` (Docker local no se usa en este proyecto).
2. **Modelos DTO + UI.**
3. **Núcleo funcional** (`announcement-recipients.utils.ts`) — **tests primero** (TDD).
4. **Edge Function `send-announcement`** — resolución server-side + consentimiento + SMTP + notificaciones.
5. **`AnnouncementsFacade` + tests** — preview, orquestación por lotes, historial SWR.
6. **Compositor (drawer)** — filtros, lista con destilde, redacción, preview, progreso.
7. **Historial (`<app-announcements-content>`)** — lista + detalle por destinatario.
8. **Conexión en las 2 páginas de Comunicación** (admin + secretaria) con `<app-tabs>` y la acción de hero.
9. **Íconos en `app.config.ts`.**
10. **`lint:arch` + `test:ci` + `/verify` + verificación server-side de RLS y consentimiento.**
11. **SINCRONIZAR índices.**

---

## 10. Estimación

**L.** Los pasos 4-6 (Edge Function, Facade con orquestación de lotes, compositor) concentran el
grueso. Los pasos 1-3 son mecánicos; el 8 es de bajo riesgo pero toca páginas existentes.

---

## Decisiones que este plan cierra (venían abiertas en spec §9)

1. **Throttling:** lotes de **25** destinatarios por invocación de la Edge Function, orquestados
   secuencialmente desde la Facade; **tope duro de 500** destinatarios por comunicado y advertencia
   visible por encima de 200. Nace del límite de tiempo de la Edge Function, no de una preferencia.
2. **Historial en el portal del alumno:** no se construye. El alumno ve el comunicado como
   notificación in-app (reusa `notifications` y su Realtime). Una sección "Comunicados de la
   escuela" queda para una spec futura.
3. **Formato del cuerpo:** **texto plano** con saltos de línea respetados, escapado antes de
   inyectarse en el wrapper HTML de marca. Evita XSS por HTML arbitrario en un correo saliente y
   simplifica el compositor.

---

## Changelog

- 2026-09-09 — plan inicial. Cierra las 3 decisiones abiertas de la spec.
