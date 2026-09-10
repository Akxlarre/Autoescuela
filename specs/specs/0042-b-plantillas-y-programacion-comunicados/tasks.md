# Tasks 0042-b — Plantillas y programación de comunicados

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-09-10

---

## Cómo usar este archivo

- Cada tarea es **atómica**: se empieza y se termina en un sitting.
- Marcá `[x]` apenas pase su DoD (no antes, no en bloque).
- Si algo queda fuera del scope de la spec → **detenete** y creá spec nueva.

> ⚠️ **Migraciones:** el Docker local no se usa. Verificar con `supabase db query --linked` contra
> la BD de desarrollo y revisar `supabase migration list` antes de un `db push`.

> ⚠️ **Envíos de prueba:** los 200 alumnos sembrados tienen dominio `@test-data.local`
> (inexistente). Toda verificación de envío va con `dryRun: true`, que `send-announcement` ya
> soporta. Un envío real sería ~200 rebotes duros contra el dominio de la escuela.

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — Migración `20260910120000_announcements_scheduling.sql`
  - **AC ref:** AC5, AC7, AC8, AC-E4
  - **DoD:**
    - [x] `scheduled_for`, `status` (DEFAULT `'enviado'`) y `template_id` en `announcements`
    - [x] CHECK con los 4 estados — verificado en `pg_constraint`
    - [x] Índice **parcial** verificado: `... (scheduled_for) WHERE (status = 'programado')`
    - [x] Backfill del estado de los comunicados existentes
    - [x] Idempotente (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, CHECK guardado por `pg_constraint`)
    - [x] Aplicada con `db push` y verificada con `db query --linked`

  > `template_id` va con `ON DELETE SET NULL`: borrar una plantilla no puede borrar el registro
  > de lo que ya se comunicó.

- [x] **T1.2** — Job de `pg_cron` que invoca el dispatcher
  - **AC ref:** AC6
  - **DoD:**
    - [x] `cron.schedule('dispatch-scheduled-announcements', '*/15 * * * *', ...)` — activo,
          verificado en `cron.job`
    - [x] Patrón de `auto-create-next-promotions`: `net.http_post` con `project_url` y
          `service_role_key` desde el vault, sin hardcodear
    - [x] `cron.unschedule` previo condicional, para que re-aplicar la migración no duplique el job

- [x] **T1.3** — DTO y UI models
  - **DoD:**
    - [x] `dto/notification-template.model.ts` mapea la tabla 1:1
    - [x] `ui/notification-template.model.ts` con `TemplateDraft`, `TemplateRow`,
          `TEMPLATE_VARIABLES` y `TemplateVariableValues`
    - [x] `dto/announcement.model.ts` y `ui/announcement.model.ts` extendidos con estado, fecha
          programada y plantilla
    - [x] `AnnouncementStatus` re-exportado desde el modelo de UI (ARCH-12)
    - [x] `npx ng build` exit 0
    - [x] Documentado en `indices/MODELS.md` y `indices/DATABASE.md`

  > El cambio de contrato rompió exactamente 2 sitios, ambos detectados por `ng build` y no
  > por los tests: el mapper `toRow()` de la facade y el `buildDraft()` del compositor. De
  > paso hubo que sumar `status` y `scheduled_for` al SELECT del historial — el mapper los
  > habría leído como `undefined` sin que nada fallara en compilación.

---

## Fase 2 — Núcleo funcional (TDD)

- [ ] **T2.1** — Escribir `core/utils/announcement-template.utils.spec.ts` **primero**
  - **AC ref:** AC3, AC5, AC-E1
  - **DoD:**
    - [ ] Sustituye `{{nombre}}` y `{{sede}}`; múltiples ocurrencias de la misma variable
    - [ ] Variable desconocida → cadena vacía, sin excepción (AC-E1)
    - [ ] Cuerpo sin variables queda intacto; llaves sueltas (`{`, `}}`) no rompen
    - [ ] Validación de fecha programada: pasado inválido, futuro válido, `null` = inmediato
    - [ ] Los tests **fallan** antes de implementar

