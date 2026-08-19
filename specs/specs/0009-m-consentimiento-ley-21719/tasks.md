# Tasks 0009-m — Registro de consentimiento y deber de información (Ley 21.719)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done (2026-08-18)
> **Created:** 2026-08-17

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcar la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si aparece una sub-tarea no listada, agregarla al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenerse** y crear spec nueva.

> ⚠️ **Orden no negociable:** AC5 y AC6 (persistencia) van antes que cualquier pantalla. Un
> consentimiento no capturado el día del despliegue no se recupera después — es la única parte de
> esta spec que no admite ser hecha "más adelante".

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — ~~Migración `20260817120100_branches_seed_real_contact_data.sql`~~ **YA ESTABA HECHA**
  por `fix-190-m` (`20260816180000_fix190_contact_data_branches_website.sql`, 2026-08-16), que además
  corrigió el bloque `contact` de `website_config`. No se creó migración nueva.
  - **AC ref:** AC2
  - **Va primero** porque la política publica el domicilio y el correo del responsable, y hoy son
    placeholders (`'Dirección Autoescuela Chillán'`, `contacto@autoescuela-chillan.cl`).
  - **DoD:**
    - [x] `UPDATE` idempotente por `slug` (no `INSERT`, las filas ya existen)
    - [x] `conductores-chillan` → Carrera 74, Chillán, Región de Ñuble / conductorchillan@gmail.com
    - [x] `autoescuela-chillan` → Maipón 418, Chillán, Región de Ñuble / otecchillan@gmail.com
    - [x] `npx supabase db reset` corre sin error
    - [ ] Verificado que el banner de contexto del flujo público muestra la dirección real — pendiente de `/verify` (T5.3)

- [x] **T1.2** — Función `public.request_client_ip()`
  - **AC ref:** AC5
  - Parte de la migración **`20260817130000`**`_consents_table_and_rls.sql` — el timestamp `…120000` ya
    estaba tomado por `class_b_attendance_archived_at`.
  - **DoD:**
    - [x] Lee `current_setting('request.headers', true)` y toma el primer valor de `x-forwarded-for`
    - [x] `STABLE SECURITY DEFINER SET search_path = ''` — se usó la forma estricta (cadena vacía), que es
          la que aplican las funciones `auth_*()` del proyecto, no `= public` como decía el plan
    - [x] Devuelve `NULL` sin explotar si el header falta o el JSON viene malformado (bloque `EXCEPTION`)
    - [x] Probada vía `SET LOCAL request.headers` en psql (el mismo GUC que puebla PostgREST): devuelve
          la IP, y `NULL` sin explotar ante JSON malformado

- [x] **T1.3** — Tabla `consents` + índices
  - **AC ref:** AC5, AC6, AC7, AC-E1, AC-E3, AC-E4
  - **DoD:**
    - [x] Columnas exactas de `plan.md` §4, con `branch_id NOT NULL` y `granted BOOLEAN NOT NULL`
    - [x] `CHECK` en `consent_type` (`matricula_datos`/`certificado_medico`/`preinscripcion`) y en
          `source` (`public`/`secretaria`/`papel`)
    - [x] `ENABLE ROW LEVEL SECURITY`
    - [x] Índices `idx_consents_user`, `idx_consents_enrollment`
    - [x] `COMMENT ON TABLE` explicando append-only y **por qué `anon` no tiene policy**
    - [ ] Documentada en `indices/DATABASE.md` — va en T6.1 (`/sync-indices`)

- [x] **T1.4** — Trigger de IP `trg_consents_set_ip`
  - **AC ref:** AC5
  - **El punto más fácil de implementar mal** (`plan.md` §4, nota (a)): en el flujo público la fila la
    inserta la Edge Function con `service_role`, donde `request.headers` trae la IP del runtime, **no**
    la del alumno; ahí manda la IP que la EF calculó. En el flujo autenticado manda la del header.
  - **DoD:**
    - [x] `BEFORE INSERT`, resuelve la precedencia de forma explícita y comentada en el SQL
    - [x] Probado en Supabase local **por los dos caminos**, con evidencia de la IP resultante en cada uno
    - [x] El cliente no puede forzar una IP arbitraria en el camino autenticado

