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

- [x] **T2.1** — Escribir `core/utils/announcement-template.utils.spec.ts` **primero**
  - **AC ref:** AC3, AC5, AC-E1
  - **DoD:**
    - [x] Sustituye `{{nombre}}` y `{{sede}}`; múltiples ocurrencias; tolera `{{ espacios }}`
    - [x] Variable desconocida → cadena vacía, sin excepción (AC-E1); y variable conocida
          sin valor para ese destinatario, también
    - [x] Cuerpo sin variables intacto; llaves sueltas no rompen; saltos de línea respetados
    - [x] Validación de fecha programada: pasado inválido, futuro válido, `null` = inmediato,
          fecha ilegible inválida en vez de romper
    - [x] Los tests **fallaron** antes de implementar (módulo inexistente), verificado

- [x] **T2.2** — Implementar `core/utils/announcement-template.utils.ts`
  - **DoD:**
    - [x] Funciones puras, sin inyección de Angular
    - [x] 25/25 tests verdes
    - [x] Documentado en `indices/UTILS.md`

---

## Fase 3 — Refactor de envío a `_shared/` (el paso riesgoso)

> Va **antes** que todo lo nuevo, con la suite de 0041-b como red. Si esto no queda verde, no se
> sigue: se está tocando la función que decide a qué alumnos les llega un correo.

- [x] **T3.1** — Extraer el núcleo de envío a `supabase/functions/_shared/announcement-send.ts`
  - **AC ref:** ninguno nuevo — refactor puro
  - **DoD:**
    - [x] Resolución de segmento, filtro de consentimiento, materialización, lotes e idempotencia
          viven en el módulo compartido
    - [x] `send-announcement/index.ts` quedó como borde HTTP: de 427 → 120 líneas
    - [x] **La validación de usuario NO se movió al núcleo compartido**
    - [x] Precedente seguido: `_shared/anti-abuse.ts`, `_shared/reenrollment.ts`
    - [x] Redesplegada y **re-verificada con el script de 0041-b: 13/13 en `dryRun`**
    - [x] Datos de verificación limpiados

  > La red de seguridad funcionó como se esperaba: los mismos 13 checks que cerraron 0041-b
  > volvieron a pasar sin tocarlos. Un refactor de esta pieza sin esa verificación habría
  > sido a ciegas — es la función que decide a qué alumnos les llega un correo.

- [x] **T3.2** — Sustitución de variables aplicada por destinatario en el envío
  - **AC ref:** AC3, AC-E1
  - **DoD:**
    - [x] Se sustituye justo antes de armar el HTML, con los datos de cada destinatario
          (`{{nombre}}` del usuario, `{{sede}}` de su propia sede, no la del comunicado)
    - [x] `announcements.body` sigue guardando los marcadores intactos
    - [x] **Escapado después de sustituir**: si se escapara antes, el escapado no alcanzaría
          al contenido de la variable y un nombre con markup podría inyectar HTML
    - [x] El asunto también se sustituye, no solo el cuerpo

---

## Fase 4 — Dispatcher

- [x] **T4.1** — Crear `supabase/functions/dispatch-scheduled-announcements/index.ts`
  - **AC ref:** AC6, AC-E2, AC-E3, AC-E4
  - **DoD:**
    - [x] Corre con `service_role`, sin usuario autenticado
    - [x] Busca `status='programado' AND scheduled_for <= now()`
    - [x] **Candado** con `UPDATE ... WHERE status='programado'`
    - [x] Envía usando el núcleo de `_shared/`
    - [x] Vencidos viejos se envían igual (AC-E2)
    - [x] Segmento vacío → `enviado` con 0, sin reintentar (AC-E3)
    - [x] Rescata los `enviando` con más de 30 min (2 ciclos de cron)
    - [x] `dryRun` opcional para poder verificar sin tocar SMTP