- [ ] **T2.2** — Implementar `core/utils/announcement-template.utils.ts`
  - **DoD:**
    - [ ] Funciones puras, sin inyección de Angular
    - [ ] Tests verdes
    - [ ] Documentado en `indices/UTILS.md`

---

## Fase 3 — Refactor de envío a `_shared/` (el paso riesgoso)

> Va **antes** que todo lo nuevo, con la suite de 0041-b como red. Si esto no queda verde, no se
> sigue: se está tocando la función que decide a qué alumnos les llega un correo.

- [ ] **T3.1** — Extraer el núcleo de envío a `supabase/functions/_shared/announcement-send.ts`
  - **AC ref:** ninguno nuevo — es refactor puro, no debe cambiar comportamiento
  - **DoD:**
    - [ ] Resolución de segmento, filtro de consentimiento, materialización, lotes e idempotencia
          viven en el módulo compartido
    - [ ] `send-announcement/index.ts` queda como **borde HTTP**: valida auth de usuario, valida
          sede, y delega
    - [ ] **La validación de usuario NO se mueve al núcleo compartido** — si viviera ahí, el
          dispatcher tendría que saltearla y volveríamos al problema que este refactor evita
    - [ ] Precedente seguido: `_shared/anti-abuse.ts`, `_shared/reenrollment.ts`
    - [ ] Redesplegada y re-verificada con el script de verificación de 0041-b (13/13 en `dryRun`)

- [ ] **T3.2** — Sustitución de variables aplicada por destinatario en el envío
  - **AC ref:** AC3, AC-E1
  - **DoD:**
    - [ ] Se sustituye justo antes de armar el HTML, con los datos de cada destinatario
    - [ ] `announcements.body` sigue guardando los marcadores intactos (el registro tiene que
          reflejar lo que se redactó, no lo que vio un alumno puntual)
    - [ ] Escapado sigue aplicándose después de sustituir (una variable no puede inyectar HTML)

---

## Fase 4 — Dispatcher

- [ ] **T4.1** — Crear `supabase/functions/dispatch-scheduled-announcements/index.ts`
  - **AC ref:** AC6, AC-E2, AC-E3, AC-E4
  - **DoD:**
    - [ ] Corre con `service_role`, sin usuario autenticado
    - [ ] Busca `status='programado' AND scheduled_for <= now()`
    - [ ] **Candado:** toma cada uno con `UPDATE ... SET status='enviando' WHERE id=$1 AND
          status='programado' RETURNING id`; si no devuelve fila, otro lo tomó y se saltea (AC-E4)
    - [ ] Envía usando el núcleo de `_shared/` (segmento resuelto **al enviar**, no al programar)
    - [ ] Vencidos viejos se envían igual, no se saltean (AC-E2)
    - [ ] Segmento vacío → `enviado` con 0 destinatarios y motivo, sin reintentar (AC-E3)
    - [ ] Rescata los `enviando` con más de N minutos (si la EF murió a mitad, si no quedan
          huérfanos para siempre)

- [ ] **T4.2** — Verificar el dispatcher contra la BD de desarrollo
  - **AC ref:** AC6, AC-E2, AC-E3, AC-E4
  - **DoD (todo en `dryRun`):**
    - [ ] AC-E4 · dos `UPDATE` concurrentes sobre el mismo comunicado → solo uno afecta fila
    - [ ] AC6 · programado con fecha pasada → se envía y respeta el filtro de consentimiento
    - [ ] AC-E3 · segmento vacío al vencer → `enviado` con 0, no queda reintentando
    - [ ] Datos de verificación limpiados de la BD compartida

---

## Fase 5 — Facades (TDD)