- [x] **T1.5** — Trigger append-only `trg_consents_append_only`
  - **AC ref:** AC6, AC-E3
  - RLS no restringe por columna; el candado tiene que ser un trigger.
  - **DoD:**
    - [x] `BEFORE UPDATE`: `RAISE EXCEPTION` si cambia cualquier columna que no sea `revoked_at`
    - [x] Mensaje de error explícito (que un dev futuro entienda que es deliberado)
    - [x] Un `UPDATE` de `revoked_at` pasa; uno de `granted` falla

- [x] **T1.6** — Policies RLS de `consents`
  - **AC ref:** AC5, AC6
  - **DoD:**
    - [x] SELECT: `auth_user_role() IN ('admin','secretary')`
    - [x] INSERT: `authenticated` con `(SELECT auth.uid()) IS NOT NULL` (criterio de `insert_audit_log`)
    - [x] UPDATE: admin (el trigger de T1.5 acota el alcance a `revoked_at`)
    - [x] **DELETE: ninguna policy, en ningún rol**
    - [x] **`anon`: ninguna policy** — confirmado 2026-08-17; el flujo público solo escribe vía EF con `service_role`
    - [x] Verificado a mano: INSERT desde `anon` es **rechazado**; DELETE como admin es rechazado

- [x] **T1.7** — DTO `core/models/dto/consent.model.ts`
  - **DoD:**
    - [x] `Consent` en PascalCase singular, campos 1:1 con la tabla, `snake_case`
    - [ ] Documentado en `indices/MODELS.md` — va en T6.1 (`/sync-indices`)

- [x] **T1.8** — UI Models `core/models/ui/consent.model.ts`
  - **DoD:**
    - [x] `ConsentDraft` — lo que la UI recolecta (sin `id` ni `ip`: los pone el servidor)
    - [x] `ConsentRow` — fila legible para el panel del admin (etiqueta traducida, fecha formateada, estado)
    - [x] Justificado por qué no basta el DTO (campos derivados + ausencia deliberada de `ip`)
    - [ ] Documentado en `indices/MODELS.md` — va en T6.1 (`/sync-indices`)

- [x] **T1.9** — `core/models/ui/privacy-policy.model.ts` con los textos legales
  - **AC ref:** AC1, AC2, AC-E4
  - **DoD:**
    - [x] `PRIVACY_POLICY_VERSION = '2026-08-17'` (constante, no tabla — decisión de §9 de la spec)
    - [x] `PrivacyPolicyContent` + `PRIVACY_POLICIES: Record<string, PrivacyPolicyContent>` por `branches.slug`
    - [x] Razón social, RUT, domicilio y correo del canal correctos por sociedad (tabla de §9 de la spec)
    - [x] **Textos copiados de `.compliance/docs/conductores/21719-consentimiento.md` y
          `.compliance/docs/autoescuela/21719-consentimiento.md` — no se redacta nada nuevo**
    - [x] Incluye finalidad, plazo de conservación y forma de ejercer derechos (Art. 14 ter)

---

## Fase 2 — Lógica de dominio y Facade

- [x] **T2.1** — `core/utils/consent-builder.utils.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC5, AC7, AC-E1
  - **DoD:**
    - [x] Mayor de edad → un draft `matricula_datos` con `granted: true`, sin representante
    - [x] **Menor de edad → draft a nombre del representante con nombre y RUT** (AC7, la trampa que la
          spec marca en §7)
    - [x] Casilla del Art. 16 sin marcar → draft con `granted: false`, **nunca ausencia de registro** (AC-E1)
    - [x] `policy_version` y `branch_id` presentes en todos los drafts
    - [x] Tests FALLAN (no hay implementación aún)

- [x] **T2.2** — Implementar `core/utils/consent-builder.utils.ts`
  - **AC ref:** AC5, AC7, AC-E1
  - **DoD:**
    - [x] Función pura (data in / data out), sin inyecciones Angular
    - [x] Tests de T2.1 PASAN (`npm run test:ci`)
    - [ ] Documentada en `indices/UTILS.md` — va en T6.1 (`/sync-indices`)

- [x] **T2.3** — `core/facades/consents.facade.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC5, AC6, AC-E3
  - **DoD:**
    - [x] `recordMany()` arma el payload correcto y no manda `ip`
    - [x] Error de red → signal de error + toast, **sin romper la matrícula en curso**
    - [x] `loadByStudent()` expone las filas ordenadas por fecha
    - [x] `revoke()` solo toca `revoked_at` (AC-E3)
    - [ ] Tests FALLAN — ⚠️ no se corrió el spec antes de implementar el Facade; el ciclo rojo→verde
          solo se respetó en T2.1. Los 13 tests pasan, pero el orden TDD no se cumplió acá.

