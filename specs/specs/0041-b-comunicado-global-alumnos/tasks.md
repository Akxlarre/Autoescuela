# Tasks 0041-b — Comunicado global a alumnos (1:N, email + in-app)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-09-09

---

## Cómo usar este archivo

- Cada tarea es **atómica**: se empieza y se termina en un sitting.
- Marcá `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si algo queda fuera del scope de la spec → **detenete** y creá spec nueva.

> ⚠️ **Migraciones en este proyecto:** el Docker local no se usa (puertos ocupados por otro
> proyecto). Verificar siempre con `supabase db query --linked` contra la BD de desarrollo, y
> revisar `supabase migration list` antes de un `db push` — este repo arrastra historial de drift
> de tracking (julio y agosto 2026).

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — Crear migración `20260909140000_announcements_create.sql`
  - **AC ref:** AC7, AC8
  - **DoD:**
    - [x] Tablas `announcements` y `announcement_recipients` con el DDL del plan §4
    - [x] `UNIQUE (announcement_id, user_id)` presente (idempotencia entre lotes)
    - [x] Índices `idx_announcements_branch_sent` e `idx_announcement_recipients_user`
    - [x] `ENABLE ROW LEVEL SECURITY` en ambas (verificado: `rowsecurity = true`)
    - [x] Idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`)

- [x] **T1.2** — Políticas RLS de ambas tablas
  - **AC ref:** AC8
  - **DoD:**
    - [x] `admin`: SELECT/INSERT/UPDATE en todas las sedes
    - [x] `secretary`: acotado a su `branch_id`
    - [x] **Sin policy DELETE en ningún rol** (verificado: solo existen 4 policies, ninguna DELETE)
    - [x] `announcement_recipients` sin INSERT/UPDATE para roles de cliente (solo `service_role`)
    - [x] Alumno sin acceso a ninguna de las dos
    - [x] Aplicada con `db push` y verificada con `db query --linked`

  > **Hallazgo durante la implementación:** `branch_visible(NULL)` devuelve **TRUE**
  > (`p_branch_id IS NULL OR …`). Usarlo en el `WITH CHECK` del INSERT —como hace
  > `insert_enrollments`— habría dejado a una secretaria crear un comunicado con
  > `branch_id NULL`, o sea multi-sede, alcanzando alumnos de otra sede y rompiendo AC8 en
  > silencio. En `enrollments` no es un problema porque su `branch_id` es NOT NULL; acá es
  > nullable a propósito. Por eso el INSERT/UPDATE de `announcements` lleva el check
  > explícito `branch_id IS NOT NULL AND branch_id = auth_user_branch_id()` en vez del helper.

- [x] **T1.3** — DTO `core/models/dto/announcement.model.ts`
  - **DoD:**
    - [x] `Announcement`, `AnnouncementRecipient`, `AnnouncementKind` mapean 1:1 las tablas
    - [x] PascalCase singular, sin prefijo `I`

- [x] **T1.4** — UI Model `core/models/ui/announcement.model.ts`
  - **DoD:**
    - [x] `AnnouncementDraft`, `RecipientSegmentFilters`, `RecipientPreview`, `AnnouncementRow`, `SendProgress`
    - [x] `AnnouncementRow` usa `Pick<Announcement, …>` sobre el DTO (no clona la interfaz)

- [x] **T1.5** — Documentar el modelo en índices
  - **DoD:**
    - [x] `indices/DATABASE.md` con ambas tablas, columnas y policies (vía `npm run indices:sync`, es auto-generado)
    - [x] `indices/MODELS.md` con los modelos nuevos

---

## Fase 2 — Núcleo funcional (TDD)

- [ ] **T2.1** — Escribir `core/utils/announcement-recipients.utils.spec.ts` **primero**
  - **AC ref:** AC2, AC-E1
  - **DoD:**
    - [ ] Armado de lotes: N/tamaño exacto, con resto, lista vacía, N menor que el lote
    - [ ] Validación del draft: sin `kind` → inválido (AC2); sin asunto/cuerpo → inválido; 0 destinatarios → inválido (AC-E1); sobre el tope duro de 500 → inválido
    - [ ] Conteo de excluidos agrupado por motivo
    - [ ] Los tests **fallan** (no hay implementación)

