# Spec 0008-b — Eliminar estilos inline — migrar a clases semánticas del design system

> **Status:** done
> **Created:** 2026-05-26
> **Owner:** Akxlarre
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Revisión visual del módulo admin-pagos — se detectaron botones de paginación con `style=""` inline.

**Persona afectada:** Desarrolladores / mantenibilidad del proyecto.

**Problema que resuelve:**
El código usa `style="color: var(--text-muted)"`, `style="background: var(--bg-surface)"` y similares directamente en el HTML en lugar de las clases semánticas del design system (`text-muted`, `bg-surface`, etc.). Esto rompe la regla visual central del proyecto, hace el código menos mantenible y dificulta el theming. Adicionalmente, los botones de paginación no tienen una clase semántica `.btn-outline` definida, lo que fuerza a repetir el mismo bloque de estilos en cada componente que los use.

**Hipótesis de valor:**
Si migramos todos los estilos inline a clases semánticas y creamos `.btn-outline` en el design system, el código queda más limpio, el theming funciona correctamente y no habrá más repetición de estilos ad-hoc.

---

## 2. User Stories

- **US1**: Como desarrollador, quiero que todos los `style="color: var(--text-muted)"` en `features/` y `shared/` se reemplacen por `class="text-muted"` para que el código sea consistente con el design system.
- **US2**: Como desarrollador, quiero una clase `.btn-outline` en el design system para no tener que repetir los estilos de botones secundarios inline.
- **US3**: Como desarrollador, quiero que los botones de paginación en `admin-pagos` usen `.btn-outline` en lugar de estilos inline.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given el codebase compilado, When hago grep de `style="color: var(--text-` en `src/app/features/`, Then no hay resultados.
- **AC2**: Given el codebase compilado, When hago grep de `style="color: var(--text-` en `src/app/shared/`, Then no hay resultados.
- **AC3**: Given el archivo `src/styles/vendors/_primeng-overrides.scss` o el archivo de utilities del DS, When busco `.btn-outline`, Then existe la clase con los tokens correctos (border, color, bg, hover, disabled).
- **AC4**: Given el componente `admin-pagos`, When renderizo la paginación, Then los botones "Anterior" / "Siguiente" usan `class="btn-outline"` sin ningún atributo `style`.
- **AC5**: Given cualquier componente que use `.btn-outline`, When el modo oscuro está activo, Then los botones se ven correctamente sin estilos hardcodeados.

### Edge cases obligatorios

- **AC-E1**: Given un botón `.btn-outline` con `[disabled]`, When está deshabilitado, Then la opacidad y el cursor se aplican via CSS (no `style="opacity: 0.4"`).
- **AC-E2**: Given estilos inline con `color-mix()` (ej. `asistencia-clase-b-content`), When los reviso, Then se evalúa si tienen clase semántica equivalente o si requieren una nueva clase de estado.

---

## 4. Out of scope

- ❌ Migración de estilos inline en archivos de `layout/` (sidebar, drawer) — son casos especiales con variables no mapeadas aún.
- ❌ Crear un sistema completo de variantes de botón (`.btn-primary`, `.btn-danger`, etc.) — solo `.btn-outline` para esta spec.
- ❌ Cambios en `_primeng-overrides.scss` que afecten componentes PrimeNG existentes.
- ❌ Refactor visual (colores, tamaños, tipografía) — solo migración de mecanismo (inline → clase).

---

## 5. Dependencias

### Specs previas
- Ninguna

### Capacidades del proyecto que se asumen existentes
- Clases semánticas `text-muted`, `text-primary`, `bg-surface`, `border-border-default` ya definidas en `src/tailwind.css` o tokens SCSS
- Design system con tokens CSS (`--text-muted`, `--bg-surface`, etc.) ya operativo

### Capacidades nuevas requeridas
- Clase `.btn-outline` nueva en el design system (archivo por definir en `/spec-plan`)

---

## 6. Datos y modelo (preliminar)

No aplica — es refactor de presentación, sin cambios a BD ni modelos.

---

## 7. UX y flujos (preliminar)

- Pantallas afectadas: `admin-pagos`, `tareas/task-detail-modal`, `tareas/task-create-drawer`, `shared/alumnos-list-content`, `shared/asistencia-clase-b-content`, `shared/alert-card`
- Flujo principal: visualmente idéntico al actual — solo cambia el mecanismo de aplicación de estilos
- Estados especiales: el estado `disabled` del `.btn-outline` debe verse igual que hoy (opacidad reducida)

---

## 8. Métricas de éxito post-launch

- 0 ocurrencias de `style="color: var(--text-` en `src/app/features/` y `src/app/shared/`
- 0 ocurrencias de `style="background: var(--bg-` en los mismos directorios
- `.btn-outline` definida y usada en al menos `admin-pagos`

---

## 9. Decisiones arquitectónicas

- ✅ **`.btn-outline` vive en `tailwind.css`** como `@utility btn-outline`, siguiendo el patrón de `btn-primary`, `btn-secondary`, etc. ya definidos ahí.
- ✅ **`_primeng-overrides.scss` es solo PrimeNG**: mapeo DS→PrimeNG tokens (`--p-*`) + fixes de `.p-*` classes. Nunca utilidades propias del proyecto. Mantenerlo puro facilita upgrades de PrimeNG.
- ✅ **`color-mix()` inline → `@utility badge-{state}`**: crear 4 clases (`badge-warning`, `badge-success`, `badge-error`, `badge-info`) en `tailwind.css` que usan los tokens `--state-*-bg`, `--state-*`, `--state-*-border` ya existentes en el DS.

### División de archivos (ley del proyecto)

| Archivo | Responsabilidad |
|---|---|
| `styles/tokens/_variables.scss` | Design tokens (`--ds-brand`, `--text-primary`, `--state-*`) |
| `tailwind.css` (`@utility`) | Clases de componentes reutilizables (`btn-*`, `badge-*`) |
| `_primeng-overrides.scss` | Mapeo DS → PrimeNG solamente |

---

## Changelog

- 2026-05-26 — draft inicial por Akxlarre
