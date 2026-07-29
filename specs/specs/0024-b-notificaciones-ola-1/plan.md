# Plan 0024-b — Notificaciones Ola 1: infraestructura de tipos + primeros productores (RF-022)

> **Spec:** [spec.md](./spec.md)
> **Status:** approved (2026-07-06)
> **Created:** 2026-07-06
> **Talla:** M (confirmada por owner — ~13 archivos modificados, 0 creados, 0 migraciones)

---

## 1. Resumen ejecutivo

Se extiende el núcleo de notificaciones existente (tipos, utils, facade, panel, topbar) y luego se conectan 4 productores: 3 client-side en facades (matrícula, reprogramación, certificados — actores admin/secretaria, permitidos por RLS) y 1 server-side en la EF `public-enrollment` (pre-inscripción, actor anónimo, service role). Sin cambios de BD ni de RLS. Orden grueso: infraestructura → panel/deep-links → productores cliente → productor EF → QA.

---

## 2. Inventario de impacto

### Archivos a CREAR

Ninguno. Todo es extensión de archivos existentes.

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/models/ui/notification.model.ts` | `NotificationReferenceType` += `enrollment \| certificate \| preinscription \| document`; nuevo tipo `NotificationPanelEntry` (single \| group) | AC1, AC8 |
| `src/app/core/utils/notification.utils.ts` | Mapeos nuevos en `mapReferenceToNotificationType` (enrollment→success, certificate→success, preinscription→info, document→info); nueva función pura `groupNotifications(list): NotificationPanelEntry[]` | AC1, AC8 (Functional Core) |
| `src/app/core/utils/notification.utils.spec.ts` | Tests de los 4 mapeos + fallback + casos de agrupación | testing-tdd |
| `src/app/core/facades/notifications.facade.ts` | `notifyUsers(recipientIds[], payload)` (1 INSERT con array de filas), `notifyRole(role, branchId, payload)` (resuelve dbIds, excluye actor), `markManyAsRead(ids[])` (optimistic + `.in()`), computed `panelEntries` (agrupa y luego corta a 15 entradas) | AC2, AC8 |
| `src/app/core/facades/notifications.facade.spec.ts` | Tests notifyRole (filtro rol/sede/actor), markManyAsRead (optimistic + rollback), panelEntries | testing-tdd |
| `src/app/shared/components/notifications-panel/notifications-panel.component.ts` (+ `.scss`) | Renderizar `NotificationPanelEntry[]`: fila agrupada con contador, expandible (signal local `expandedGroups`), click en grupo NO navega; `markRead` del grupo emite los ids del grupo; íconos por `referenceType` | AC8, AC1 |
| `src/app/layout/topbar.component.ts` | `onNotifClicked`: tabla de rutas tipo × rol (ver §5); consumir `panelEntries`; wire de `markReadMany` | AC3 |
| `src/app/app.config.ts` | Registrar íconos Lucide nuevos del panel (p.ej. `award`, `user-plus`, `car`, `credit-card` — verificar cuáles faltan en el `pick()`) | Regla Lucide (falla en runtime si no) |
| `src/app/core/facades/enrollment.facade.ts` | Helper privado `notifyEnrollmentConfirmed(nro)` llamado desde **ambos** caminos (`confirmEnrollment()` y `confirmWithPayment()`) en la rama de éxito; inyectar `NotificationsFacade` | AC6, AC-E4 |
| `src/app/core/facades/admin-alumno-detalle.facade.ts` | En `reprogramarClase()`: SELECT previo de la sesión (instructor anterior), tras éxito notificar alumno + instructor nuevo + instructor anterior si cambió | AC5 |
| `src/app/core/facades/certificacion-clase-b.facade.ts` | Notificar al alumno tras `generarCertificado()` y `generarPendientes()` (por alumno) | AC7 |
| `src/app/core/facades/certificacion-profesional.facade.ts` | Ídem Clase B | AC7 |
| `supabase/functions/public-enrollment/index.ts` | En `handleSubmitPreInscription()` (línea ~741): tras insert exitoso, query secretarias de la sede + admins → INSERT batch en `notifications` dentro de try/catch propio | AC4, AC-E1, AC-E3 |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `app-notifications-panel` — se extiende, no se reemplaza. Ya tiene íconos por severidad, timeAgo, a11y y `data-llm-action`.
- `app-icon` (Lucide) — para íconos por tipo de referencia.
- Toast automático al llegar Realtime — ya implementado en `subscribeRealtime()`, cero trabajo.

### Facades/Services existentes que extendemos
- `NotificationsFacade` — gana `notifyUsers`/`notifyRole`/`markManyAsRead`/`panelEntries`. `createNotification()` queda como está (lo usa TasksFacade).
- Patrón de resolución de destinatarios: **copiar de `TasksFacade.loadRecipients()`** (query `users` + `roles!role_id(name)` + `.eq('active', true)` + `.neq('id', actorDbId)`). Roles BD: `'admin'`, `'secretary'`.
- Patrón fire-and-forget: **copiar de `TasksFacade.createTask()`** (`.catch(() => toast.warning(...))`, sin bloquear el flujo).

### Componentes/Facades que NO existen y debemos crear
- Nada. La agrupación (AC8) vive como función pura en `notification.utils.ts` (Functional Core), no como componente nuevo.

---

## 4. Modelo de datos

**N/A — sin migraciones.** Se usan `notifications` y `users` existentes; `reference_type` es TEXT libre.

### Decisión de `reference_id` por tipo (para que el deep-link funcione)

| reference_type | reference_id guarda | Por qué |
|---|---|---|
| `enrollment` | **student_id** (no enrollment_id) | La ruta de la ficha `/app/{rol}/alumnos/:id` usa **studentId** (verificado en `AdminAlumnoDetalleFacade.initialize(studentId)`). El número de matrícula va en el mensaje. |
| `preinscription` | id de la pre-inscripción | La página de pre-inscritos es un listado; el id sirve para resaltado futuro. |
| `class_b` | session_id | Consistencia con el dominio. |
| `certificate` | enrollment_id | El certificado cuelga de la matrícula. |

### RLS

Sin cambios. Verificado: `insert_notifications` permite `admin` + `secretary` (migración `20260522000003`); la EF usa service role y bypasea RLS.

### Modelos UI/DTO

- `ui/notification.model.ts` — ampliar union + `NotificationPanelEntry`. DTO intacto.

---

## 5. Arquitectura del feature

### Flujo productor → consumidor

```
[Productores]
 EnrollmentFacade.confirm*() ─┐
 AdminAlumnoDetalleFacade     ├─ notifyUsers()/notifyRole() ──> INSERT notifications
   .reprogramarClase()        │        (fire-and-forget)             │
 Certificacion*Facade         ┘                                      │ Realtime
 EF public-enrollment (service role, INSERT directo batch) ──────────┤ (recipient_id filter)
                                                                     ▼
                                      NotificationsFacade (signal _notifications + toast)
                                                                     │
                                      panelEntries = groupNotifications(filtered) |> take(15)
                                                                     ▼
                          TopbarComponent ──> <app-notifications-panel [entries]>
                                │ notifClicked(single) → deep-link por tipo × rol
                                │ groupToggled → expandir (no navega)
                                └ markReadMany(ids) → facade.markManyAsRead()