- [ ] **T5.1** — `notification-templates.facade.spec.ts` **primero**, luego la facade
  - **AC ref:** AC1, AC4
  - **DoD:**
    - [ ] Tests de CRUD y de SWR de la lista
    - [ ] Estructura: estado privado → público readonly → métodos; `catchError` + signal de error
    - [ ] Documentada en `indices/FACADES.md`

- [ ] **T5.2** — `AnnouncementsFacade`: `schedule()` y `cancelScheduled()` (tests primero)
  - **AC ref:** AC5, AC8
  - **DoD:**
    - [ ] `schedule()` persiste `status='programado'` y **no** invoca la Edge Function (AC5)
    - [ ] `cancelScheduled()` pasa a `cancelado`; **no borra la fila** (AC8: es trazabilidad)
    - [ ] `send()` existente sigue seteando `status='enviado'` sin romper 0041-b

---

## Fase 6 — UI

- [ ] **T6.1** — Gestión de plantillas: `template-manager-drawer.component.ts`
  - **AC ref:** AC1, AC4
  - **DoD:**
    - [ ] OnPush; abre desde el tab "Ajustes" del `AjustesDrawerComponent`, **gateado a admin**
          (mismo lugar que límite de agenda, precios y tarifas — sin ítem de menú nuevo)
    - [ ] Crear, editar, activar/desactivar y borrar plantillas
    - [ ] Ayuda visible de las variables disponibles (`{{nombre}}`, `{{sede}}`)
    - [ ] `data-llm-action` en guardar y borrar; `ConfirmModalService` antes de borrar
    - [ ] Documentado en `indices/COMPONENTS.md`

- [ ] **T6.2** — Compositor: selector de plantilla + programar
  - **AC ref:** AC2, AC5
  - **DoD:**
    - [ ] Selector "Partir de una plantilla…" (opcional) que carga asunto y cuerpo **editables**
    - [ ] Botón "Programar" con fecha y hora; fecha pasada rechazada en el formulario
    - [ ] La confirmación distingue enviar ahora de programar
    - [ ] La UI comunica la granularidad real ("se enviará alrededor de las HH:MM"), no promete
          precisión al minuto que el cron de 15 min no tiene

- [ ] **T6.3** — Historial: estados y cancelar
  - **AC ref:** AC7, AC8
  - **DoD:**
    - [ ] Programados arriba, con badge "Programado" y su fecha
    - [ ] Acción de cancelar solo en `programado` (no en `enviando`)
    - [ ] Cancelados atenuados, no ocultos
    - [ ] Sigue siendo Dumb: solo `input()`/`output()`

- [ ] **T6.4** — Registrar íconos nuevos en `app.config.ts`
  - **DoD:** solo los que se usen de verdad (ARCH-14 ya reporta 29 sin uso)

---

## Fase 7 — Validación

- [ ] **T7.1** — `npm run lint:arch` exit 0, sin regresión de ratchet (ARCH-25 en su baseline)
- [ ] **T7.2** — `npm run test:ci` verde
- [ ] **T7.3** — `npx ng build` sin errores (ve cosas que vitest no: ya pasó dos veces en 0041-b)
- [ ] **T7.4** — QA manual en browser (`/verify`)
  - **DoD:**
    - [ ] Como admin: crear plantilla, verla en el compositor
    - [ ] Como secretaría: usar la plantilla, programar, ver en historial, cancelar
    - [ ] AC4 · la secretaría **no** ve la gestión de plantillas
- [ ] **T7.5** — `/spec-verify` → `acceptance.md` con evidencia por AC

---

## Fase 8 — Cierre

- [ ] **T8.1** — Sincronizar `indices/` (`npm run indices:sync`)
- [ ] **T8.2** — Mover la spec a Done en `specs/ROADMAP.md`
- [ ] **T8.3** — `status: done` en `spec.md` y limpiar `specs/.active`

---

## Tareas descubiertas durante implementación

> Dentro del scope de la spec → agregar acá. Fuera de scope → spec nueva.

- [ ] …
