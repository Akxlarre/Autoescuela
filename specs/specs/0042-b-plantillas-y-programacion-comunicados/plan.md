# Plan 0042-b — Plantillas y programación de comunicados

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Approved:** 2026-09-10
> **Created:** 2026-09-10
> **Talla:** L — 2 features sobre una base existente, 1 migración, 1 Edge Function nueva, 1 job de cron.

---

## 1. Resumen ejecutivo

Dos features que comparten superficie pero casi no comparten código:

**Plantillas** es CRUD clásico sobre una tabla que ya existe y ya tiene la RLS correcta, más una
función pura de sustitución de variables que se aplica en el momento del envío (no al elegir la
plantilla — el mismo texto produce un correo distinto por destinatario).

**Programación** es donde está el riesgo. No alcanza con guardar una fecha: hace falta un
dispatcher que corra sin usuario autenticado, que no duplique envíos si dos corridas se solapan,
y que no reintente para siempre lo que falló. La decisión que ordena todo esto es introducir un
**`status` explícito** en `announcements`, que hoy no existe (el v1 infiere el estado de si
`sent_at` es NULL o no) — y ese estado es también el mecanismo de exclusión mutua.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260910120000_announcements_scheduling.sql` | Migration | `scheduled_for`, `status`, `template_id` en `announcements` + backfill + cron job |
| `supabase/functions/dispatch-scheduled-announcements/index.ts` | Edge Function | Toma los comunicados vencidos y los envía; corre con `service_role`, sin usuario |
| `src/app/core/models/dto/notification-template.model.ts` | DTO | Mapea `notification_templates` |
| `src/app/core/models/ui/notification-template.model.ts` | UI Model | `TemplateDraft`, `TemplateRow` |
| `src/app/core/utils/announcement-template.utils.ts` | Util (núcleo funcional) | Sustitución de variables, validación de plantilla y de fecha programada |
| `src/app/core/utils/announcement-template.utils.spec.ts` | Test | Tests del núcleo funcional |
| `src/app/core/facades/notification-templates.facade.ts` | Facade | CRUD de plantillas + lista para el compositor |
| `src/app/core/facades/notification-templates.facade.spec.ts` | Test | Tests de la facade |
| `src/app/features/comunicados/template-manager-drawer.component.ts` | Smart (drawer) | Gestión de plantillas (solo admin) |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/models/dto/announcement.model.ts` | `scheduled_for`, `status`, `template_id` | Espejar las columnas nuevas |
| `src/app/core/models/ui/announcement.model.ts` | `AnnouncementRow` gana estado y fecha programada; `AnnouncementDraft` gana `scheduledFor` y `templateId` | El historial ahora distingue estados |
| `src/app/core/facades/announcements.facade.ts` | `schedule()`, `cancelScheduled()`; `send()` setea `status` | Programar y cancelar |
| `src/app/core/facades/announcements.facade.spec.ts` | Tests de los métodos nuevos | TDD |
| `src/app/features/comunicados/announcement-composer-drawer.component.ts` | Selector de plantilla + botón "Programar" con fecha/hora | AC2, AC5 |
| `src/app/shared/components/announcements-content/announcements-content.component.ts` | Badge de estado, fecha programada, acción de cancelar | AC7, AC8 |
| `supabase/functions/send-announcement/index.ts` | Aplica sustitución de variables por destinatario | AC3, AC-E1 |
| `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts` | Card que abre la gestión de plantillas (solo admin) | Alojar la UI sin menú nuevo |
| `src/app/app.config.ts` | Íconos nuevos (`file-text`, `clock`, `calendar-clock` según se usen) | Sin registrar, crash en runtime |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Infraestructura existente que se reutiliza tal cual
- **`notification_templates`** con su RLS ya correcta: `insert/update/delete` solo `admin`,
  `select` `admin` + `secretary`. **AC4 se cumple sin escribir una sola policy nueva.**
- **`pg_cron` + `pg_net` + vault**: el job `auto-create-next-promotions` ya invoca una Edge
  Function desde SQL con este patrón exacto, que se copia:
  ```sql
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/dispatch-scheduled-announcements',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  ```
- **`send-announcement`**: el dispatcher no reimplementa el envío, lo invoca. Toda la lógica de
  resolución de segmento, filtro de consentimiento, lotes e idempotencia ya vive ahí y está
  verificada.
- **`AnnouncementsFacade`**, **`announcements-content`**, **compositor**: se extienden, no se
  duplican.
- **`<app-drawer-form>`**, **`ConfirmModalService`**, **`<app-badge>`**, **`<app-empty-state>`**,
  **`DateInputComponent`** (ya usado en `task-create-drawer`) para la fecha programada.