- [x] **T4.2** — Verificar el dispatcher contra la BD de desarrollo
  - **AC ref:** AC6, AC-E2, AC-E3, AC-E4
  - **DoD:**
    - [x] AC-E4 · dos tomas concurrentes del mismo comunicado: exactamente una gana;
          una toma posterior tampoco
    - [x] AC-E2 · el vencido de ayer se despacha, no se saltea
    - [x] AC-E3 · segmento vacío → `enviado` con `recipients_total = 0`
    - [x] Rescate verificado en vivo: el comunicado que el test del candado dejó trabado
          en `enviando` fue rescatado y despachado en la corrida siguiente
    - [x] Autorización · un admin logueado recibe 401 al intentar disparar el dispatcher
    - [x] Datos de verificación limpiados de la BD compartida

  > ### 3 hallazgos que solo aparecieron al correrlo de verdad
  >
  > **1. Comparar la key contra la env var rechazaba al propio cron (401).** La
  > `service_role_key` que el cron saca del vault es el JWT legacy y no coincide con
  > `SUPABASE_SERVICE_ROLE_KEY` del runtime — conviven formatos de key distintos. El
  > arreglo no fue aflojar el control sino moverlo al lugar correcto: se valida el **claim
  > `role`** del token. La autenticidad ya la garantiza el gateway (`verify_jwt` en su
  > default `true`); lo que decide la función es la autorización. Un admin logueado sigue
  > recibiendo 401, verificado.
  >
  > **2. `pg_net` corta a los 5 segundos por defecto.** El primer disparo devolvió
  > `Timeout of 5000 ms` aunque **el trabajo se completó igual** (la función sigue
  > corriendo del lado del servidor). O sea: el cron dispara y olvida, y no puede ver si
  > el envío falló. Para verificar hay que pasar `timeout_milliseconds`. Operativamente
  > implica que **los errores del dispatcher solo se ven en los logs de la función**, no
  > en `net._http_response`.
  >
  > **3. Se enviaron 8 correos reales a dominios inexistentes durante esta verificación.**
  > El dispatcher no aceptaba `dryRun` (correcto para producción) y el comunicado de
  > prueba del candado usaba un segmento que resolvía a 8 alumnos sembrados
  > `@test-data.local` → 8 rebotes duros contra el dominio de la escuela. Corregido en dos
  > frentes: el dispatcher acepta `dryRun` (solo para quien ya pasó el control de rol de
  > servicio), y **la regla para adelante es que todo comunicado de prueba en la BD
  > compartida use un segmento que resuelva a cero**. La re-verificación completa corrió
  > en `dryRun` y las 8 filas quedaron marcadas `send_error='dry_run'`, sin entrega.

## Fase 5 — Facades (TDD)

- [x] **T5.1** — `notification-templates.facade.spec.ts` **primero**, luego la facade
  - **AC ref:** AC1, AC4
  - **DoD:**
    - [x] 11/11 tests: CRUD, SWR, derivación de variables usadas, validación previa
    - [x] Estructura canónica; `setError` + signal de error
    - [x] Documentada en `indices/FACADES.md`

  > **AC4 no necesitó código.** La RLS de `notification_templates` ya rechaza la escritura
  > de secretaría; la facade solo expone ese rechazo como error en vez de simularlo con un
  > `if` de rol, que sería una comprobación que el cliente podría saltear.

- [x] **T5.2** — `AnnouncementsFacade`: `schedule()` y `cancelScheduled()` (tests primero)
  - **AC ref:** AC5, AC8
  - **DoD:**
    - [x] `schedule()` persiste `status='programado'` y **no** invoca la Edge Function (AC5),
          verificado con `expect(invokeSpy).not.toHaveBeenCalled()`
    - [x] Rechaza fecha pasada y fecha ausente sin tocar la BD
    - [x] Guarda los filtros del segmento, no una lista de destinatarios
    - [x] `cancelScheduled()` pasa a `cancelado`; **no borra la fila** (AC8)
    - [x] Cancelar filtra por `status='programado'`: sin eso podría pisar un comunicado que
          el dispatcher ya empezó a despachar y dejarlo a mitad
    - [x] Los 20 tests de 0041-b siguen verdes (26/26 en total)

---

## Fase 6 — UI

- [x] **T6.1** — Gestión de plantillas: `template-manager-drawer.component.ts`
  - **AC ref:** AC1, AC4
  - **DoD:**
    - [x] OnPush; abre desde el tab "Ajustes" del `AjustesDrawerComponent`, gateado a admin
    - [x] Crear, editar, archivar (sin borrar) y eliminar plantillas
    - [x] Ayuda de variables disponibles, clickeables para insertarlas en el cuerpo
    - [x] `data-llm-action` en guardar y eliminar; `ConfirmModalService` antes de borrar
    - [x] La card nueva usa `.card`, no compone el fondo a mano (ARCH-25 sin regresión)

- [x] **T6.2** — Compositor: selector de plantilla + programar
  - **AC ref:** AC2, AC5
  - **DoD:**
    - [x] Selector "Partir de una plantilla…" que carga asunto y cuerpo **editables**
    - [x] Checkbox "Programar para más adelante" con `datetime-local`
    - [x] Fecha pasada deshabilita el envío; el botón cambia a "Programar comunicado"
    - [x] La UI comunica la granularidad real ("± 15 minutos"), no promete precisión al minuto
    - [x] La confirmación avisa que el segmento **se recalcula al enviar**: el alcance que se
          muestra es el de ahora y puede cambiar

- [x] **T6.3** — Historial: estados y cancelar
  - **AC ref:** AC7, AC8
  - **DoD:**
    - [x] Badge de estado para todo lo que no está `enviado`; programados muestran su fecha
    - [x] Acción de cancelar solo con `canCancel` (derivado de `status === 'programado'`)
    - [x] Cancelados atenuados, no ocultos
    - [x] Sigue siendo Dumb: emite `cancelRequested`, la confirmación la hace la página
    - [x] `stopPropagation` en cancelar: sin eso el clic también abría el detalle

- [x] **T6.4** — Registrar íconos nuevos en `app.config.ts`
  - **DoD:**
    - [x] **Sin cambios necesarios**: `file-text`, `calendar-clock`, `pencil`, `trash-2`,
          `plus` y `check` ya estaban registrados. Verificado antes de asumirlo.

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
