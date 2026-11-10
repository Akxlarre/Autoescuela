# Plan {{ID}} — {{TITLE}}

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** {{DATE}}

---

## 1. Resumen ejecutivo

(2-3 frases. Qué se va a construir técnicamente, en qué orden grueso.)

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/...` | (Smart/Dumb/Facade/Service/Migration) | … |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/...` | (agregar método X, extender tipo Y) | … |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|

---

## 3. Reutilización (Discovery)

> Salida del paso DESCUBRIR. Qué ya existe que vamos a aprovechar.
> Esto se cruza con `indices/*.md` del proyecto.

### Componentes existentes que reutilizamos
- `<app-componente-x>` — para …

### Facades/Services existentes que extendemos
- `XxxFacade.metodoY()` — agregar caso …

### Componentes/Facades que NO existen y debemos crear
- … (justificar: por qué no se puede reutilizar uno existente)

---

## 4. Modelo de datos

> Si la spec implica cambios en BD. Si no, marcar "N/A".

### Migración(es) requerida(s)

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_dominio_tipo_descripcion.sql
-- Pseudo-SQL del cambio. SQL final va en la tarea correspondiente de tasks.md.
```

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `xxx` | public | SELECT | … |
| `xxx` | secretaria | INSERT | … |

### Modelos UI/DTO

- `core/models/dto/xxx.model.ts` — mapea tabla `xxx`
- `core/models/ui/xxx-row.model.ts` — para componente `<app-xxx-table>`

---

## 5. Arquitectura del feature

### Diagrama de flujo (verbal o ASCII)

```
Usuario → <SmartComponent>
            ├─ inject(XxxFacade)
            ├─ effect: observa branchId()
            └─ <DumbComponent>
                  input: items
                  output: rowClicked
```

### Capas tocadas

- **Smart**: `features/.../xxx.component.ts`
- **Dumb**: `shared/components/.../yyy.component.ts`
- **Facade**: `core/facades/xxx.facade.ts`
- **Service**: (si aplica)
- **Migration**: `supabase/migrations/...`

---

## 6. Restricciones aplicables (referencia al sistema Koa)

> Marcar las reglas que aplican a este feature. Las completas viven en `.claude/rules/`.

- [ ] `architecture.md` — Patrón Facade, OnPush, Signals
- [ ] `facades.md` — Branch-scoped si aplica
- [ ] `models.md` — DTO vs UI separados
- [ ] `visual-system.md` — Tokens, bento grid, sin colores hardcodeados
- [ ] `swr-pattern.md` — Si el Facade cachea entre navegaciones
- [ ] `notifications.md` — Si dispara toasts o notificaciones
- [ ] `testing-tdd.md` — .spec.ts obligatorios para facades y utils
- [ ] `ai-readability.md` — data-llm-* en botones de mutación

---

## 7. Plan de testing

- Tests unitarios: …
- Tests de integración (si aplican): …
- QA manual (golden path + edge cases): …

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| … | Alta/Media/Baja | … |

---

## 9. Orden de implementación

1. Migración SQL + tipos DTO
2. Facade + .spec.ts
3. Smart Component
4. Dumb Components
5. Conexión UI ↔ Facade
6. QA + AC verification

---

## 10. Estimación

(Opcional. Horas, días, o "M/L/XL".)

---

## Changelog

- {{DATE}} — plan inicial
