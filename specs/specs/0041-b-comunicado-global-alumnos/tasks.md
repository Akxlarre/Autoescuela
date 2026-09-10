# Tasks 0041-b — Comunicado global a alumnos (1:N, email + in-app)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
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

- [x] **T2.1** — Escribir `core/utils/announcement-recipients.utils.spec.ts` **primero**
  - **AC ref:** AC2, AC-E1
  - **DoD:**
    - [x] Armado de lotes: N/tamaño exacto, con resto, lista vacía, N menor que el lote, cobertura sin huecos
    - [x] Validación del draft: sin `kind` (AC2), sin asunto/cuerpo, 0 destinatarios (AC-E1), sobre el tope duro
    - [x] Conteo de excluidos agrupado por motivo
    - [x] Los tests **fallaron** antes de implementar (módulo inexistente), verificado

- [x] **T2.2** — Implementar `core/utils/announcement-recipients.utils.ts`
  - **AC ref:** AC2, AC-E1
  - **DoD:**
    - [x] Funciones puras (data in → data out), sin inyección de Angular
    - [x] 20/20 tests verdes
    - [x] Documentado en `indices/UTILS.md` (auto-generado)

---

## Fase 3 — Edge Function

- [x] **T3.1** — Crear `supabase/functions/send-announcement/index.ts`
  - **AC ref:** AC3, AC4, AC6, AC-E2, AC-E3
  - **DoD:**
    - [x] Copia la estructura de `send-zoom-email` (nodemailer, secrets `SMTP_*`, CORS, `jsonResponse`)
    - [x] Valida auth y que el emisor sea `admin` o `secretary`; secretaría no puede enviar de otra sede
    - [x] **Resuelve los destinatarios server-side** desde `enrollments → students → users`
    - [x] Si `kind = 'promocional'` → filtra por `consents` — AC3
    - [x] Si `kind = 'operativo'` → **no** filtra por consentimiento — AC4
    - [x] Aplica `excludedUserIds`; el lote se toma por `range()` sobre la lista materializada
    - [x] Escapa el cuerpo antes de inyectarlo en el HTML de marca
    - [x] Inserta las notificaciones in-app **aunque el email falle** (AC-E3) y sin email (AC-E2)
    - [x] Upsert idempotente sobre el UNIQUE (no duplica al reintentar)
    - [x] Devuelve `{ recipientsTotal, processed, sent, failed, done }`

  > **Decisión de diseño tomada acá:** los destinatarios se **materializan** en
  > `announcement_recipients` en el primer lote, y los lotes siguientes paginan sobre esa
  > tabla (`ORDER BY id`), no sobre una re-consulta del segmento. Con `OFFSET` sobre una
  > query viva, si alguien revocaba su consentimiento a mitad del envío la lista se
  > encogía y el offset de los lotes siguientes se corría, **salteando destinatarios que
  > sí correspondían**. Además se re-chequea el consentimiento por lote, así que revocar
  > durante el envío sigue excluyendo a esa persona (AC-E4) sin desalinear al resto.

- [x] **T3.2** — Verificar la Edge Function contra la BD de desarrollo
  - **AC ref:** AC3, AC4, AC6, AC8, AC-E4
  - **DoD:** 13/13 checks en verde, todo en `dryRun` (cero correos enviados).
    - [x] AC4 · operativo alcanza al segmento completo (8/8), sin filtrar por consentimiento
    - [x] AC3 · promocional alcanza solo a los 2 que consintieron, y son exactamente esos
    - [x] AC-E4 · revocar entre el preview y la confirmación excluye de verdad (2 → 1)
    - [x] AC6 · una notificación in-app por destinatario
    - [x] AC8 · secretaría no puede crear comunicado de otra sede (403 por RLS)
    - [x] AC8 · secretaría no puede crear comunicado multi-sede (`branch_id NULL` → 403)
    - [x] Reintentar el lote no duplica filas, ni notificaciones, ni entregas
    - [x] Datos de verificación limpiados de la BD compartida

  > **Bloqueador resuelto con modo dry-run.** Los 200 alumnos de la BD de desarrollo tienen
  > email `@test-data.local` (TLD inexistente): un envío de prueba habrían sido ~200 rebotes
  > duros contra el dominio de la escuela — el mismo daño de reputación que §9.4 marca como
  > riesgo principal y que este feature existe para evitar. `dryRun` corre la resolución, el
  > filtro de consentimiento, la materialización y las notificaciones in-app, y solo saltea
  > la entrega SMTP. Queda en la función: sirve para el mismo problema en el futuro.
  >
  > **Bug real encontrado por esta verificación (no por revisión de código):** la primera
  > corrida dio 16 notificaciones para 8 destinatarios. El `UNIQUE (announcement_id, user_id)`
  > protegía las filas de `announcement_recipients`, pero el INSERT en `notifications` corría
  > igual en cada reintento — y por la misma razón el correo se habría reenviado a quien ya
  > lo recibió. Un reintento por corte de red le habría duplicado el comunicado a cientos de
  > alumnos. Corregido: se saltea a quien ya tiene `email_sent_ok`, y la notificación se crea
  > solo si la fila todavía no tiene `notification_id`. **Reintentar reanuda, no reenvía.**

  > ⚠️ **Pendiente para producción:** el envío SMTP real nunca se ejercitó. Antes del
  > despliegue hace falta un smoke test con una casilla real (uno o dos destinatarios) para
  > confirmar que el correo sale y se ve bien en un cliente de verdad.