```

### Tabla de deep-links (AC3) — `topbar.onNotifClicked()`

| reference_type | admin | secretaria | instructor | alumno |
|---|---|---|---|---|
| `task` (existente) | `/app/admin/tareas` | `/app/secretaria/tareas` | `/app/instructor/tareas` | — |
| `preinscription` | `/app/admin/clase-profesional/pre-inscritos` | `/app/secretaria/profesional/pre-inscritos` | — | — |
| `enrollment` | `/app/admin/alumnos/{refId}` | `/app/secretaria/alumnos/{refId}` | — | `/app/alumno/dashboard` |
| `class_b` | — | — | `/app/instructor/horario` | `/app/alumno/horario` |
| `certificate` | — | — | — | `/app/alumno/dashboard` |
| otro / sin ruta | cierra panel (comportamiento actual, sin error) | | | |

### Contenido de cada productor

| Productor | Destinatarios | Subject / message (esqueleto) |
|---|---|---|
| Matrícula confirmada | alumno (`draft.userId`) + `notifyRole('admin', null)` excluyendo actor | "Matrícula confirmada" / "Matrícula {nro} — {alumno} ({curso}, sede {sede})" |
| Reprogramación | alumno + instructor nuevo + instructor anterior (si cambió) | "Clase reprogramada" / "Clase {n} de {alumno} → {fecha} {hora}" |
| Certificado | alumno | "Tu certificado está listo" / "Certificado {tipo} disponible en tu portal" |
| Pre-inscripción (EF) | `secretary` de la sede + todos los `admin` | "Nueva pre-inscripción" / "{nombre} — {curso} (sede {sede})" |

**Decisión (AC7):** se notifica al **generar** el certificado (queda disponible en el portal). El envío por email NO genera segunda notificación in-app (evita duplicado).

### Capas tocadas

- **Dumb**: `shared/components/notifications-panel/`
- **Smart/Layout**: `layout/topbar.component.ts`
- **Facades**: `notifications`, `enrollment`, `admin-alumno-detalle`, `certificacion-clase-b`, `certificacion-profesional`
- **Utils (Functional Core)**: `core/utils/notification.utils.ts`
- **Edge Function**: `public-enrollment`

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — Facade estricto (los productores nunca insertan desde componentes), OnPush intacto, Functional Core para la agrupación
- [x] `facades.md` — `notifyRole` respeta scope de sede; los productores ya son branch-aware
- [x] `models.md` — cambios solo en `ui/`; DTO intacto
- [x] `visual-system.md` — íconos vía `<app-icon>` + registro en `app.config.ts`; colores por clases `type-*` existentes del panel
- [ ] `swr-pattern.md` — no cambia el ciclo de carga
- [x] `notifications.md` — es la regla madre: capa 2 solo vía `NotificationsFacade`, nunca desde Dumb components
- [x] `testing-tdd.md` — specs primero para utils y facade (lógica nueva)
- [x] `ai-readability.md` — fila agrupada expandible necesita `data-llm-action="expand-notification-group"`

---

## 7. Plan de testing

- **Unitarios (Vitest, TDD):**
  - `notification.utils.spec.ts`: 4 mapeos nuevos + fallback; `groupNotifications`: 3+ no leídas mismo tipo mismo día → grupo; 2 → sin grupo; tipos mezclados; leídas no agrupan; orden estable.
  - `notifications.facade.spec.ts`: `notifyRole` filtra por rol/sede y excluye actor; `notifyUsers` hace 1 INSERT batch; `markManyAsRead` optimistic + rollback en error; `panelEntries` agrupa y corta a 15.
  - Facades productores (`enrollment`, `admin-alumno-detalle`, `certificacion-*`): mock de `NotificationsFacade`, assert destinatarios/payload correctos y que un rechazo del insert NO rompe el flujo principal (AC-E1).
- **Sin tests de componentes** (vitest los excluye — memoria del proyecto): panel y topbar se verifican con `ng build` + `/verify`.
- **QA manual/Playwright (`/verify`):** matrícula de prueba → campana del admin en vivo; 3 matrículas seguidas → fila agrupada (AC8); click → deep-link correcto por rol; pre-inscripción pública local → notificación a secretaria vía Realtime (AC4).
- **EF:** sin harness de test — verificación manual con `npx supabase start` + submit de pre-inscripción; revisar que un fallo del INSERT de notificaciones no afecte la respuesta (try/catch propio).

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| `class_b_sessions.instructor_id` podría no ser `users.id` (¿tabla `instructors` intermedia?) → destinatario equivocado | Media | **Verificar FK en `indices/DATABASE.md` ANTES de codificar AC5**; si hay tabla intermedia, resolver el `users.id` con un join |
| `confirmWithPayment()` no pasa por `confirmEnrollment()` → notificación solo en un camino | Alta si se olvida | Helper único `notifyEnrollmentConfirmed()` llamado explícitamente en la rama de éxito de AMBOS métodos; test por camino |
| Íconos Lucide sin registrar → crash en runtime | Media | Cross-check con `pick()` de `app.config.ts` (el lint ARCH-14 lo atrapa) |
| INSERT de notificaciones agrega latencia a la respuesta de la EF pública | Baja | try/catch propio + tolerar ~50ms; jamás fallar la pre-inscripción por la notificación |
| Agrupación (AC8) rompe `markAllAsRead`/badge | Baja | El badge sigue contando individuales (spec); tests de `panelEntries` + QA visual |
| Draft retomado dispara doble notificación de matrícula | Baja | La notificación vive SOLO en la rama de éxito de la transición a `active` (AC-E4); los re-guardados de draft no pasan por ahí |

---

## 9. Orden de implementación

1. **Tipos + utils (TDD):** ampliar union, escribir `notification.utils.spec.ts` (rojo), implementar mapeos + `groupNotifications` (verde).
2. **NotificationsFacade (TDD):** spec de `notifyUsers`/`notifyRole`/`markManyAsRead`/`panelEntries` → implementar.
3. **UI:** panel agrupado + íconos (registro en `app.config.ts`) + tabla de deep-links en topbar.
4. **Productores cliente:** enrollment (ambos caminos) → reprogramación (verificar FK instructor primero) → certificación B → certificación profesional.
5. **Productor EF:** `handleSubmitPreInscription` + prueba local con `npx supabase start`.
6. **Validación:** `npm run lint:arch`, tests por archivo (no suite global — está rota pre-existente), `ng build`, `/verify` Playwright (campana, agrupación, deep-links, dark mode).
7. `/spec-verify` → acceptance.md.

---

## 10. Estimación

**M — 2 a 3 días.** Día 1: pasos 1-3 (infraestructura + UI). Día 2: paso 4 (productores cliente). Día 3: pasos 5-7 (EF + QA + acceptance).

---

## Changelog

- 2026-07-06 — plan inicial (talla M confirmada por owner)
