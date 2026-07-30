# Plan 0008-b — Eliminar estilos inline — migrar a clases semánticas del design system

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-05-27

---

## 1. Resumen ejecutivo

Refactor de presentación puro: sin migraciones, sin facades nuevos. Se añaden utilities faltantes al design system (`btn-outline`, `badge-*`) y se reemplazan los `style=""` inline dispersos por las clases semánticas equivalentes ya mapeadas en `tailwind.css`. El trabajo se divide en 4 fases ordenadas de menor a mayor riesgo.

**Scope real descubierto:**
- 38 archivos usan `color-mix()` dinámico en bindings `[style.background]`
- ~15 archivos tienen `style=""` estáticos con tokens `--text-*`, `--bg-*`, `--border-*`
- 1 archivo tiene el patrón de paginación con bloque inline completo (`admin-pagos`)

---

## 2. Inventario de impacto

### Archivos a CREAR
*(Ninguno — solo se modifica `tailwind.css` y los componentes existentes)*

### Archivos a MODIFICAR

#### Fase 1 — Design System (`tailwind.css`)

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/tailwind.css` | Añadir `@utility btn-outline` | Clase semántica para botones secundarios de paginación/acción |
| `src/tailwind.css` | Añadir `@utility badge-warning`, `badge-success`, `badge-error`, `badge-info` | Abstraer `color-mix()` de 12% como clases reutilizables |

#### Fase 2 — `admin-pagos` (caso original)

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/features/admin/pagos/admin-pagos.component.ts` | Reemplazar bloque `style=""` en botones paginación → `btn-outline` | AC4 de la spec |

#### Fase 3 — Sweep estático de `style=""` en `features/` y `shared/`

| Path | Cambio |
|------|--------|
| `src/app/features/tareas/task-detail-modal.component.ts` | `style="color: var(--text-muted)"` → `class="text-text-muted"` (×6) |
| `src/app/features/tareas/task-create-drawer.component.ts` | `style="color: var(--text-muted)"` → `class="text-text-muted"` (×4) |
| `src/app/shared/components/alert-card/alert-card.component.ts` | `style="color: var(--text-muted)"` → `class="text-text-muted"` |
| `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` | `style="border-bottom: 1px solid var(--border-default)"` → `class="border-b border-border-default"` + inputs con tokens inline |
| `src/app/layout/sidebar.component.ts` | `style="color: var(--text-muted)"` en label de grupo → `class="text-text-muted"` |

> ⚠️ El sweep completo de `features/` y `shared/` puede revelar más archivos durante la implementación. Los enumerados arriba son los confirmados del análisis inicial.

#### Fase 4 — Refactor `color-mix()` dinámico (38 archivos)

| Archivos representativos | Cambio |
|--------------------------|--------|
| `src/app/features/admin/asistencia/asistencia-teoria-drawer.component.ts` | Métodos `getRowBackground()`, `getCardStyle()` etc. → retornar clase CSS en lugar de `color-mix()` string |
| `src/app/features/admin/asistencia/agendar-teoria-drawer.component.ts` | Ternarios `[style.background]="condition ? 'color-mix(...)' : 'color-mix(...)'"`  → `[class.badge-success]="condition"` + `[class.badge-warning]="!condition"` |
| `src/app/features/admin/alumnos/clase-online-drawer/admin-clase-online-drawer.component.ts` | `style="background: color-mix(...)"` estáticos → `badge-warning`, `badge-success`, `badge-error` |
| *(+35 archivos adicionales)* | Mismo patrón |

### Archivos a ELIMINAR
*(Ninguno)*

---

## 3. Reutilización (Discovery)

### Clases existentes en `tailwind.css` que ya cubren la mayoría de casos

| Inline style a reemplazar | Clase Tailwind v4 existente | Fuente del mapeo (`@theme`) |
|---------------------------|-----------------------------|-----------------------------|
| `style="color: var(--text-muted)"` | `text-text-muted` | `--color-text-muted: var(--text-muted)` |
| `style="color: var(--text-primary)"` | `text-text-primary` | `--color-text-primary: var(--text-primary)` |
| `style="color: var(--text-secondary)"` | `text-text-secondary` | `--color-text-secondary: var(--text-secondary)` |
| `style="background: var(--bg-surface)"` | `bg-surface` | `--color-surface: var(--bg-surface)` |
| `style="border-color: var(--border-default)"` | `border-border-default` | `--color-border-default: var(--border-default)` |
| `style="color: var(--state-error)"` | `text-error` | `--color-error: var(--state-error)` |
| `style="color: var(--state-success)"` | `text-success` | `--color-success: var(--state-success)` |
| `style="color: var(--state-warning)"` | `text-warning` | `--color-warning: var(--state-warning)` |

### Utilities que NO existen y hay que crear (Fase 1)

**`btn-outline`** — No existe aún. El patrón existente más cercano es `btn-secondary` pero ese tiene fondo translúcido. `btn-outline` es para paginación y acciones de navegación: fondo `bg-surface`, borde `border-muted`, texto `text-primary`, y `opacity-50` + `cursor-not-allowed` en `:disabled`.

**`badge-warning`, `badge-success`, `badge-error`, `badge-info`** — No existen. El DS ya tiene los tokens `--state-*-bg`, `--state-*`, `--state-*-border` (usados en `btn-warning-soft`). Solo falta encapsularlos en una clase de badge inline.

---

## 4. Modelo de datos

**N/A** — Refactor de presentación puro, sin cambios en BD.

---

## 5. Arquitectura del feature

Este feature no tiene flujo Smart→Dumb→Facade. Toca exclusivamente la capa de presentación:

```
tailwind.css (@utility)
  └── @utility btn-outline          ← nueva
  └── @utility badge-warning        ← nueva
  └── @utility badge-success        ← nueva
  └── @utility badge-error          ← nueva
  └── @utility badge-info           ← nueva

Componentes (features/ + shared/)
  └── Reemplazar style="" → class=""
  └── Reemplazar [style.background]="color-mix(...)" → [class.badge-x]="condition"
```

### Anatomía de `btn-outline`

```css
@utility btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  border: 1px solid var(--border-muted);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  padding: 0.375rem 1rem;           /* py-1.5 px-4 — tamaño compacto para paginación */
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  transition: var(--transition-btn);

  &:hover:not(:disabled) {
    background: var(--bg-elevated);
  }

  &:active:not(:disabled) {
    scale: var(--btn-press-scale-value, 0.97);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }
}
```

### Anatomía de `badge-*`

```css
@utility badge-warning {
  background: var(--state-warning-bg);
  color: var(--state-warning);
  border: 1px solid var(--state-warning-border);
  border-radius: var(--radius-md);
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
}
/* badge-success, badge-error, badge-info siguen el mismo patrón */
```

> **Nota:** Los `color-mix()` con porcentajes específicos (6%, 10%, 12%, 15%) son variantes de opacidad del mismo concepto. `badge-*` usará los tokens `--state-*-bg` existentes (que ya encapsulan el `color-mix` en la variable). Para casos donde el componente usa `[style.background]` dinámico condicionalmente, se cambia a `[class.badge-success]="condition"`.

---

## 6. Restricciones aplicables

- [x] `visual-system.md` — Tokens, sin colores hardcodeados. Esta spec es exactamente para cumplir esta regla.
- [x] `architecture.md` — OnPush: verificar que los cambios `[class.x]="signal()"` sean compatibles con OnPush (lo son — Angular detecta el cambio en el input del signal).
- [ ] `facades.md` — No aplica (no toca Facades)
- [ ] `models.md` — No aplica (no toca modelos)
- [ ] `swr-pattern.md` — No aplica
- [ ] `notifications.md` — No aplica
- [ ] `testing-tdd.md` — No aplica (refactor de estilos, sin lógica nueva)
- [ ] `ai-readability.md` — No aplica (no toca botones de mutación)

---

## 7. Plan de testing

- **Tests unitarios:** No requeridos — cambios puramente de clase CSS, sin lógica.
- **QA visual manual (obligatorio por fase):**
  - Fase 1: Build limpio (`ng build`) — verificar que las nuevas utilities aparecen en el CSS generado.
  - Fase 2: Abrir `admin-pagos` y verificar que los botones Anterior/Siguiente se ven igual a hoy (mismo tamaño, misma opacidad en disabled), en modo claro Y oscuro.
  - Fase 3: Verificar cada archivo modificado en el navegador — que el color del texto no cambió visualmente.
  - Fase 4: Verificar que los badges de estado (presente/ausente/warning) en `asistencia-teoria-drawer` y similares tienen los mismos colores que antes.
- **Regresión clave:** Modo oscuro. Todos los tokens `--text-*` y `--state-*-bg` ya tienen override en `[data-mode='dark']` en `_variables.scss` — las clases Tailwind que los consumen son automáticamente dark-mode aware.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| `btn-outline` visualmente diferente a los botones actuales de paginación | Media | Testear Fase 2 en navegador antes de continuar con fases siguientes |
| Clase Tailwind `text-text-muted` genera doble prefijo confuso | Baja | Es la convención de Tailwind v4 con `--color-text-*` tokens; ya se usa así en el proyecto (ej: `text-text-primary` en sidebar) |
| `badge-*` no cubre todos los porcentajes de `color-mix()` usados en Fase 4 | Media | Revisar caso a caso; si el token `--state-*-bg` no tiene la opacidad correcta, ajustar el token en `_variables.scss` en lugar de crear variantes de badge |
| Fase 4 modifica 38 archivos — riesgo de regresión | Alto | Implementar en grupos de 5-8 archivos + QA visual entre grupos. Priorizar archivos activos sobre stubs. |
| Stubs de `alumno/` y `relator/` tienen inline styles — modificarlos tiene bajo valor | Baja | Identificar stubs y dejarlos para el final (o excluirlos del AC si están sin implementar) |

---

## 9. Orden de implementación

1. **[Fase 1]** Añadir `btn-outline` + `badge-*` en `src/tailwind.css` → `ng build` para verificar
2. **[Fase 2]** Migrar paginación de `admin-pagos.component.ts` → QA visual modo claro/oscuro
3. **[Fase 3]** Sweep estático confirmado: `task-detail-modal`, `task-create-drawer`, `alert-card`, `alumnos-list-content`, `sidebar` → QA rápido
4. **[Fase 3-ext]** Sweep estático extendido: ejecutar `grep` para encontrar todos los `style="color: var(--text-` restantes en `features/` y `shared/`, procesar en lote
5. **[Fase 4]** Refactor `color-mix()` dinámico: empezar por `admin-clase-online-drawer` (casos estáticos simples), luego `agendar-teoria-drawer` y `asistencia-teoria-drawer` (casos dinámicos en métodos), el resto en lote
6. **[Verify]** Grep final para confirmar 0 ocurrencias de los patrones en `features/` y `shared/`

---

## 10. Estimación

**2-3 días** — Fases 1-2: 2h | Fase 3: 3-4h | Fase 4: 1-2 días (38 archivos, verificación visual por grupos)

---

## Changelog

- 2026-05-27 — plan inicial