---

## Fase 4 — Capa Facade (TDD)

- [x] **T4.1** — Escribir `core/facades/announcements.facade.spec.ts` **primero**
  - **AC ref:** AC1, AC5, AC7, AC-E3
  - **DoD:**
    - [x] `send()` inserta el announcement, itera lotes (offsets 0/25/50) y actualiza `progress`
    - [x] Fallo parcial de un lote no aborta el resto y acumula `failed` (AC-E3)
    - [x] Historial SWR: primera carga con skeleton, segunda sin, pero igual refresca
    - [x] El body del lote lleva SOLO `announcementId`/`offset`/`batchSize` — nunca destinatarios
    - [x] Los tests fallaron antes de implementar

  > **Dos tests se reescribieron por vacuos.** El de SWR miraba `isLoading()` *después*
  > del `await`, donde siempre es `false`: pasaba igual con SWR roto. Ahora se mira antes
  > de esperar la promesa. El de "no manda destinatarios" afirmaba `not.toHaveProperty`
  > sobre dos nombres inventados; ahora afirma el set exacto de claves del body, que sí
  > falla si alguien agrega una lista. Un test que no puede fallar da confianza falsa.

- [x] **T4.2** — Implementar `core/facades/announcements.facade.ts`
  - **AC ref:** AC1, AC5, AC7, AC-E3
  - **DoD:**
    - [x] Estructura: estado privado → público readonly → métodos
    - [x] Inyecta `BranchFacade`; `createRequestGuard()` en el fetch del historial
    - [x] SWR: `initialize()` + `refreshSilently()` + flag `initialized`
    - [x] Errores capturados vía `ErrorSanitizerService` y expuestos en el signal `error`
    - [x] Orquestación por lotes de 25 con `progress` signal
    - [x] 13/13 tests verdes
    - [x] Documentado en `indices/FACADES.md` (auto-generado)

---

## Fase 5 — Capa UI

- [x] **T5.1** — Compositor `features/comunicados/announcement-composer-drawer.component.ts`
  - **AC ref:** AC1, AC2, AC5, AC6, AC-E1
  - **DoD:**
    - [x] OnPush, inyecta `AnnouncementsFacade`
    - [x] Selector de `kind` obligatorio **sin default** — verificado en browser: abre en "Elegí el tipo…" (AC2)
    - [x] Filtros de segmento con lista resuelta y conteo — verificado: 62 destinatarios reales (AC1)
    - [x] Destilde de destinatarios puntuales (AC5) — 62 checkboxes funcionales
    - [x] Muestra excluidos por consentimiento con su motivo (AC3)
    - [x] Redacción (asunto + cuerpo texto plano)
    - [x] Botón con `data-llm-action="enviar-comunicado"`, deshabilitado si el draft es inválido
    - [x] `ConfirmModalService` antes de enviar (acción irreversible y masiva)
    - [x] Barra de progreso durante el envío
    - [x] Advertencia sobre 200 destinatarios; bloqueo sobre 500
    - [x] Tokens semánticos, `.card`, `<app-icon>` — `lint:arch` exit 0

  > **Nota sobre `<p-paginator>`:** el plan lo preveía para listas largas. Con el tope duro
  > de 500 y la lista dentro de un `max-h-56 overflow-y-auto`, el scroll interno alcanza y
  > agregar paginación sería complejidad sin problema que resolver. Si el tope sube, revisar.

- [x] **T5.2** — Historial `shared/components/announcements-content/announcements-content.component.ts`
  - **AC ref:** AC7
  - **DoD:**
    - [x] Dumb: solo `input()` / `output()`, sin inyectar Facades
    - [x] Lista de comunicados con asunto, tipo, emisor, sede, fecha y contadores
    - [x] Badges de estado (`promocional`/`operativo`, sin entregar, envío incompleto)
    - [x] Skeleton **dentro** del componente con `<app-skeleton-block>`
    - [x] `<app-empty-state>` centrado en wrapper `flex-1 flex items-center justify-center`
    - [x] Sin `computed()` con lógica derivada → sin tests propios (regla `testing-tdd.md`: se testean decisiones, no bindings)
    - [x] Documentado en `indices/COMPONENTS.md` (auto-generado)

  > El detalle por destinatario que preveía el plan quedó fuera: requiere una vista de
  > drill-down que ningún AC pide. `announcement_recipients` ya guarda el dato, así que
  > construirla después no cuesta nada. AC7 se cumple con los contadores por comunicado.

- [x] **T5.3** — Registrar íconos nuevos en `app.config.ts`
  - **DoD:**
    - [x] `Megaphone` importado y registrado en `provideIcons()` — era el único ícono nuevo realmente usado
    - [x] Sin íconos registrados de más (el resto del compositor reutiliza íconos ya registrados)