- [ ] **T2.2** — Implementar `core/utils/announcement-recipients.utils.ts`
  - **AC ref:** AC2, AC-E1
  - **DoD:**
    - [ ] Funciones puras (data in → data out), sin inyección de Angular
    - [ ] `npm run test:ci` verde para este archivo
    - [ ] Documentado en `indices/UTILS.md`

---

## Fase 3 — Edge Function

- [ ] **T3.1** — Crear `supabase/functions/send-announcement/index.ts`
  - **AC ref:** AC3, AC4, AC6, AC-E2, AC-E3
  - **DoD:**
    - [ ] Copia la estructura de `send-zoom-email` (nodemailer, secrets `SMTP_*`, CORS, `jsonResponse`)
    - [ ] Valida auth y que el emisor sea `admin` o `secretary`
    - [ ] **Resuelve los destinatarios server-side** desde `enrollments → students → users` según los filtros recibidos (nunca confía en una lista del cliente)
    - [ ] Si `kind = 'promocional'` → filtra por `consents` (`comunicaciones_promocionales`, `granted` y `revoked_at IS NULL`) — AC3
    - [ ] Si `kind = 'operativo'` → **no** filtra por consentimiento — AC4
    - [ ] Aplica `excludedUserIds` y toma el slice `offset`/`batchSize`
    - [ ] Escapa el cuerpo (texto plano) antes de inyectarlo en el HTML de marca
    - [ ] Inserta las notificaciones in-app **aunque el email falle** (AC-E3) y para alumnos sin email (AC-E2)
    - [ ] Upsert idempotente en `announcement_recipients` (no duplica al reintentar)
    - [ ] Devuelve `{ sent, failed, processed, done }`

- [ ] **T3.2** — Verificar la Edge Function contra la BD de desarrollo
  - **AC ref:** AC3, AC4, AC-E4
  - **DoD:**
    - [ ] Alumno con consentimiento promocional revocado: excluido en `promocional`, incluido en `operativo`
    - [ ] Revocar entre preview y envío → excluido (AC-E4)
    - [ ] Reintentar el mismo lote no duplica filas ni correos

---

## Fase 4 — Capa Facade (TDD)

- [ ] **T4.1** — Escribir `core/facades/announcements.facade.spec.ts` **primero**
  - **AC ref:** AC1, AC5, AC7, AC-E3
  - **DoD:**
    - [ ] `send()` inserta el announcement, itera lotes y actualiza `progress`
    - [ ] Fallo parcial de un lote no aborta el resto y acumula `failed` (AC-E3)
    - [ ] Historial SWR: `initialize()` dos veces no re-muestra skeleton
    - [ ] Scope de sede aplicado cuando `selectedBranchId()` no es nulo
    - [ ] Los tests **fallan**

- [ ] **T4.2** — Implementar `core/facades/announcements.facade.ts`
  - **AC ref:** AC1, AC5, AC7, AC-E3
  - **DoD:**
    - [ ] Estructura: estado privado → público readonly → métodos
    - [ ] Inyecta `BranchFacade`; `createRequestGuard()` en el fetch del historial
    - [ ] SWR: `initialize()` + `refreshSilently()` + `_initialized`
    - [ ] `catchError` y signal de error expuesto
    - [ ] Orquestación por lotes de 25 con `progress` signal
    - [ ] `npm run test:ci` verde
    - [ ] Documentado en `indices/FACADES.md`

---

## Fase 5 — Capa UI

- [ ] **T5.1** — Compositor `features/comunicados/announcement-composer-drawer.component.ts`
  - **AC ref:** AC1, AC2, AC5, AC6, AC-E1
  - **DoD:**
    - [ ] OnPush, inyecta `AnnouncementsFacade`
    - [ ] Selector de `kind` obligatorio **sin default** (AC2)
    - [ ] Filtros de segmento (sede / tipo de curso / estado) con lista resuelta y conteo (AC1)
    - [ ] Destilde de destinatarios puntuales (AC5) con `<p-paginator>` si la lista es larga
    - [ ] Muestra excluidos por consentimiento con su motivo (AC3)
    - [ ] Redacción (asunto + cuerpo texto plano) y preview del email
    - [ ] Botón de envío con `data-llm-action="enviar-comunicado"`, deshabilitado si el draft es inválido
    - [ ] `ConfirmModalService` antes de enviar (acción irreversible y masiva)
    - [ ] Barra de progreso durante el envío
    - [ ] Advertencia visible sobre 200 destinatarios; bloqueo sobre 500
    - [ ] Tokens semánticos, `.card`, `<app-icon>` (nada de SVG inline ni emojis)

