# Plan 0040-b — Finalidades de consentimiento para comunicaciones al alumno (Ley 21.719)

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-09-09
> **Approved:** 2026-09-09
> **Talla:** **L — revisar este plan antes de implementar.** L por *amplitud*, no por profundidad:
> son 5 capas × 2 flujos de matrícula + una superficie nueva en el portal alumno. No hay incógnita
> arquitectónica ni dominio nuevo; el precedente exacto de cada pieza ya existe en el repo.

---

## 1. Resumen ejecutivo

Se amplía el CHECK de `consents.consent_type` con dos finalidades de comunicación y se propaga por
las 5 capas que hoy filtran o tipan ese valor (BD → EF → modelos → facades → UI). El cambio de
diseño que manda sobre todo lo demás: **las dos finalidades no son simétricas** — `comunicaciones_operativas`
se **informa** (Art. 13 c: ejecución del contrato) y `comunicaciones_promocionales` se **consiente**
(Art. 12), lo que se traduce en párrafo informativo vs checkbox real. Se agrega además una RLS nueva
y una pantalla mínima en el portal alumno para que el titular revoque su consentimiento promocional
por sí mismo, porque el Art. 12 exige que ese medio esté "permanentemente disponible".

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260909HHMMSS_consents_add_comunicaciones.sql` | Migration | Amplía el CHECK con las 2 finalidades + policy `update_consents_self_revoke_promocional` (AC1, AC8, AC-E4) |
| `src/app/features/alumno/privacidad/alumno-privacidad.component.ts` | Smart | Pantalla de preferencias de privacidad del alumno: estado del consentimiento promocional + revocación (AC7, AC8) |
| `src/app/features/alumno/privacidad/alumno-privacidad.component.spec.ts` | Test | `computed()` que deriva el estado del consentimiento promocional desde `ConsentsFacade.consents()` |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/models/dto/consent.model.ts` | Extender union `ConsentType` con las 2 finalidades | Espeja el CHECK 1:1 (AC1) |
| `src/app/core/models/ui/consent.model.ts` | Agregar las 2 entradas a `CONSENT_TYPE_LABELS` | El panel del admin las muestra legibles |
| `src/app/core/utils/consent-builder.utils.ts` | Nueva `buildCommunicationsConsents()` | Núcleo funcional: produce las 2 filas (operativa siempre `granted:true`, promocional según casilla) — AC2 |
| `src/app/core/utils/consent-builder.utils.spec.ts` | Casos de la función nueva | `testing-tdd.md`: util pura = test obligatorio |
| `src/app/core/models/ui/privacy-policy.model.ts` | Texto de ambas finalidades **con su base legal diferenciada** + bump `PRIVACY_POLICY_VERSION` | AC6 (Art. 14 ter d: "la base de legitimidad del tratamiento") |
| `supabase/functions/public-enrollment/index.ts` | Agregar los 2 tipos al `Set` `CONSENT_TYPES` (~L272) y al union del `consentType` | **Sin esto el consentimiento se descarta en silencio** (~L332) — AC5 |
| `src/app/core/facades/public-enrollment.facade.ts` | Signal `_promotionalConsentAccepted` + incluir `buildCommunicationsConsents()` en el submit | Vía pública (AC2) |
| `src/app/core/facades/public-enrollment.facade.spec.ts` | Casos de las 2 filas nuevas en el payload | Facade = test obligatorio |
| `src/app/shared/components/public-enrollment-steps/public-contract/public-contract.component.ts` | Párrafo informativo (operativa) + checkbox opcional (promocional), **fuera** de `consentsComplete()` | AC2, AC4 — no debe gatear el avance |
| `src/app/core/facades/enrollment.facade.ts` | Mismo par de filas en el flujo de secretaría | AC3 |
| `src/app/core/facades/enrollment.facade.spec.ts` | Casos equivalentes | Facade = test obligatorio |
| `src/app/shared/components/matricula-steps/contract/contract.component.ts` | Mismo tratamiento asimétrico que el flujo público | AC3 |
| `src/app/app.routes.ts` | Ruta `/app/alumno/privacidad` | AC7 |
| `src/app/core/services/auth/menu-config.service.ts` | Entrada en `ALUMNO_NAV` | AC7 — el medio debe ser "expedito" y encontrable |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `<app-public-contract>` y `<app-contract-step>` — ya son el punto de captura de consentimientos de
  ambos flujos; se extienden, no se reemplazan.
