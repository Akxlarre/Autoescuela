# Plan 0009-m — Registro de consentimiento y deber de información (Ley 21.719)

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-08-17
> **Talla:** **L** — ⚠️ **Revisar este plan antes de implementar.** Tabla nueva con RLS append-only,
> Facade nuevo, ruta pública nueva fuera del shell, cambios en 5 componentes y en la Edge Function
> `public-enrollment`. Estimado > 3 días.

---

## 1. Resumen ejecutivo

Se crea la tabla `consents` (append-only, con IP capturada **server-side**) y un `ConsentsFacade` que
la alimenta desde los dos flujos de matrícula. La UI suma: un aviso del Art. 14 ter en los pasos de
datos personales, una segunda casilla independiente en los pasos de contrato, una ruta pública
`/politica-privacidad/:branchSlug` con la política de cada sociedad, y un gate de autorización
expresa del Art. 16 en el punto donde el certificado médico realmente se sube (el DMS). Orden grueso:
migración → modelos/constantes → Facade + tests → Edge Function → UI.

### ⚠️ Correcciones a la spec detectadas en Discovery

Dos ACs de la spec parten de premisas que el código desmiente. Se corrigen en `spec.md` como parte de
este plan (ver Changelog de la spec), no se implementan como estaban escritos:

1. **AC4 — el certificado médico no se sube en ningún flujo de matrícula.** `DocumentType`
   (`core/models/ui/enrollment-documents.model.ts:21-25`) solo contempla `hoja_vida_conductor`,
   `cedula_identidad`, `licencia_conducir` y `autorizacion_notarial`; el paso público solo sube
   `id_photo`. El único punto de entrada real de un `certificado_medico` es
   `features/admin/documentos/dms-upload-drawer/dms-upload-drawer.component.ts:331`.
   **Confirmado con el dueño (2026-08-17): el certificado médico nunca se pide en matrícula — se
   recibe solo para justificar inasistencias.** Por lo tanto el gate del Art. 16 va en el DMS, que es
   donde el dato de salud entra al sistema, y no en el wizard.
