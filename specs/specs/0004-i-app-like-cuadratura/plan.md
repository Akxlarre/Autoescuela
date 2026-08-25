# Plan 0004-i — App-like: cuadratura (`admin` + `secretaria`)

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-08-24

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
| `src/app/shared/components/cuadratura-content/cuadratura-content.component.ts` | … | … |

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

N/A — solo reestructuración de UI existente (ver spec.md §5-6).

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

- **Smart**: …
- **Dumb**: `shared/components/cuadratura-content/cuadratura-content.component.ts`
- **Facade**: (a determinar)
- **Service**: (si aplica)
- **Migration**: N/A

---

## 6. Restricciones aplicables (referencia al sistema Koa)

> Marcar las reglas que aplican a este feature. Las completas viven en `.claude/rules/`.

- [ ] `architecture.md` — Patrón Facade, OnPush, Signals
- [ ] `facades.md` — Branch-scoped si aplica
- [ ] `models.md` — DTO vs UI separados
- [ ] `visual-system.md` — Tokens, bento grid, patrón app-like (fill-screen), `force-compact`
- [ ] `swr-pattern.md` — Si el Facade cachea entre navegaciones
- [ ] `notifications.md` — Si dispara toasts o notificaciones
- [ ] `testing-tdd.md` — .spec.ts obligatorios para facades y utils
- [ ] `ai-readability.md` — data-llm-* en botones de mutación

---

## 7. Plan de testing

- Tests unitarios: …
- Tests de integración (si aplican): …
- QA manual (golden path + edge cases): `/verify` en las 4 rutas (`admin`/`secretaria` ×
  desktop/mobile), 390×844, 1440×900 y 768 de alto — verificar específicamente el contador de
  billetes/monedas en mobile y en el nuevo layout fill-screen.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Romper el CSS custom existente de `force-compact` al migrar a `.bento-fill` | Media | Integrar, no reescribir — leer el CSS actual antes de tocarlo |
| Perder precisión de toque del contador de billetes/monedas | Media | QA táctil explícito en mobile y fill-screen antes de dar por cerrado |

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

- 2026-08-24 — plan inicial