- `<app-privacy-notice>` (`shared/components/privacy-notice/`) — ya renderiza el deber de información;
  el texto nuevo de AC6 entra por ahí, no en un componente nuevo.
- `<app-badge>`, `<app-icon>`, `<app-empty-state>`, `.card` / bento — la pantalla de privacidad del
  alumno se arma con el DS existente, sin CSS nuevo.

### Facades/Services existentes que extendemos
- **`ConsentsFacade` — se reutiliza completo, sin métodos nuevos.** Ya tiene `loadByUser(userId)`
  (~L158) y `revoke(consentId)` (~L190), que hace exactamente el `update({revoked_at})` acotado que
  pide AC8. **Lo único que falta para que el alumno pueda usarlo es la policy RLS** — el método ya
  sirve tal cual, la restricción vive en la base.
- `PublicEnrollmentFacade` / `EnrollmentFacade` — se les agrega el signal de la casilla promocional y
  la llamada al builder nuevo, siguiendo el patrón ya establecido por `_psychTestConsent` (spec 0010-m).
- `AuthFacade.currentUser().dbId` — identifica al titular para `loadByUser()` en el portal.

### Componentes/Facades que NO existen y debemos crear
- `AlumnoPrivacidadComponent` — no hay ninguna pantalla de preferencias en el portal alumno
  (`ROUTES.md`: dashboard, clases, pagos, pagar, notificaciones, horario, pruebas-online, ayuda). La
  revocación no encaja en ninguna: `ayuda` es contenido estático y `notificaciones` es el historial de
  la campana, no configuración.

---

## 4. Modelo de datos

### Migración requerida

```sql
-- supabase/migrations/20260909HHMMSS_consents_add_comunicaciones.sql
-- Spec 0040-b (Ley 21.719) — finalidades de comunicación al alumno.
-- Mismo patrón que 20260818130000 (spec 0010-m): drop + recreate del CHECK.

ALTER TABLE consents DROP CONSTRAINT IF EXISTS consents_consent_type_check;

ALTER TABLE consents ADD CONSTRAINT consents_consent_type_check
  CHECK (consent_type IN (
    'matricula_datos', 'certificado_medico', 'preinscripcion', 'test_psicologico',
    'comunicaciones_operativas',      -- Art. 13 c) — se informa, no se consiente
    'comunicaciones_promocionales'    -- Art. 12    — consentimiento real, revocable
  ));

-- Art. 12: el medio de revocación debe ser "expedito, fidedigno, gratuito y
-- permanentemente disponible para el titular". Hoy solo admin puede escribir
-- revoked_at, lo que no satisface ese estándar para un consentimiento de marketing.
-- Acotada a la finalidad promocional a propósito: las demás no nacieron con ese
-- requisito y ampliarlas sin analizarlas una por una sería scope creep (AC-E4).
DROP POLICY IF EXISTS update_consents_self_revoke_promocional ON public.consents;
CREATE POLICY update_consents_self_revoke_promocional ON public.consents
  FOR UPDATE
  USING (user_id = auth_user_id() AND consent_type = 'comunicaciones_promocionales')
  WITH CHECK (user_id = auth_user_id() AND consent_type = 'comunicaciones_promocionales');
```

> **Nota de diseño (no es olvido):** la policy **no** restringe columnas — RLS no puede hacerlo. El
> acotamiento a `revoked_at` lo sigue haciendo `trg_consents_append_only`, que lanza excepción ante
> cualquier UPDATE de otra columna. Es el mismo reparto de responsabilidades que ya usa
> `update_consents_revocation` para admin (AC-E2 lo verifica explícitamente).

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `consents` | admin | UPDATE | `update_consents_revocation` — **sin cambios** |
| `consents` | titular (alumno) | UPDATE | `update_consents_self_revoke_promocional` — **nueva**: solo su fila y solo la finalidad promocional |
| `consents` | admin/secretaria | SELECT/INSERT | sin cambios (no discriminan por `consent_type`) |
| `consents` | `anon` | — | sin policy + `REVOKE ALL` — sin cambios |

