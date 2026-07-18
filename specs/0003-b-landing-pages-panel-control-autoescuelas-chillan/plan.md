# Plan Técnico — 0003-b Landing Pages & Panel de Control — Autoescuelas Chillán

> **Generado:** 2026-05-21
> **Spec:** [0003-b](./spec.md) | **Status:** approved
> **Owner:** Akxlarre

---

## 1. Resumen ejecutivo

Panel de control en Angular/Koa que permite a Admin y Secretaria editar en caliente los datos de las landing pages de Autoescuela Chillán (Azul) y Conductores Chillán (Roja). La tabla `website_config` ya existe en Supabase y el micro-script de hidratación en `webs/` ya funciona. Solo falta construir el lado Koa: **1 Facade + 1 Smart Component + 2 rutas lazy + 1 migración de trigger**.

### Lo que ya existe (NO recrear)

| Artefacto | Estado |
|-----------|--------|
| Tabla `website_config` en Supabase | ✅ Migración `20260522000000` aplicada |
| DTO `WebsiteConfig` + tipo `SiteData` | ✅ `core/models/dto/website-config.model.ts` |
| Micro-script de hidratación en Astro | ✅ `webs/src/layouts/LandingLayout.astro` |
| Función SQL `log_change()` | ✅ Disponible en Supabase para reuso |
| `BranchFacade`, `AuthFacade`, `ToastService` | ✅ Inyectables |
| `app-branch-selector`, `app-async-btn`, etc. | ✅ Componentes reutilizables |

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Notas |
|------|------|-------|
| `src/app/core/facades/website-config.facade.ts` | Facade | Signals + SWR + loadConfig/saveConfig |
| `src/app/core/facades/website-config.facade.spec.ts` | Test | **OBLIGATORIO** por regla TDD |
| `src/app/features/admin/configuracion-web/admin-configuracion-web.component.ts` | Smart Component | 6 tabs, role-aware, GSAP |
| `supabase/migrations/20260522000001_website_config_audit_trigger.sql` | Migración SQL | Adjunta `log_change()` a `website_config` |

### Archivos a MODIFICAR

| Path | Cambio |
|------|--------|
| `src/app/app.routes.ts` | Agregar lazy routes `/app/admin/configuracion-web` y `/app/secretaria/configuracion-web` |
| `src/app/core/services/auth/menu-config.service.ts` | Agregar ítem `Configuración Web` con ícono `globe` en grupos Admin y Secretaria |
| `src/app/app.config.ts` | Registrar ícono `Globe` en `provideIcons()` si no está |

---

## 3. Reutilización

| Recurso existente | Cómo se reutiliza |
|-------------------|-------------------|
| `app-branch-selector` | Selector de sedes en cabecera (solo para Admin); pasar `topbarMode=true` |
| `app-section-hero` | Header de la página con título y descripción |
| `app-alert-card` | Mostrar errores de carga/guardado inline |
| `app-async-btn` | Botón flotante "Guardar Cambios" con spinner y estado disabled |
| `app-empty-state` | Cuando `config()` es null (primera vez sin datos) |
| `skeleton-block` | Loading state del formulario completo |
| `BranchFacade.loadBranches()` | Lista de sedes para el selector Admin |
| `AuthFacade.currentUser()` | Detectar rol + branchId de la secretaria |
| `ToastService` | Feedback de éxito/error post-guardado |
| `GsapAnimationsService.animateBentoGrid()` | Animación entrada de la página |
| `log_change()` (SQL function) | Auditoría — solo adjuntar con `CREATE TRIGGER` |

**Nada de lo anterior requiere modificación.** El componente nuevo consume todos estos recursos tal como están.

---

## 4. Modelo de datos

### Tabla (ya existe — NO recrear)

```sql
-- website_config ya existe desde 20260522000000
-- branch_id UNIQUE → una fila por sede
-- config JSONB → estructura SiteData completa
-- RLS: SELECT anon+authenticated; INSERT/UPDATE solo admin o secretaria de esa sede
```

### Migración nueva: Trigger de auditoría

```sql
-- supabase/migrations/20260522000001_website_config_audit_trigger.sql

-- Adjunta log_change() (ya existe en Supabase) a la tabla website_config
CREATE OR REPLACE TRIGGER trg_website_config_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.website_config
  FOR EACH ROW EXECUTE FUNCTION log_change();
```

> ⚠️ La función `log_change()` escribe en la tabla `audit_log` (sin 's'). La spec original decía `audit_logs` — la fuente canónica es `indices/DATABASE.md`. Nombre correcto: `audit_log`.

### Modelos TS (ya existen — NO redefinir)

```typescript
// Importar directamente, NO redefinir en ningún otro archivo
import type { SiteData, WebsiteConfig } from '@core/models/dto/website-config.model';
```

---

## 5. Arquitectura del feature