### Lo que hay que crear y por qué no alcanza lo existente
- `NotificationTemplatesFacade` — no hay ninguna facade que toque `notification_templates` (la
  tabla nunca se usó).
- `dispatch-scheduled-announcements` — ver §5, es una decisión de seguridad, no de comodidad.

---

## 4. Modelo de datos

### Migración

```sql
-- supabase/migrations/20260910120000_announcements_scheduling.sql

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'enviado',
  ADD COLUMN IF NOT EXISTS template_id INT REFERENCES notification_templates(id);

-- Los comunicados del v1 no tenían estado: se infería de sent_at.
UPDATE announcements SET status = 'enviado' WHERE sent_at IS NOT NULL;

ALTER TABLE announcements
  ADD CONSTRAINT announcements_status_check
  CHECK (status IN ('programado', 'enviando', 'enviado', 'cancelado'));

-- El dispatcher busca por (status, scheduled_for) en cada corrida.
CREATE INDEX IF NOT EXISTS idx_announcements_pending_dispatch
  ON announcements (scheduled_for)
  WHERE status = 'programado';

SELECT cron.schedule(
  'dispatch-scheduled-announcements',
  '*/15 * * * *',
  $$ ... net.http_post(...) ... $$
);
```

**El `status` no es decorativo: es el candado.** El dispatcher toma un comunicado con
`UPDATE ... SET status='enviando' WHERE id=$1 AND status='programado' RETURNING id`. Si dos
corridas se solapan, la segunda no recibe fila y no hace nada — AC-E4 resuelto por la base, no
por lógica de aplicación.

### RLS

Sin policies nuevas. Las de `announcements` (spec 0041-b) ya cubren el `UPDATE` que necesitan
programar y cancelar, acotado por sede para secretaría. El dispatcher usa `service_role`.

### Modelos

- `dto/notification-template.model.ts` → `NotificationTemplate`
- `ui/notification-template.model.ts` → `TemplateDraft`, `TemplateRow`
- `ui/announcement.model.ts` → `AnnouncementStatus`, y `AnnouncementDraft` gana
  `scheduledFor: string | null` y `templateId: number | null`

---

## 5. Arquitectura del feature

### Por qué el dispatcher es una función aparte y no un parámetro de `send-announcement`

`send-announcement` valida que el llamador sea un `admin`/`secretary` autenticado. Un cron no
tiene sesión. Agregarle una rama "si viene con `service_role`, saltea la validación" convertiría
la única barrera de autorización de la función en un `if` — y esa función es la que decide a qué
alumnos les llega un correo.

En su lugar:

```
cron (*/15)
  └─► dispatch-scheduled-announcements   [service_role]
        1. SELECT ... WHERE status='programado' AND scheduled_for <= now()
        2. por cada uno: UPDATE → 'enviando'  (candado, AC-E4)
        3. invoca send-announcement por lotes con service_role
        4. UPDATE → 'enviado' + contadores
```

La autorización se decidió cuando la persona programó el comunicado, y quedó registrada en
`sent_by` y `branch_id`. El dispatcher no decide nada: ejecuta lo ya autorizado.

> **Detalle a resolver en implementación:** `send-announcement` valida usuario, así que el
> dispatcher no puede llamarla con `service_role` sin el mismo problema. La salida limpia es
> extraer la lógica de envío a un módulo compartido en `supabase/functions/_shared/` que ambas
> funciones importen — hay precedente (`_shared/anti-abuse.ts`, `_shared/reenrollment.ts`). Así
> la validación de usuario queda en el borde HTTP de `send-announcement`, no en el núcleo.

### Sustitución de variables

Función pura en `core/utils/`, pero aplicada **en la Edge Function**, por destinatario, justo
antes de armar el HTML. No en el cliente: el cuerpo se guarda con los marcadores intactos
(`{{nombre}}`), y cada correo los resuelve con sus propios datos. Guardar el texto ya sustituido
rompería el registro (`announcements.body` dejaría de ser lo que se redactó).

Una variable desconocida se reemplaza por vacío (AC-E1): un comunicado a 200 personas no se cae
por un typo.

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Facade, OnPush, Signals; sustitución y validaciones como funciones puras
- [x] `facades.md` — `NotificationTemplatesFacade` con estado privado → público readonly → métodos
- [x] `models.md` — DTO y UI separados; el componente no importa del DTO (ARCH-12, ya me mordió en 0041-b)
- [x] `visual-system.md` — `.card`, tokens, `<app-icon>`, skeleton dentro del componente
- [x] `swr-pattern.md` — la lista de plantillas cachea entre aperturas del compositor
- [x] `testing-tdd.md` — `.spec.ts` primero para el util y la facade
- [x] `ai-readability.md` — `data-llm-action` en guardar plantilla, programar y cancelar
- [x] `database.md` — migración idempotente, documentada en `indices/DATABASE.md`