### Modelos UI/DTO

- `core/models/dto/consent.model.ts` — `ConsentType` suma 2 miembros (espeja el CHECK).
- `core/models/ui/consent.model.ts` — `CONSENT_TYPE_LABELS` suma 2 etiquetas. **No hace falta un
  modelo nuevo**: `ConsentRow` ya tiene `status` (`otorgado` / `rechazado` / `revocado`) y
  `revokedAt`, que es todo lo que la pantalla del alumno necesita mostrar.

---

## 5. Arquitectura del feature

### Flujo 1 — captura (matrícula, ambas vías)

```
Alumno → <app-public-contract>  (o <app-contract-step> en secretaría)
           ├─ párrafo informativo  → comunicaciones_operativas   (sin control: no es una elección)
           └─ checkbox opcional    → comunicaciones_promocionales (desmarcado por defecto)
                    │
                    ▼
           PublicEnrollmentFacade / EnrollmentFacade
                    ├─ buildCommunicationsConsents()   ← núcleo funcional (util pura)
                    │     → [ {operativa, granted:true}, {promocional, granted:casilla} ]
                    ▼
           EF public-enrollment → persistConsents()    ← CONSENT_TYPES debe conocerlos (AC5)
                    ▼
           tabla consents  (trigger pone ip + granted_at)
```

### Flujo 2 — revocación (portal alumno)

```
Alumno → AlumnoPrivacidadComponent (Smart)
           ├─ inject(ConsentsFacade) + inject(AuthFacade)
           ├─ ngOnInit: loadByUser(currentUser().dbId)
           ├─ computed: fila con consent_type = comunicaciones_promocionales
           └─ botón "Dejar de recibir promociones"  [data-llm-action]
                    ▼
           ConsentsFacade.revoke(consentId)   ← método YA existente, sin cambios
                    ▼
           RLS update_consents_self_revoke_promocional  ← lo nuevo
                    ▼
           trg_consents_append_only  (solo deja pasar revoked_at)
```

### Capas tocadas

- **Smart**: `features/alumno/privacidad/alumno-privacidad.component.ts` (nuevo)
- **Dumb**: `shared/components/public-enrollment-steps/public-contract/`, `shared/components/matricula-steps/contract/`, `shared/components/privacy-notice/`
- **Núcleo funcional**: `core/utils/consent-builder.utils.ts`
- **Facades**: `public-enrollment.facade.ts`, `enrollment.facade.ts` (`ConsentsFacade` sin cambios)
- **Edge Function**: `supabase/functions/public-enrollment/index.ts`
- **Migration**: `supabase/migrations/20260909HHMMSS_consents_add_comunicaciones.sql`

---

## 6. Restricciones aplicables

- [x] `architecture.md` — OnPush + signals en el Smart nuevo; la lógica de armado de filas va a
      `core/utils/` (núcleo funcional), no al Facade ni al componente
- [ ] `facades.md` — branch-scoped **no aplica**: el alumno ve sus propios consentimientos, el scope
      es el titular (`user_id`), no la sede
- [x] `models.md` — `ConsentType` en `dto/` (espeja la tabla), etiquetas en `ui/`; sin duplicar interfaces
- [x] `visual-system.md` — pantalla nueva con bento + `.card` + tokens; app-like por default
- [ ] `swr-pattern.md` — **no aplica**: la pantalla se visita puntualmente y `ConsentsFacade` no cachea
      entre navegaciones hoy; introducir SWR acá sería agregar complejidad sin caso de uso
- [x] `notifications.md` — toast de confirmación al revocar, vía `ToastService` (`ConsentsFacade` ya lo inyecta)
- [x] `testing-tdd.md` — `.spec.ts` obligatorio para la util nueva y para los 2 facades tocados
- [x] `ai-readability.md` — `data-llm-action` en el botón de revocar (es una mutación)

---

## 7. Plan de testing

