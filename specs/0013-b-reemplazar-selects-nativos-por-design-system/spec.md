# Spec 0013-b — Reemplazar selects nativos por componentes del Design System

> **Status:** done
> **Created:** 2026-06-12
> **Owner:** Akxlarre
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Auditoría UX sesión 2026-06-12 — revisión de consistencia visual en flujos de formularios.

**Persona afectada:** Cualquier usuario que complete un formulario (secretaria al matricular, admin en drawers de gestión, alumno en flujo público de inscripción).

**Problema que resuelve:**
6 instancias de `<select>` HTML nativo coexisten con `p-select` de PrimeNG y el dropdown custom `app-phone-input`. El estado abierto del `<select>` nativo renderiza un popup del sistema operativo — cuadrado, con tipografía del OS, highlight azul nativo — que rompe visualmente con el resto de la UI (bordes redondeados, tokens del DS, hover con brand color). El problema es especialmente notorio al abrir el dropdown junto a otros controles custom en el mismo formulario.

**Hipótesis de valor:**
Reemplazar los 6 selects nativos por `p-select` de PrimeNG (o segmented control para Género) elimina la inconsistencia visual, unifica la experiencia con el patrón ya establecido en 35+ componentes del admin, y reduce la percepción de "app incompleta".

---

## 2. User Stories

- **US1**: Como secretaria creando un anticipo, quiero que el selector de instructor y el selector de motivo se vean igual que los demás campos del formulario.
- **US2**: Como secretaria iniciando una clase, quiero que el selector de vehículo siga el mismo patrón visual que el resto de la app.
- **US3**: Como alumno completando el flujo público, quiero seleccionar mi género con un control moderno, no un dropdown del sistema operativo.
- **US4**: Como admin en configuración web, quiero que los selectors de tema visual y tipo de fondo se vean integrados con el resto del formulario.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given el drawer "Registrar Anticipo" está abierto, When el usuario hace click en el selector de Instructor, Then el panel desplegado tiene bordes redondeados, fondo `var(--bg-surface)`, hover con `var(--ds-brand)` y no es un popup nativo del OS.
- **AC2**: Given el drawer "Registrar Anticipo" está abierto, When el usuario hace click en el selector de Motivo, Then el comportamiento visual es idéntico a AC1.
- **AC3**: Given el drawer "Iniciar Clase" está abierto, When el usuario hace click en el selector de Vehículo, Then el panel sigue el patrón de `p-select` de PrimeNG con los overrides del DS.
- **AC4**: Given el paso "Datos personales" del flujo público está visible, When el usuario interactúa con el campo Género, Then aparece un segmented control con tres opciones ("Masculino" / "Femenino" / "Prefiero no especificar") — sin dropdown, sin popup nativo.
- **AC5**: Given el drawer de inscripción a curso singular está abierto, When el usuario interactúa con el campo Género, Then el comportamiento es igual a AC4.
- **AC6**: Given la pantalla de configuración web está abierta, When el usuario interactúa con los selectores de Tema Visual y Tipo de Fondo, Then usan `p-select` con los overrides del DS.
- **AC7**: Given cualquiera de los 6 controles reemplazados, When se renderiza en modo oscuro, Then los colores siguen los tokens `[data-mode='dark']` del DS.

### Edge cases obligatorios

- **AC-E1**: Given el `p-select` de Instructor (anticipo) con lista vacía, When se abre, Then muestra el estado vacío de PrimeNG (no rompe el layout).
- **AC-E2**: Given el segmented control de Género con valor `''` (sin seleccionar), When se renderiza, Then ninguna opción aparece activa y el CTA de "Continuar" permanece bloqueado.

---

## 4. Out of scope

- ❌ Reemplazar `<input type="date">` (Fecha de nacimiento) — evaluación separada; el nativo es funcional y accesible en mobile.
- ❌ Crear un componente custom `app-gender-select` reutilizable — inlining directo en cada template es suficiente para 2 instancias.
- ❌ Migrar otros `p-select` ya existentes — solo los 6 nativos identificados.
- ❌ Cambios en la lógica de negocio o validaciones — solo la capa de presentación del control.
- ❌ Flujo del alumno / portal de instructores — no tienen selects nativos identificados.

---

## 5. Dependencias

### Specs previas
- 0012-validaciones-ux-flujo-inscripcion-publica (en curso — comparte `public-personal-data.component.ts`)

### Capacidades del proyecto que se asumen existentes
- `p-select` de PrimeNG con overrides del DS en `_primeng-overrides.scss`
- Tokens `var(--bg-surface)`, `var(--ds-brand)`, `[data-mode='dark']` funcionando
- `ReactiveFormsModule` y `FormsModule` disponibles en los componentes afectados

### Capacidades nuevas requeridas
- Segmented control inline (HTML + CSS puro, sin componente nuevo) para Género

---

## 6. Datos y modelo (preliminar)

- **`Gender` type** (`core/models/ui/enrollment-personal-data.model.ts`): expandido a `'M' | 'F' | 'X' | ''`. Ya aplicado.
- **Migración SQL**: columna `gender CHAR(1)` ya admite cualquier char — solo actualizar el `COMMENT` en `users` y `professional_pre_registrations` para documentar el nuevo valor `'X'`. No requiere ALTER TABLE.
- El binding de datos (`formControlName`, `[(ngModel)]`) se mantiene; el nuevo valor `'X'` fluye igual que `'M'` o `'F'`.

---

## 7. UX y flujos (preliminar)

**Archivos afectados (6 instancias):**

| # | Archivo | Campo | Solución |
|---|---------|-------|----------|
| 1 | `registrar-anticipo-drawer.component.ts` | Instructor | `p-select` |
| 2 | `registrar-anticipo-drawer.component.ts` | Motivo | `p-select` |
| 3 | `admin-iniciar-clase-drawer.component.ts` | Vehículo | `p-select` |
| 4 | `admin-curso-singular-inscribir-drawer.component.ts` | Género | Segmented control |
| 5 | `public-personal-data.component.ts` | Género | Segmented control |
| 6 | `admin-configuracion-web.component.ts` | Tema Visual + Tipo de Fondo | `p-select` |

**Segmented control — diseño verbal:**
Tres botones alineados horizontalmente (`Masculino` / `Femenino` / `Prefiero no especificar`). Borde `var(--border-default)`, fondo activo `color-mix(in srgb, var(--ds-brand) 10%, transparent)`, borde activo `var(--ds-brand)`. Sin dropdown, sin popup. Valor persistido: `'M'` | `'F'` | `'X'`.

---

## 8. Métricas de éxito post-launch

- 0 instancias de `<select>` nativo en `src/app/` (verificable con `grep -r "<select"`)
- Build sin errores (`ng build`)

---

## 9. Notas / decisiones abiertas

- [x] ~~¿El segmented control de Género necesita soporte para un tercer valor?~~ → **Resuelto:** se agrega `'X'` = "Prefiero no especificar". El estándar chileno usa `X` en cédula para personas no binarias (vigente desde 2022).
- [ ] `admin-configuracion-web` tiene 2+ selects — verificar el archivo completo antes de planificar.

---

## Changelog

- 2026-06-12 — draft inicial por Akxlarre