2. **AC-E1 pierde sentido en su forma original** ("la matrícula se puede concretar sin certificado
   médico"): la matrícula nunca dependió de ese documento. Se reformula sobre el caso real — si no
   hay autorización, el certificado no se digitaliza y la inasistencia se justifica en papel, con
   constancia registrada de la negativa.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260817120000_consents_table_and_rls.sql` | Migration | Tabla `consents`, función `request_client_ip()`, triggers de IP y de append-only, RLS |
| `supabase/migrations/20260817120100_branches_seed_real_contact_data.sql` | Migration | Reemplaza los placeholders de `branches.address`/`email` por los datos reales (§9 de la spec) |
| `src/app/core/models/dto/consent.model.ts` | DTO | Mapea la tabla `consents` 1:1 |
| `src/app/core/models/ui/consent.model.ts` | UI Model | `ConsentDraft` (lo que la UI recolecta) y `ConsentRow` (lo que el admin ve) |
| `src/app/core/models/ui/privacy-policy.model.ts` | UI Model + datos | `PRIVACY_POLICY_VERSION`, tipo `PrivacyPolicyContent` y `PRIVACY_POLICIES` por `branches.slug`. Mismo precedente que `PROFESSIONAL_DOCUMENTS` en `enrollment-documents.model.ts` |
| `src/app/core/facades/consents.facade.ts` | Facade | Registrar consentimientos, consultarlos por alumno, marcar revocación |
| `src/app/core/facades/consents.facade.spec.ts` | Test | Obligatorio por `testing-tdd.md` |
| `src/app/core/utils/consent-builder.utils.ts` | Util puro | `buildConsentDrafts(input)` — decide qué registros salen de un flujo (titular vs representante, granted true/false) |
| `src/app/core/utils/consent-builder.utils.spec.ts` | Test | Cubre AC7 y AC-E1 sin levantar Angular |
| `src/app/shared/components/privacy-notice/privacy-notice.component.ts` | Dumb | Aviso Art. 14 ter reutilizable — `branchSlug` input, enlace a la política |
| `src/app/features/legal/politica-privacidad/politica-privacidad.component.ts` | Smart (público) | Ruta `/politica-privacidad/:branchSlug`, fuera del shell |
| `src/app/features/legal/politica-privacidad/politica-privacidad.component.spec.ts` | Test | Resolución de slug → política, slug inválido |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/app.routes.ts` | Ruta `politica-privacidad/:branchSlug` junto a `inscripcion` (líneas 57-72), fuera de `path: 'app'` | AC2 — pública, sin sesión |
| `src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.ts` | Insertar `<app-privacy-notice>` | AC1 |
| `src/app/shared/components/matricula-steps/personal-data/personal-data.component.*` | Insertar `<app-privacy-notice>` | AC1 |
| `src/app/shared/components/public-enrollment-steps/public-contract/public-contract.component.ts` | Segunda casilla + **sacar el bloque de aceptación de `@if (!data().isMinor)`** (líneas 95-151) + campos nombre/RUT del representante cuando `isMinor` | AC3, AC7 |
| `src/app/shared/components/matricula-steps/contract/contract.component.html` | Segunda casilla (bloque de aceptación ~línea 314) | AC3 |
| `src/app/core/models/ui/enrollment-contract.model.ts` | Sumar el estado de consentimientos al modelo del paso | AC3/AC7 |
| `src/app/core/facades/enrollment.facade.ts` | En `markContractSigned()` / confirmación, llamar `ConsentsFacade.recordMany()` | AC5, flujo secretaría |
| `src/app/core/facades/public-enrollment.facade.ts` | Pasar `consents` en el body de `submit-clase-b`, `submit-pre-inscription` e `initiate-payment` | AC5, flujo público |
| `supabase/functions/public-enrollment/index.ts` | Insertar `consents` con `service_role` usando el `getClientIp(req)` que ya existe (línea 260) | AC5 — el flujo público nunca toca PostgREST directo |
| `src/app/features/admin/documentos/dms-upload-drawer/dms-upload-drawer.component.ts` | Casilla del Art. 16 que bloquea la subida cuando el tipo es `certificado_medico` | AC4 (reformulado) |
| `src/app/features/admin/alumnos/...ficha...` (pestaña de documentos/expediente) | Panel de solo lectura con los consentimientos del alumno | AC6 |
| `indices/DATABASE.md`, `indices/FACADES.md`, `indices/MODELS.md`, `indices/COMPONENTS.md`, `indices/ROUTES.md`, `indices/UTILS.md` | Alta de los artefactos nuevos | Paso 5 del flujo obligatorio |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `app-alert-card` (`shared/components/alert-card/`) — base visual del aviso Art. 14 ter (`severity="info"`,
  cuerpo por `ng-content`, entrada animada por `hostDirectives`). El componente nuevo `app-privacy-notice`
  es una composición sobre éste, no un diseño desde cero.
- `app-icon` — íconos (`shield`, `info`). Registrar en `provideIcons()` los que falten.
- `app-public-context-banner` — ya resuelve "qué sede es ésta" en el flujo público; de ahí sale el
  `branchSlug` que necesita el aviso y el enlace a la política.

### Facades/Services existentes que extendemos
- `PublicEnrollmentFacade` — ya tiene el `branchSlug` en el draft (`:1308`, `:1592`) y ya centraliza los
  `functions.invoke('public-enrollment')`. Solo se agrega el payload de consentimientos.
- `EnrollmentFacade` — punto de confirmación del wizard de secretaría.
- Edge Function `public-enrollment` — **ya tiene `getClientIp(req)` (`:260`)**, usado hoy por el
  rate-limit. Se reutiliza tal cual; no se escribe un capturador de IP nuevo.
- Trigger de auditoría `20260801140000_audit_log_restore_header_user_id.sql:74` — patrón
  `current_setting('request.headers', true)` ya probado en producción, se replica para la IP del
  flujo autenticado.

### Componentes/Facades que NO existen y debemos crear
- **`ConsentsFacade`** — no hay ningún facade de consentimientos. Va suelto y no dentro de
  `EnrollmentFacade` porque lo consumen tres consumidores independientes (wizard de secretaría, DMS,
  ficha del alumno) y `EnrollmentFacade` ya tiene 16+ signals y es el facade más cargado del repo.
- **`app-privacy-notice`** — no existe ningún aviso legal reutilizable; `app-alert-card` es genérico
  y no fija el contenido obligatorio del Art. 14 ter.
- **Ruta y vista de política** — no hay ninguna página legal en el repo.

### ❗ Lo que Discovery desmintió
- **`audit_log.ip` no tiene mecanismo que copiar: la columna existe y nada la escribe nunca.** El
  `grep` sobre todas las migraciones de `log_change()` no encuentra una sola asignación a `ip`. La
  spec asumía en §5 que se reutilizaría; hay que construirlo.
- **`digital_contracts.signature_ip` está en el mismo estado** — columna declarada
  (`20260301000006_06_documents_and_dms.sql:38`), nunca poblada (`enrollment.facade.ts:1200`,
  `:1261` hacen upsert sin ella). El trigger de IP de esta spec la deja lista para un fix posterior,
  pero **poblarla queda fuera de alcance**.

---

## 4. Modelo de datos

### Migración 1 — `consents`

```sql
-- supabase/migrations/20260817120000_consents_table_and_rls.sql

-- IP server-side: PostgREST expone los headers de la request como JSON.
-- Mismo patrón que el trigger de audit_log (20260801140000:74).
CREATE OR REPLACE FUNCTION public.request_client_ip() RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE h TEXT;
BEGIN
  h := current_setting('request.headers', true);
  IF h IS NULL OR h = '' THEN RETURN NULL; END IF;
  BEGIN
    RETURN NULLIF(split_part((h::json)->>'x-forwarded-for', ',', 1), '');
  EXCEPTION WHEN OTHERS THEN RETURN NULL;
  END;
END $$;

CREATE TABLE IF NOT EXISTS consents (
  id             BIGSERIAL PRIMARY KEY,
  user_id        INT  REFERENCES users(id),        -- NULL: lead sin cuenta todavía
  enrollment_id  INT  REFERENCES enrollments(id),  -- NULL: preinscripción
  branch_id      INT  NOT NULL REFERENCES branches(id), -- ante QUÉ responsable se otorgó
  subject_rut    TEXT,                             -- fallback cuando user_id aún es NULL
  consent_type   TEXT NOT NULL
    CHECK (consent_type IN ('matricula_datos','certificado_medico','preinscripcion')),
  granted        BOOLEAN NOT NULL,                 -- se registra también la NEGATIVA
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at     TIMESTAMPTZ,                      -- ÚNICA columna actualizable
  ip             TEXT,                             -- lo escribe el trigger, no el cliente
  policy_version TEXT NOT NULL,
  source         TEXT NOT NULL CHECK (source IN ('public','secretaria','papel')),
  representative_name TEXT,                        -- AC7
  representative_rut  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- La IP la pone el servidor SIEMPRE; si el cliente manda un valor, se pisa.
CREATE TRIGGER trg_consents_set_ip BEFORE INSERT ON consents ...
  -- NEW.ip := COALESCE(public.request_client_ip(), NEW.ip)  -- ver nota (a)

-- Append-only real: RLS no puede restringir POR COLUMNA, así que el candado va en trigger.
CREATE TRIGGER trg_consents_append_only BEFORE UPDATE ON consents ...
  -- RAISE EXCEPTION si cambia cualquier columna que no sea revoked_at

CREATE INDEX idx_consents_user ON consents(user_id);
CREATE INDEX idx_consents_enrollment ON consents(enrollment_id);
```

> **(a)** El `COALESCE` invertido es deliberado: en el flujo público la fila la inserta la Edge
> Function con `service_role`, donde `request.headers` **no** trae la IP del alumno sino la del
> runtime — ahí la IP correcta es la que la EF calculó con `getClientIp(req)` y viene en el payload.
> En el flujo autenticado pasa lo contrario. La regla concreta (cuál gana en cada caso) se decide en
> `tasks.md` con una prueba en Supabase local; **es el punto que más fácil se implementa mal**.

### Migración 2 — seed de `branches`

```sql
-- supabase/migrations/20260817120100_branches_seed_real_contact_data.sql
UPDATE branches SET address = 'Carrera 74, Chillán, Región de Ñuble',
                    email   = 'conductorchillan@gmail.com' WHERE slug = 'conductores-chillan';
UPDATE branches SET address = 'Maipón 418, Chillán, Región de Ñuble',
                    email   = 'otecchillan@gmail.com'      WHERE slug = 'autoescuela-chillan';
```

> No es cosmético: `branches.address` ya se muestra hoy en el banner de contexto del flujo público, y
> la política de privacidad publica el domicilio y el correo **del responsable**. Publicarla con
> `'Dirección Autoescuela Chillán'` sería entregarle información falsa al titular.

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `consents` | `anon` | — | **Sin ninguna policy** (decidido 2026-08-17). El flujo público **no habla con PostgREST**: todo pasa por la Edge Function con `service_role`, que bypassea RLS. Darle INSERT a `anon` sería abrir una tabla legal a escritura anónima sin que nadie lo necesite |
| `consents` | `authenticated` | INSERT | `WITH CHECK ((SELECT auth.uid()) IS NOT NULL)` — mismo criterio que `insert_audit_log` |
| `consents` | admin / secretary | SELECT | `auth_user_role() IN ('admin','secretary')` |
| `consents` | resto | SELECT | Sin policy — invisible |
| `consents` | admin | UPDATE | Solo para `revoked_at`; el trigger `trg_consents_append_only` bloquea cualquier otra columna |
| `consents` | — | DELETE | **Sin policy en ningún rol** (AC6) |

### Modelos UI/DTO

- `core/models/dto/consent.model.ts` — `Consent`, espejo exacto de la tabla.
- `core/models/ui/consent.model.ts` — `ConsentDraft` (lo que recolecta la UI, sin `ip` ni `id`) y
  `ConsentRow` (fila legible para el panel del admin: etiqueta traducida, fecha formateada, estado).
- `core/models/ui/privacy-policy.model.ts` — `PRIVACY_POLICY_VERSION = '2026-08-17'`,
  `PrivacyPolicyContent` y `PRIVACY_POLICIES: Record<string, PrivacyPolicyContent>` con razón social,
  RUT, domicilio, correo del canal y secciones. **El texto se copia de
  `.compliance/docs/conductores/21719-consentimiento.md` y `.compliance/docs/autoescuela/…` — no se
  redacta nada nuevo** (§7 de la spec).

> **`policy_version`: constante en código, no tabla.** Una tabla exigiría RLS, seed y un facade extra
> para un dato que cambia una o dos veces por década, y AC-E4 solo pide que el registro guarde el
> string vigente al momento del consentimiento — cosa que una constante cumple igual. Cambiar la
> política = editar la constante y su fecha en un commit, que además queda versionado en git.

---

## 5. Arquitectura del feature

```
FLUJO PÚBLICO (sin sesión)
  Alumno → PublicEnrollmentComponent (Smart)
             ├─ <app-privacy-notice [branchSlug]>            AC1
             ├─ <app-public-contract> → 2 casillas + repr.   AC3 / AC7
             └─ PublicEnrollmentFacade
                   └─ functions.invoke('public-enrollment', { …, consents: ConsentDraft[] })
                          └─ EF (service_role) → getClientIp(req) → INSERT consents   AC5

FLUJO SECRETARÍA (autenticado)
  Secretaria → SecretariaMatriculaComponent (Smart)
             ├─ <app-privacy-notice> / <app-contract-step> → 2 casillas
             └─ EnrollmentFacade.confirm…()
                   └─ ConsentsFacade.recordMany(drafts)
                          └─ PostgREST INSERT → trigger request_client_ip()           AC5

DATO SENSIBLE (Art. 16)
  Secretaria → DmsUploadDrawerComponent
             └─ type === 'certificado_medico' → casilla obligatoria
                   └─ ConsentsFacade.record({ type:'certificado_medico', source:'papel' })  AC4
                   (si NO marca → granted:false, no se sube el archivo)                     AC-E1

LECTURA
  Admin → Ficha del alumno → ConsentsFacade.loadByStudent(id) → panel solo lectura      AC6

PÚBLICO
  Cualquiera → /politica-privacidad/:branchSlug → PoliticaPrivacidadComponent
                   └─ PRIVACY_POLICIES[slug] (constante) + branches (nombre/dirección)  AC2
```

### Capas tocadas

- **Smart**: `features/legal/politica-privacidad/`, `features/public-enrollment/`,
  `features/secretaria/matricula/`, `features/admin/documentos/`
- **Dumb**: `shared/components/privacy-notice/`, `shared/components/public-enrollment-steps/*`,
  `shared/components/matricula-steps/*`
- **Facade**: `core/facades/consents.facade.ts` (+ `enrollment.facade.ts`, `public-enrollment.facade.ts`)
- **Util puro**: `core/utils/consent-builder.utils.ts`
- **Edge Function**: `supabase/functions/public-enrollment/index.ts`
- **Migration**: 2 archivos nuevos

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Facade estricto, OnPush, `@if`/`@for`, `input()`/`output()`. El aviso y la
      política son **Dumb** (reciben `branchSlug` por input; no inyectan nada)
- [x] `facades.md` — `ConsentsFacade` con estado privado + readonly. **No** es branch-scoped (el
      `branch_id` viaja en el registro, no filtra la vista) → no inyecta `BranchFacade`
- [x] `models.md` — DTO y UI separados; nada de interfaces sueltas en componentes
- [x] `visual-system.md` — tokens, `app-icon`, sin emojis ni colores arbitrarios en el aviso ni en la política
- [ ] `swr-pattern.md` — no aplica: los consentimientos se leen bajo demanda en la ficha, no se cachean
      entre navegaciones
- [x] `notifications.md` — toast de error si el registro del consentimiento falla (vía `ToastService`)
- [x] `testing-tdd.md` — `.spec.ts` obligatorio para `ConsentsFacade`, `consent-builder.utils` y el
      Smart de la política
- [x] `ai-readability.md` — `data-llm-action` en cada casilla nueva y en el gate del DMS

---

## 7. Plan de testing

- **Unitarios — `consent-builder.utils.spec.ts`** (los más valiosos, sin Angular):
  - mayor de edad → 1 draft `matricula_datos` con `granted:true`, sin representante
  - **menor de edad → draft a nombre del representante con nombre y RUT (AC7)** — el caso que la spec
    marca como trampa
  - casilla del Art. 16 sin marcar → draft con `granted:false` (AC-E1), nunca ausencia de registro
  - `policy_version` siempre presente
- **Unitarios — `consents.facade.spec.ts`**: `recordMany()` arma el payload correcto; error de red
  no rompe la matrícula pero sí emite toast; `revoke()` solo toca `revoked_at` (AC-E3).
- **Unitarios — `politica-privacidad.component.spec.ts`**: slug válido → sociedad correcta; slug
  inexistente → 404 amable, no pantalla en blanco.
- **Integración (Supabase local, `npx supabase start`)**:
  - INSERT desde `anon` funciona; SELECT desde `anon` **no** devuelve nada
  - UPDATE de cualquier columna distinta de `revoked_at` → excepción (AC6)
  - DELETE → rechazado en todos los roles (AC6)
  - la `ip` queda poblada en ambos caminos (EF y PostgREST)
- **QA manual / `/verify`**: matrícula pública completa de un mayor y de un **menor**; matrícula de
  secretaría; subida de certificado médico con y sin la casilla; `/politica-privacidad/…` en ambas
  sedes, sin sesión, en claro y oscuro.

---

## 8. Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| **La IP queda en `NULL` o se guarda la del runtime de la EF en vez de la del alumno** — el punto (a) de §4 | Alta | Probar los dos caminos en Supabase local **antes** de tocar UI; test de integración que afirme IP no nula en ambos |
| **Una matrícula se persiste y el consentimiento no** (fallo parcial): rompe la métrica de "100% de matrículas con consentimiento" | Alta | En el flujo público, insertar los `consents` **dentro de la misma invocación de la EF** que crea la matrícula y fallar la operación completa si el insert falla. En secretaría, registrar antes de marcar la matrícula como confirmada |
| El pago online de Clase B parte en `initiate-payment` y se confirma en `confirm-payment`: si el consentimiento viaja solo en uno de los dos, hay matrículas sin registro | Media | Mandar los drafts en `initiate-payment` y persistirlos recién en el mismo paso que crea el `enrollment`; verificar en QA los tres caminos (`submit-clase-b`, `submit-pre-inscription`, pago) |
| Sacar el bloque de aceptación del `@if (!data().isMinor)` rompe el flujo de menores (hoy salta firma y avanza con `contractSigned.emit('')`) | Media | Separar explícitamente: la **firma** sigue condicionada a `!isMinor`, el **consentimiento** no. Test del componente cubriendo ambas ramas |
| ~~RLS con `INSERT` abierto a `anon`~~ → **resuelto 2026-08-17: `anon` no lleva ninguna policy.** El riesgo residual pasa a ser el opuesto: si algún día alguien intenta insertar un consentimiento desde el cliente público sin pasar por la EF, falla en silencio | Baja | La migración documenta el porqué en un `COMMENT ON TABLE`; el test de integración afirma que un INSERT desde `anon` es **rechazado** |
| Publicar la política con los datos placeholder del seed = información falsa al titular | Media | Migración 2 va **antes** de exponer la ruta; QA verifica domicilio y correo reales en ambas sedes |
| Alcance: la spec toca 6 pantallas y es P0 bloqueante de despliegue | Media | Orden de implementación por AC, con la persistencia (AC5/AC6) primero: es lo que no se puede recolectar retroactivamente |

---

## 9. Orden de implementación

1. **Migraciones** (`consents` + función/triggers de IP + RLS) y corrección del seed de `branches`;
   validar RLS y append-only en Supabase local.
2. **Modelos y constantes**: DTO, UI models, `PRIVACY_POLICIES` con los textos de `.compliance/`.
3. **`consent-builder.utils` + spec** (TDD: el spec primero) — encapsula AC7 y AC-E1.
4. **`ConsentsFacade` + spec**.
5. **Edge Function**: recibir e insertar `consents` en los tres caminos del flujo público.
6. **AC5 end-to-end sin UI nueva**: matrícula pública y de secretaría dejando registro.
7. **AC3 + AC7**: casillas separadas y bloque de representante en los dos pasos de contrato.
8. **AC2**: ruta y vista de política de privacidad.
9. **AC1**: `app-privacy-notice` en los dos pasos de datos personales (necesita la ruta del punto 8
   para enlazar).
10. **AC4 + AC-E1**: gate del Art. 16 en `dms-upload-drawer`.
11. **AC6 + AC-E3**: panel de consultas en la ficha del alumno y marca de revocación.
12. `npm run lint:arch` + `npm run test:ci` + `/verify` + `/spec-verify` + sincronizar `indices/`.

---

## 10. Estimación

**L — 4 a 5 días.** El grueso no es la UI (las 5 pantallas son cambios acotados) sino la migración
con append-only real, la captura de IP por dos caminos distintos y el cableado de la Edge Function.

---

## Changelog

- 2026-08-17 — plan inicial. Incluye la corrección de AC4/AC-E1 y el cierre de las 4 decisiones
  abiertas de la spec §9.