---

## 7. Plan de testing

**Unitarios (`announcement-template.utils.spec.ts`):**
- Sustituye `{{nombre}}` y `{{sede}}`; múltiples ocurrencias; variable desconocida → vacío (AC-E1);
  cuerpo sin variables intacto; llaves sueltas no rompen.
- Validación de fecha programada: pasado → inválido; futuro → válido; null → envío inmediato.

**Unitarios (`notification-templates.facade.spec.ts`):** CRUD, error de RLS al escribir como
secretaría (AC4), SWR de la lista.

**Unitarios (`announcements.facade.spec.ts`):** `schedule()` persiste `status='programado'` sin
llamar a la EF (AC5); `cancelScheduled()` pasa a `cancelado` y no borra (AC8).

**Verificación server-side (contra la BD de desarrollo, como en 0041-b):**
- AC-E4: dos `UPDATE ... WHERE status='programado'` concurrentes → solo uno afecta fila.
- AC6: programar con fecha pasada + correr el dispatcher a mano → envía y respeta consentimiento.
- AC-E3: segmento vacío al vencer → `enviado` con 0, no reintenta.
- **Todo en `dryRun`**: la EF ya lo soporta y los alumnos sembrados tienen dominio inexistente.

**QA manual (`/verify`):** crear plantilla como admin, usarla como secretaría, programar, ver en
historial, cancelar. Y confirmar que la secretaría **no** ve la gestión de plantillas.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| **Doble envío por corridas solapadas** — el peor: cientos de correos duplicados | Media | `UPDATE ... WHERE status='programado'` como candado atómico (AC-E4), verificado con concurrencia real |
| Debilitar la autorización de `send-announcement` al hacerla invocable por el cron | **Alta si se hace mal** | Núcleo de envío a `_shared/`; la validación de usuario queda en el borde HTTP, no en el núcleo |
| Un comunicado queda trabado en `enviando` si la EF muere a mitad | Media | El dispatcher rescata los `enviando` con más de N minutos y los reintenta; sin esto quedarían huérfanos para siempre |
| Guardar el cuerpo ya sustituido y perder el registro de lo redactado | Media | La sustitución ocurre por destinatario en la EF; `announcements.body` guarda los marcadores |
| El cron corre 96 veces al día casi siempre en vacío | Baja | Índice parcial `WHERE status='programado'`: la query en vacío es un índice vacío, costo despreciable |
| Backfill del `status` mal hecho deja comunicados viejos en estado incorrecto | Baja | `DEFAULT 'enviado'` + UPDATE explícito; hoy hay 0 filas en `announcements`, así que el backfill es trivialmente seguro |

---

## 9. Orden de implementación

1. **Migración** (columnas, CHECK, índice parcial, cron job) + verificación contra la BD real.
2. **Modelos** DTO + UI.
3. **Núcleo funcional** (`announcement-template.utils.ts`) — tests primero.
4. **Extraer el envío a `_shared/`** y dejar `send-announcement` como borde HTTP. Sin cambio
   funcional: la suite de 0041-b tiene que seguir verde antes de seguir.
5. **`dispatch-scheduled-announcements`** + verificación server-side (candado, AC-E3, AC-E4).
6. **`NotificationTemplatesFacade`** + tests.
7. **`AnnouncementsFacade`**: `schedule()`, `cancelScheduled()` + tests.
8. **UI**: gestión de plantillas (drawer admin), selector en el compositor, "Programar", historial
   con estados y cancelar.
9. **Íconos**, `lint:arch`, `test:ci`, `ng build`, `/verify`.
10. **SINCRONIZAR índices** + `acceptance.md`.

> El paso 4 es el que puede romper lo ya entregado. Va antes que todo lo nuevo y con la suite de
> 0041-b como red: si esa refactorización no deja los tests en verde, no se sigue.

---

## 10. Estimación

**L.** Los pasos 4 y 5 concentran el riesgo; 1-3 y 6-7 son mecánicos; 8 es volumen de UI.

---

## Decisiones que este plan cierra (venían abiertas en spec §9)

1. **Frecuencia del cron: cada 15 minutos.** Con índice parcial el costo en vacío es
   despreciable, y 15 minutos es granularidad suficiente para un aviso institucional. La UI debe
   comunicar esa granularidad ("se enviará alrededor de las HH:MM") en vez de prometer precisión
   al minuto.
2. **La plantilla NO guarda el segmento.** Mantiene separado el "qué se dice" del "a quién",
   que es la misma separación que sostiene el filtro de consentimiento. Si más adelante se ve que
   el mismo corte se repite, se evalúa como feature propia.

---

## Changelog

- 2026-09-10 — plan inicial. Cierra las 2 decisiones abiertas de la spec.