```
Admin/Secretaria (browser)
    │
    ▼
AdminConfiguracionWebComponent (Smart, features/admin/configuracion-web/)
    ├── AuthFacade.currentUser()   → detecta rol + branchId secretaria
    ├── BranchFacade               → lista sedes para selector Admin
    └── WebsiteConfigFacade
            ├── loadConfig(branchId)   → SELECT website_config WHERE branch_id = ?
            ├── saveConfig(...)        → UPSERT website_config (RLS lo protege)
            └── signals: config, isLoading, isSaving, error
                    │
                    ▼
              SupabaseService (autenticado)
                    │
                    ▼
              Supabase DB: website_config
                    ├── [Trigger] trg_website_config_audit → audit_log
                    └── [SELECT público] ← micro-script Astro hidrata landing
```

### Tabs del formulario

```
[General & Redes] [Hero] [Cursos] [Promoción] [Contacto & Ubicación] [FAQs]
```

### Flujo role-aware en el Smart Component

```typescript
// En ngOnInit:
const user = this.authFacade.currentUser();
if (user.role === 'admin') {
  // Selector de sedes visible; recargar al cambiar sede
  effect(() => {
    const branchId = this.branchFacade.selectedBranchId();
    if (branchId) this.websiteConfigFacade.loadConfig(branchId);
  });
} else {
  // Secretaria: carga directa de su branchId, sin selector
  this.websiteConfigFacade.loadConfig(user.branchId!);
}
```

---

## 6. Restricciones aplicables

- [x] **architecture.md** — OnPush, Facade obligatorio, `@if`/`@for`, sin `*ngIf`
- [x] **facades.md** — Estado privado + expuesto readonly; `branchId` como parámetro (no singleton branch filter interno)
- [x] **models.md** — `SiteData` y `WebsiteConfig` ya existen en `dto/` — NO duplicar
- [x] **visual-system.md** — Bento Grid, `animateBentoGrid()`, `app-async-btn`, tokens semánticos, 0 colores hardcoded
- [x] **testing-tdd.md** — `website-config.facade.spec.ts` OBLIGATORIO; spec antes de implementación
- [x] **swr-pattern.md** — `_initialized` guard en Facade; `refreshSilently()` post-guardado
- [x] **notifications.md** — `ToastService` para feedback; `NotificationsFacade` NO aplica
- [x] **ai-readability.md** — `data-llm-action="save-website-config"` en botón guardar; `data-llm-description` en campos clave
- [ ] **swr-pattern.md (Realtime)** — NO aplica: baja frecuencia de cambio, un editor a la vez

---

## 7. Plan de testing

### `website-config.facade.spec.ts` (OBLIGATORIO)

```typescript
describe('WebsiteConfigFacade', () => {
  describe('loadConfig()', () => {
    it('debe setear isLoading true → false y config con datos de Supabase')
    it('debe inicializar JSON vacío estructurado si no hay fila para branchId (AC-E1)')
    it('debe setear error() si falla la query')
    it('SWR: no debe mostrar skeleton si config ya tiene datos (re-entry)')
  })
  describe('saveConfig()', () => {
    it('debe setear isSaving true → false y actualizar config() tras UPSERT exitoso')
    it('debe llamar ToastService.success() tras guardar')
    it('debe setear isSaving=false y error≠null si Supabase rechaza (AC-E2)')
    it('no debe mutar los datos locales si saveConfig falla')
  })
})
```

### Verificación manual (QA post-implementación)

- Admin cambia de sede → formulario recarga sin CLS
- Secretaria: sin selector de sedes visible
- `curl` con JWT de secretaria intentando UPSERT `branch_id=1` → error 42501
- Landing pública: precio actualizado en < 2s tras guardar desde el panel

---

## 8. Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| `Globe` de Lucide no registrado en `provideIcons()` → crash runtime | Verificar `app.config.ts` antes de implementar; registrar si falta |
| `audit_log` vs `audit_logs` — nombre incorrecto → trigger falla | Usar `audit_log` (confirmado en `DATABASE.md`) |
| Tabla `website_config` ya existe → migración no debe recrearla | `20260522000001` solo crea el trigger; NO usa `CREATE TABLE` |
| `HourConfig`: spec dice campo `hours`, DTO tiene campo `time` | Respetar el DTO (`time`); la spec tiene un error tipográfico |
| RRutas: Admin y Secretaria comparten el mismo componente | El componente detecta el rol internamente — asegurarse que el guard no bloquea el componente en ninguno de los dos roles |

---

## 9. Orden de implementación

```
T1  Verificar Globe en app.config.ts; registrar si falta
T2  Migración SQL: trigger de auditoría (20260522000001)
T3  WebsiteConfigFacade.spec.ts (TDD: spec PRIMERO)
T4  WebsiteConfigFacade.ts (implementación hasta pasar tests)
T5  Rutas lazy en app.routes.ts
T6  MenuConfigService: ítem Configuración Web (Admin + Secretaria)
T7  AdminConfiguracionWebComponent — estructura base + tabs
T8  QA manual: flujo Admin multi-sede + flujo Secretaria restringida
T9  Verificar hidratación en landing pública
```

---

## 10. Estimación

| Tarea | Esfuerzo |
|-------|---------|
| Verificar/registrar Globe + migración trigger | XS |
| WebsiteConfigFacade + spec | S |
| Rutas + menú | XS |
| Smart Component (6 tabs, reactive form) | L |
| QA manual | S |
| **Total** | **~M** |