---

## Fase 6 — Conexión

- [x] **T6.1** — Conectar en `secretaria-observaciones.component.ts`
- [x] **T6.2** — Conectar en `admin-tareas.component.ts`
  - **AC ref:** AC1, AC7, AC8
  - **DoD:**
    - [x] `<app-tabs variant="line">` a nivel página: "Tareas del equipo" / "Comunicados a alumnos"
    - [x] Acción de hero "Nuevo comunicado" que abre el compositor vía `LayoutDrawerFacadeService`
    - [x] `features/instructor/tareas/` NO se tocó
    - [x] El historial se carga recién al abrir su pestaña (la mayoría de las visitas son por tareas)

  > **La fila de tabs necesitaba cambiar el modificador del grid, no SCSS nuevo.**
  > `--fill-screen` define `grid-template-rows: auto minmax(0,1fr)` — hero + celda que
  > llena. Meter una fila de tabs ahí rompe el cálculo de 100vh. `--fill-screen-kpi` ya
  > existe con `auto auto minmax(0,1fr)` (hero + fila corta + fill), que es exactamente
  > esta forma, y además evita el shift de tabs por el scrollbar de Windows (spec 0031).

- [x] **T6.3** — Animación de entrada
  - **DoD:**
    - [x] `animateBentoGrid()` sigue funcionando con la estructura nueva
    - [x] Sin `@angular/animations` ni `@keyframes`

---

## Fase 7 — Validación

- [x] **T7.1** — `npm run lint:arch` limpio
  - **DoD:** exit 0, sin regresión de ratchet (ARCH-25 en su baseline)

  > **ARCH-12 real encontrado acá:** el compositor importaba `AnnouncementKind` desde
  > `dto/`, y la regla prohíbe que un componente toque el DTO crudo. Se resolvió como ya
  > lo hace `ui/consent.model.ts` con `ConsentType`: el modelo de UI re-exporta el tipo.
  > El tipo es vocabulario de dominio, no la forma de una fila, así que re-exportarlo no
  > lava la violación — evita duplicar la unión en dos archivos.

- [x] **T7.2** — `npm run test:ci` verde
  - **DoD:** 2389 passed, 5 skipped, exit 0 (40 tests nuevos de esta spec)
- [x] **T7.3** — `npx ng build` sin errores
  - **DoD:** exit 0. Encontró dos errores que vitest no ve: `SectionHeroAction.primary`
    es obligatorio, y faltaba declarar los componentes nuevos en el `imports` de admin.
- [x] **T7.4** — QA manual en browser
  - **DoD:** como `secretaria@test.com`, contra la BD de desarrollo real:
    - [x] Tabs "Tareas del equipo" / "Comunicados a alumnos" y acción "Nuevo comunicado"
    - [x] AC2 · el compositor abre sin tipo elegido ("Elegí el tipo…")
    - [x] AC1 · operativo resuelve **62 destinatarios** (coincide con el SQL del segmento)
    - [x] AC3 · al pasar a promocional cae a **0**, con "62 alumno(s) … quedan fuera por no
          tener consentimiento promocional vigente" y badge "Sin consentimiento" por fila
    - [x] AC-E1 · con 0 destinatarios el botón de envío queda deshabilitado
    - [x] AC8 · no aparece el selector de Sede para secretaría
    - [x] Camino feliz: operativo + asunto + cuerpo → botón habilitado
    - [x] Historial vacío se ve centrado, con el ícono `megaphone` bien registrado

  > **No se ejecutó un envío real desde la UI, a propósito.** El compositor no pasa
  > `dryRun` (correcto: en producción tiene que enviar de verdad), así que apretar
  > "Enviar" habría disparado 62 correos a `@test-data.local` y otros tantos rebotes
  > contra el dominio de la escuela. La verificación del envío ya se hizo en T3.2 en
  > dry-run contra la Edge Function real.

- [x] **T7.5** — Verificación server-side de RLS
  - **DoD:** cubierto en T3.2 — secretaría recibe 403 al intentar crear un comunicado de
    otra sede y al intentar uno multi-sede (`branch_id NULL`)
- [x] **T7.6** — `/spec-verify` → [`acceptance.md`](./acceptance.md) con evidencia por AC (12/12 ✅ PASA)

## Fase 8 — Cierre

- [x] **T8.1** — Sincronizar `indices/`
  - **DoD:**
    - [x] `npm run indices:sync` corrido (DATABASE, MODELS, UTILS, FACADES, COMPONENTS, USAGE-MAP, STYLES)
    - [x] `indices/NOTIFICATIONS-MAP.md` §9.4 — el comunicado global pasó de "sin
          implementar" a implementado, con la salvedad del smoke test SMTP pendiente
- [x] **T8.2** — Mover la spec a Done en `specs/ROADMAP.md`
- [x] **T8.3** — `status: done` en `spec.md` y limpiar `specs/.active`

## Tareas descubiertas durante implementación

> Dentro del scope de la spec → agregar acá. Fuera de scope → spec nueva.

- [ ] …