- [ ] **T5.2** — Historial `shared/components/announcements-content/announcements-content.component.ts`
  - **AC ref:** AC7
  - **DoD:**
    - [ ] Dumb: solo `input()` / `output()`, sin inyectar Facades
    - [ ] Lista de comunicados con asunto, tipo, emisor, fecha y contadores
    - [ ] Detalle por destinatario con `<app-badge>` (entregado / fallido / sin email)
    - [ ] Skeleton **dentro** del componente con `<app-skeleton-block>` (no `*-skeleton.component.ts`)
    - [ ] `<app-empty-state>` centrado en wrapper `flex-1 flex items-center justify-center` (regla `.bento-fill`)
    - [ ] Tests si tiene `computed()` con lógica derivada
    - [ ] Documentado en `indices/COMPONENTS.md`

- [ ] **T5.3** — Registrar íconos nuevos en `app.config.ts`
  - **DoD:**
    - [ ] `megaphone`, `send`, `mail-check`, `user-x` (los que efectivamente se usen) en `provideIcons()`
    - [ ] Sin íconos registrados de más (ARCH-14 ya reporta 29 sin uso)

---

## Fase 6 — Conexión

- [ ] **T6.1** — Conectar en `features/secretaria/observaciones/secretaria-observaciones.component.ts`
  - **AC ref:** AC1, AC7, AC8
  - **DoD:**
    - [ ] `<app-tabs variant="line">` a nivel página: "Tareas" / "Comunicados"
    - [ ] Acción de hero "Nuevo comunicado" que abre el compositor vía `LayoutDrawerFacadeService`
    - [ ] La pestaña Comunicados respeta el patrón app-like (`.bento-fill`)
    - [ ] Scope de sede de la secretaria respetado

- [ ] **T6.2** — Conectar en `features/admin/tareas/admin-tareas.component.ts`
  - **AC ref:** AC1, AC7
  - **DoD:**
    - [ ] Mismo wire-up que T6.1, con alcance multi-sede
    - [ ] `features/instructor/tareas/` **NO** se toca (verificado)

- [ ] **T6.3** — Animación de entrada
  - **DoD:**
    - [ ] `animateBentoGrid()` sigue funcionando con la estructura nueva de tabs
    - [ ] Sin `@angular/animations` ni `@keyframes`

---

## Fase 7 — Validación

- [ ] **T7.1** — `npm run lint:arch` limpio
  - **DoD:** 0 errores y **sin regresión de ratchet** (ARCH-25 en su baseline; ya subió dos veces en specs previas por componer cards a mano)
- [ ] **T7.2** — `npm run test:ci` verde
- [ ] **T7.3** — `npx ng build` sin errores
  - **DoD:** corrido explícitamente — vitest no type-checkea con el mismo rigor que el build (lección de 0040-b)
- [ ] **T7.4** — QA manual en browser (`/verify`)
  - **DoD:**
    - [ ] Golden path como secretaria: filtros → destilde → redacción → preview → envío → historial
    - [ ] AC-E2: alumno sin email reportado, con notificación in-app igual
    - [ ] Notificación in-app verificada en el portal del alumno (`alumno@test.com`)
- [ ] **T7.5** — Verificación server-side de RLS
  - **DoD:** secretaria de sede A no puede insertar un comunicado con `branch_id` de sede B (rechazo real de RLS, no solo UI oculta) — AC8
- [ ] **T7.6** — `/spec-verify` → `acceptance.md` con evidencia por AC

---

## Fase 8 — Cierre

- [ ] **T8.1** — Sincronizar `indices/` (`/sync-indices`)
  - **DoD:** incluye actualizar `indices/NOTIFICATIONS-MAP.md` §9.3 — el comunicado global deja de ser "sin implementar"
- [ ] **T8.2** — Mover la spec a Done en `specs/ROADMAP.md`
- [ ] **T8.3** — `status: done` en `spec.md` y limpiar `specs/.active`

---

## Tareas descubiertas durante implementación

> Dentro del scope de la spec → agregar acá. Fuera de scope → spec nueva.

- [ ] …