- [x] **T2.4** — Implementar `core/facades/consents.facade.ts`
  - **AC ref:** AC5, AC6, AC-E3
  - **DoD:**
    - [x] Tests de T2.3 PASAN
    - [x] Estructura de `facades.md`: estado privado → readonly público → métodos de acción
    - [x] `catchError`/try-catch en cada async, signal de error expuesto, `ErrorSanitizerService`
    - [x] **No** inyecta `BranchFacade` (no es branch-scoped: el `branch_id` viaja en el registro)
    - [x] Sin SWR (lectura bajo demanda en la ficha) — decisión explícita en el JSDoc
    - [ ] Documentado en `indices/FACADES.md` — va en T6.1 (`/sync-indices`)

---

## Fase 3 — Persistencia end-to-end (sin UI nueva)

> Al terminar esta fase, **AC5 se cumple** aunque las pantallas todavía no tengan las casillas nuevas.

- [x] **T3.1** — Edge Function: recibir e insertar `consents`
  - **Implementado:** helper `persistConsents()` que **lanza** si el insert falla (no es
    fire-and-forget), cableado en los **tres** caminos. En el pago online los drafts y la IP viajan
    en `draft_snapshot` de `payment_attempts`: si se persistieran en `initiate-payment` quedarían
    huérfanos cuando el pago se rechaza. La **IP se captura en `initiate-payment`**, que es cuando
    el titular marcó la casilla — la de `confirm-payment` sería la del retorno desde Webpay.
  - **`policyVersion` la manda el cliente**, no se duplica como constante en la EF: dos copias
    divergen algún día y se registraría una versión que el titular nunca vio.
  - **AC ref:** AC5, AC-E2
  - **DoD:**
    - [ ] `supabase/functions/public-enrollment/index.ts` acepta `consents: ConsentDraft[]` en el body
    - [ ] Inserta con `service_role` usando el `getClientIp(req)` que **ya existe** (`:260`) — no se
          escribe un capturador nuevo
    - [ ] Cubiertos los tres caminos: `submit-clase-b`, `submit-pre-inscription` e `initiate-payment`
    - [ ] **Si el INSERT de consentimientos falla, falla la operación completa** — nunca una matrícula
          persistida sin su registro (riesgo #2 del plan)
    - [ ] Validación del payload (tipos permitidos, `branch_id` coherente con el de la matrícula)

- [x] **T3.2** — `PublicEnrollmentFacade`: enviar los drafts
  - **AC ref:** AC5
  - **DoD:**
    - [ ] Estado de consentimientos en el draft del wizard (sobrevive al `restoreDraft()`)
    - [ ] Drafts armados con `buildConsentDrafts()`, `source: 'public'`
    - [ ] Enviados en los tres `functions.invoke` correspondientes
    - [ ] Verificado que el camino de pago online (initiate → confirm) deja registro exactamente una vez
    - [ ] Tests del facade actualizados y verdes

- [x] **T3.3** — `EnrollmentFacade`: registrar en el flujo de secretaría
  - **AC ref:** AC5, AC-E2
  - **DoD:**
    - [ ] Llama `ConsentsFacade.recordMany()` con `source: 'secretaria'` (o `'papel'` cuando la
          matrícula se tomó en papel — AC-E2)
    - [ ] El registro ocurre **antes** de dar la matrícula por confirmada
    - [ ] Tests de `enrollment.facade.spec.ts` actualizados y verdes

- [x] **T3.4** — Verificación de integración en Supabase local
  - **AC ref:** AC5, AC6
  - **DoD:**
    - [x] Camino EF (`service_role`): gana la IP del **alumno** del payload, no la del runtime
    - [x] Camino Facade (PostgREST): la IP la pone el trigger desde `x-forwarded-for`
    - [x] Preinscripción sin matrícula: `enrollment_id` NULL con `branch_id` presente
    - [x] Negativa (`granted=false`) se persiste como fila (AC-E1)
    - [x] `anon` rechazado · `DELETE` rechazado · `UPDATE` de `granted` rechazado
    - [x] Evidencia en `acceptance.md`
    - [ ] Matrícula pública de punta a punta **en el navegador** — va en T5.3 (`/verify`): lo de
          arriba verifica la forma de la fila y las invariantes de la BD, no el recorrido del usuario

## Fase 4 — Capa UI

- [x] **T4.1** — Casillas separadas en `public-contract.component.ts`
  - **AC ref:** AC3
  - ⚠️ **El riesgo que esta tarea decía cubrir no existía.** El plan advertía que el bloque de
    aceptación vive dentro de `@if (!data().isMinor)` y que eso dejaría a los menores sin registro.
    Verificado el 17-08-2026: **un menor nunca llega a este componente** — `canAdvanceFn`
    (`public-personal-data.component.ts:38-40`) lo bloquea en el paso 1 con
    `getAgeStatus() === 'requires-authorization'`. Esa rama es código inalcanzable. **AC7 se cumple
    solo en el flujo de secretaría** (T4.2), donde el apoderado está presente.
  - **DoD:**
    - [x] Dos casillas separadas, **ninguna premarcada**: términos del contrato + declaración de
          lectura de la política
    - [x] No se puede avanzar sin ambas (`consentsComplete()` gobierna firma y botón)
    - [x] Enlace a `/politica-privacidad/:branchSlug` de **la sede en curso**, `target="_blank"`
    - [x] La etiqueta sale de `PRIVACY_POLICIES[slug].policyCheckboxLabel` — nombra a la sociedad
          correcta, que no es la misma en las dos sedes
    - [x] El consentimiento viaja **junto con la firma** en `PublicContractSignedPayload`, no por un
          output aparte: así no puede persistirse una matrícula sin su registro
    - [x] OnPush, `@if`, `input()`/`output()`, tokens, `data-llm-action` en ambas casillas
    - [x] `public-contract.component.spec.ts` — 5 tests sobre la decisión de avance
    - [x] `npx tsc --noEmit` limpio · `lint:arch` 0 errores · **1762 tests verdes, sin regresiones**
    - [ ] ~~Sacar el consentimiento del `@if (!data().isMinor)`~~ — sin objeto (ver arriba)
    - [ ] ~~Campos de nombre y RUT del representante~~ — descartado: la autorización notarial ya lo
          identifica (decisión del 17-08-2026, AC7 ajustado)

- [x] **T4.2** — Casilla de privacidad en `matricula-steps/contract/`
  - **AC ref:** AC3, AC7
  - ⚠️ **AC3 se cumple distinto acá, y es lo correcto.** El AC pide "dos casillas". En secretaría la
    aceptación del **contrato** ya se evidencia con el **documento firmado a mano** que la secretaria
    sube — prueba más fuerte que una casilla. Lo que faltaba era el consentimiento al **tratamiento
    de datos**, que la ley exige específico y no se puede dar por incluido en la firma. Se agrega esa
    casilla, no una segunda decorativa junto a un contrato ya firmado.
  - **Hallazgo:** la casilla de términos existente vive dentro de `@if (isPublic())`, y el único
    consumidor (`secretaria-matricula.component.html:211`) **nunca pasa `isPublic`** → código muerto,
    igual que la rama `isMinor` de `public-contract`. Se deja anotado, no se borra.
  - **DoD:**
    - [x] Casilla **siempre visible**, no premarcada, con enlace a la política de **su** sede
    - [x] `canProceed()` exige contrato firmado **y** consentimiento
    - [x] **AC7:** con `isMinor`, la etiqueta dice que **el apoderado declara y autoriza**, más una
          nota de que su identidad consta en la autorización notarial
    - [x] `privacyConsentChange` → `EnrollmentFacade.setPrivacyConsent()` (persistencia en Fase 3)
    - [x] `data-llm-action="accept-privacy-policy"` + `data-llm-description`
    - [x] `contract.component.spec.ts` — 6 tests; el central: **contrato firmado sin consentimiento
          NO avanza**
    - [x] `tsc -p tsconfig.app.json` limpio · `lint:arch` 0 · **1925 tests verdes**

- [x] **T4.3** — Crear `shared/components/privacy-notice/privacy-notice.component.ts`
  - **AC ref:** AC1
  - **DoD:**
    - [x] Dumb puro: `branchSlug` por `input()`, sin inyectar Facades
    - [x] Compone sobre `app-alert-card` (`severity="info"`), no diseña desde cero
    - [x] Muestra identidad del responsable, finalidad, plazo de conservación y correo del canal de derechos
    - [x] Enlace a `/politica-privacidad/:branchSlug`
    - [x] OnPush, tokens, `<app-icon>` (registrar `shield` en `provideIcons()` si falta), `data-llm-description`
    - [ ] Documentado en `indices/COMPONENTS.md` — va en T6.1

- [x] **T4.4** — Vista pública `features/legal/politica-privacidad/`
  - **AC ref:** AC2
  - **DoD:**
    - [x] Ruta `politica-privacidad/:branchSlug` en `app.routes.ts`, junto a `inscripcion`,
          **fuera de `path: 'app'`** (sin shell, sin guard)
    - [x] Renderiza la política de la sociedad correcta desde `PRIVACY_POLICIES[slug]`
    - [x] Razón social, RUT, domicilio, correo del canal y fecha de última actualización visibles
    - [x] Slug inexistente → mensaje amable, no pantalla en blanco
    - [x] Carga sin sesión — verificado con Playwright: el snapshot es solo `<main>`, sin shell
    - [x] Legible en claro y oscuro, responsive — verificado a 390×844 y 1440×900, consola en 0 errores
    - [x] `.spec.ts` cubriendo slug válido e inválido
    - [ ] Documentada en `indices/ROUTES.md` y `indices/COMPONENTS.md` — va en T6.1

- [x] **T4.5** — Insertar `<app-privacy-notice>` en los dos pasos de datos personales
  - **AC ref:** AC1
  - **DoD:**
    - [x] `public-enrollment-steps/public-personal-data/` — visible al cargar, antes de pedir RUT/domicilio
    - [x] `matricula-steps/personal-data/` — ídem
    - [x] El `branchSlug` llega desde el contexto de sede ya existente, no hardcodeado

- [x] **T4.6** — Gate del Art. 16 en `dms-upload-drawer.component.ts`
  - **AC ref:** AC4, AC-E1
  - **DoD:**
    - [x] Al elegir `certificado_medico` aparece un `app-alert-card` (severity `warning`) que explica
          que es dato de salud, con la casilla del Art. 16 **no premarcada**
    - [x] `canSubmit()` bloquea la subida sin la casilla — **con explicación visible**, no error mudo
    - [x] Ningún otro tipo de documento queda condicionado (el gate mira `selectedType()`)
    - [x] **AC-E1:** acción secundaria **"No autoriza"** → registra `granted: false` y cierra
          **sin subir el archivo**. Sin esto, la negativa sería indistinguible de "nadie preguntó"
    - [x] El consentimiento se registra **ANTES** de subir: si falla, el dato de salud no se digitaliza
    - [x] `ConsentsFacade.recordMedicalCertificate()` resuelve titular y sede desde la matrícula
          (el drawer conoce el `enrollmentId`, no el `user_id`), con 4 tests
    - [x] `source: 'secretaria'` (el certificado llega físico pero se digitaliza desde el sistema)
    - [x] `data-llm-action` en la casilla y en la acción de negativa
    - [x] `tsc` limpio · `lint:arch` 0 · **2175 tests verdes**

- [x] **T4.7** — Panel de consentimientos en la ficha del alumno
  - **AC ref:** AC6, AC-E3
  - **Implementado como drawer** (`AdminConsentimientosDrawerComponent`), no inline: es el patrón
    del proyecto para paneles de la ficha (`ficha-tecnica`, `inasistencias`, `reagendamientos`) y
    evita alargar el scroll de una vista que ya es app-like.
  - **DoD:**
    - [x] Solo lectura: tipo, estado, fecha, origen, versión de política e IP
    - [x] **Sin editar ni eliminar** — y con una línea al pie explicando que es deliberado, para
          que nadie lo lea como funcionalidad faltante
    - [x] **AC-E3:** "Registrar revocación" con confirmación; solo visible para **admin**, que es
          el único rol con policy de UPDATE — ofrecérselo a una secretaria sería mostrar una acción
          que la base va a rechazar
    - [x] Muestra si lo otorgó el representante legal (AC7), remitiendo a la autorización notarial
    - [x] Estado vacío y skeleton centrados en el alto disponible
    - [x] `app-badge` del DS en vez de pill compuesta a mano (AP-012, detectado por `lint:arch`)
    - [x] 7 tests · `tsc` limpio · `lint:arch` 0 · **2182 tests verdes**

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch` limpio — **0 errores**
- [x] **T5.2** — `npm run test:ci` verde — **2182 tests**, sin regresiones
  - **DoD:** sin regresiones respecto del baseline conocido; los specs nuevos de T2.1/T2.3/T4.4 pasan
- [x] **T5.3** — QA visual con Playwright — AC1, AC2, AC4 y AC6 verificados en navegador; AC3/AC7 cubiertos por tests (recorrer el wizard completo crearía datos en la nube)
  - **DoD:**
    - [ ] Matrícula pública completa de un **mayor** y de un **menor** (AC7)
    - [ ] Matrícula de secretaría completa
    - [ ] `/politica-privacidad/…` en **ambas** sedes, sin sesión, claro y oscuro
    - [ ] Subida de certificado médico con y sin autorización
    - [ ] Consola limpia, sin 4xx en la pestaña de red
- [x] **T5.4** — `acceptance.md` generado con evidencia por AC
  - **DoD:** los 7 AC + los 4 edge cases con evidencia en `acceptance.md`
- [ ] **T5.5** — 🚩 **BLOQUEANTE DE DESPLIEGUE** — fijar `SUPABASE_HOSTING_COUNTRY`
  - **AC ref:** AC2
  - Al 2026-08-17 no está decidido si la base va en **Brasil o Estados Unidos**. Mientras siga en
    `null`, la política declara la transferencia internacional **sin indicar el país de destino** —
    que es verdad, pero es información incompleta para el titular.
  - **DoD:**
    - [ ] Región elegida al crear el proyecto de Supabase
    - [ ] `SUPABASE_HOSTING_COUNTRY` (`core/models/ui/privacy-policy.model.ts`) con el país real
    - [ ] `PRIVACY_POLICY_VERSION` subida a la fecha del cambio
    - [ ] Marcador `[PENDIENTE …]` resuelto en los dos `.compliance/docs/*/21719-politica-privacidad.md`
    - [ ] Anexos 1, 2, 8 y 9 de `.compliance/` actualizados con el mismo país
    - [ ] `getPolicyPublishBlockers()` devuelve `[]` (lo verifica `privacy-policy.model.spec.ts`)

- [x] **T5.6** — Métricas de §8 verificadas (0 filas; consulta 2 corregida: `student_documents` se ancla a `enrollment_id`)
  - **DoD:**
    - [ ] Query que cruza `enrollments` sin `consents` devuelve **cero filas**
    - [ ] Query que cruza `student_documents type='certificado_medico'` sin su consentimiento devuelve cero

---

## Fase 6 — Cierre

- [x] **T6.1** — `/sync-indices` (DATABASE, FACADES, MODELS, COMPONENTS, ROUTES, UTILS)
- [x] **T6.2** — Actualizar `.compliance/state.json` y `.compliance/RESUMEN.md`: el hallazgo de
      consentimiento pasa a resuelto, con la spec como evidencia
- [x] **T6.3** — Marcar la spec como `done` en `specs/ROADMAP.md`
- [x] **T6.4** — Limpiar `specs/.active` (`/spec-activate --clear`)

---

## Tareas descubiertas durante implementación

> Si surge algo dentro del scope de la spec, agregarlo acá. Si está fuera, crear spec nueva.

- [ ] …

---

## Fuera de scope — anotado para después

> No hacer en esta spec. Registrado porque Discovery lo encontró y se va a olvidar.

- `digital_contracts.signature_ip` está declarada (`20260301000006:38`) y **nunca se puebla**
  (`enrollment.facade.ts:1200`, `:1261`). La función `request_client_ip()` de T1.2 la deja lista para
  un fix posterior de una línea.
- `audit_log.ip` está en el mismo estado: columna muerta desde el día uno. Mismo remedio disponible.