- **Unitarios (Vitest)**
  - `consent-builder.utils.spec.ts`: la función nueva devuelve **siempre 2 filas**; la operativa sale
    con `granted:true` **aunque** se le pase la casilla en `false` (es informativa, no una elección);
    la promocional refleja la casilla; ambas propagan `grantedByRepresentative` en menores (AC-E1).
  - `public-enrollment.facade.spec.ts` / `enrollment.facade.spec.ts`: el payload de submit incluye las
    2 filas nuevas con `policyVersion` y el `source` correcto de cada vía (AC2, AC3).
  - `alumno-privacidad.component.spec.ts`: el `computed()` deriva bien los 3 estados (vigente,
    rechazado desde el origen, revocado) y no rompe cuando el alumno no tiene fila promocional.
- **Verificación de RLS (empírica, no unitaria)** — el harness es unitario y no levanta Postgres; se
  verifica con el patrón ya usado en specs 0025/0026: token de sesión real + fetch directo a PostgREST.
  Dos casos: (a) un alumno revoca su fila promocional → 200; (b) el mismo alumno intenta revocar su
  fila `matricula_datos` → rechazado por RLS (AC-E4).
- **QA manual (`/verify`)**: matrícula pública completa marcando y sin marcar la casilla → confirmar
  2 filas en `consents` con los `granted` correctos; misma prueba por secretaría; revocar desde el
  portal alumno y confirmar `revoked_at` + toast + estado actualizado.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| **Se aplica la migración sin tocar el `Set` `CONSENT_TYPES` de la EF** → el consentimiento se descarta en silencio, sin error, y quedan matrículas sin registro creyendo que cumplimos | **Alta** — es exactamente el modo de falla que ya tiene el código (~L332) | AC5 lo cubre con un test explícito; en `tasks.md`, la tarea de la EF va **junto** a la de la migración, nunca en tareas separadas |
| La policy nueva permite al alumno tocar otras columnas | Baja | RLS no restringe columnas **por diseño**; el acotamiento lo hace `trg_consents_append_only`, verificado por AC-E2 |
| El alumno no tiene fila promocional (matriculado antes de esta spec) y la pantalla revienta | Media | La pantalla maneja el caso vacío con `<app-empty-state>`; en la práctica no debería ocurrir porque el sistema no se desplegó, pero el código no lo asume |
| Se bumpea `PRIVACY_POLICY_VERSION` sin actualizar el texto de la política | Media | AC6 exige que ambas finalidades estén informadas **con su base legal**; `getPolicyPublishBlockers()` ya existe en `privacy-policy.model.ts` para reportar la inconsistencia |
| Alguien lee "consentimiento operativo" y agrega un checkbox de rechazo "por simetría" | Media | La nota de diseño está al principio de §2 de la spec con la cita del Art. 12 inc. 5; el label del `CONSENT_TYPE_LABELS` debe decir explícitamente que es informativa |

---

## 9. Orden de implementación

1. **Migración + EF juntas** (CHECK, policy, `CONSENT_TYPES`, union del `consentType`) — nunca separadas: ver riesgo #1.
2. Tipos: `dto/consent.model.ts` + `ui/consent.model.ts` (labels).
3. **`consent-builder.utils.spec.ts` primero, después `consent-builder.utils.ts`** (TDD, es núcleo funcional).
4. Texto legal: `privacy-policy.model.ts` + bump de versión.
5. Flujo público: facade + `<app-public-contract>`.
6. Flujo secretaría: facade + `<app-contract-step>`.
7. Portal alumno: ruta + menú + `AlumnoPrivacidadComponent` + su spec.
8. `npm run test:ci` + `npm run lint:arch` + verificación empírica de RLS + `/verify`.

---

## 10. Estimación

**L — 2 a 3 días.** El grueso es la propagación por 5 capas y los 2 flujos de matrícula, no la
complejidad de ninguna pieza individual. La revocación (AC7/AC8), que parecía el bloque más grande,
resultó ser el más chico: 1 policy + 1 pantalla, porque `ConsentsFacade.revoke()` ya existía.

---

## Changelog

- 2026-09-09 — plan inicial, derivado de la spec con sus 4 decisiones ya resueltas contra el texto
  oficial de la Ley 21.719.
