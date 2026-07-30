# Spec 0011-b — Auditoría UI/UX Global

> **Status:** approved
> **Created:** 2026-06-04
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Auditoría iniciativa interna — continuación de spec 0009 (rediseño flujo inscripción). Alcance: flujo público completo (Clase B + Clase Profesional).

**Persona afectada:** Estudiante/ciudadano que se inscribe públicamente sin autenticación.

**Problema que resuelve:**
El flujo de inscripción pública fue construido con foco en funcionalidad y aprobación de ACs. No ha habido una revisión transversal de calidad visual profesional: el progress bar de pasos queda oculto bajo el card del formulario en ciertos viewports, el responsive en mobile/tablet tiene gaps significativos, y los componentes de cada step tienen inconsistencias de pulido que comunican falta de terminación al usuario final. Un usuario que percibe una UI quebrada abandona el flujo — lo que impacta directamente la tasa de conversión de inscripciones.

**Hipótesis de valor:**
Un flujo de inscripción pulido, responsive y con máxima usabilidad en todos los viewports reduce el abandono y transmite confianza profesional en la autoescuela.

---

## 2. User Stories

- **US1**: Como cualquier usuario, quiero que la interfaz se vea correctamente en mi dispositivo (desktop, tablet, mobile) sin elementos cortados ni desbordados.
- **US2**: Como admin/secretaria, quiero que los componentes del panel tengan un aspecto consistente y profesional en todas las secciones.
- **US3**: Como alumno, quiero que el flujo de inscripción y el portal se vean igual de cuidados que una app bancaria o de salud.
- **US4**: Como desarrollador, quiero un inventario de problemas de UI/UX priorizado que pueda atacar sistemáticamente.

---

## 3. Acceptance Criteria (Gherkin)

> Los ACs se definirán por área de auditoría. Cada sección auditada debe quedar con 0 bloqueantes y ≤2 issues menores antes de marcar como done.

### Área 1 — Responsive / Viewport
- **AC-R1**: Given cualquier vista en 390px (iPhone 14), When se navega, Then no hay overflow horizontal ni elementos cortados.
- **AC-R2**: Given el panel admin en 768px (tablet), When se navega, Then el sidebar colapsa correctamente y el contenido es usable.
- **AC-R3**: Given cualquier tabla de datos en mobile, When se renderiza, Then tiene scroll horizontal o se adapta sin overflow del viewport.

### Área 2 — Design System
- **AC-DS1**: Given cualquier componente en la app, When se inspecciona el CSS, Then no hay colores hex hardcodeados ni clases Tailwind arbitrarias de color.
- **AC-DS2**: Given cualquier ícono en la UI, When se inspecciona, Then usa `<app-icon>` (nunca emoji ni SVG inline).
- **AC-DS3**: Given cualquier botón CTA primario, When está deshabilitado, Then usa el estado `:disabled` de `btn-primary` (gris neutro, no color a 50% opacity).

### Área 3 — Polish de componentes
- **AC-P1**: Given cualquier tabla/listado en la app, When no tiene datos, Then muestra un `app-empty-state` consistente con ícono, título y subtítulo.
- **AC-P2**: Given cualquier formulario, When tiene campos requeridos, Then los campos están marcados con `*` o `(Opcional)`.
- **AC-P3**: Given cualquier estado de carga, When `isLoading=true`, Then muestra skeleton o spinner, nunca pantalla en blanco.
- **AC-P4**: Given cualquier dato numérico KPI, When se renderiza, Then usa `.kpi-value` y `.kpi-label` en vez de `text-4xl font-bold` ad-hoc.

### Área 4 — Posicionamiento / Layout
- **AC-L1**: Given cualquier Smart Component (features/), When usa layout de página, Then usa `.bento-grid[appBentoGridLayout]` como contenedor raíz (no `.page-wide` ni divs arbitrarios).
- **AC-L2**: Given el modal/drawer, When se abre en mobile, Then no queda cortado por el viewport ni requiere scroll del body.

### Edge cases
- **AC-E1**: Given dark mode activo, When se revisan los componentes, Then los tokens `var(--*)` resuelven correctamente y no hay colores hardcodeados que "rompen" en oscuro.
- **AC-E2**: Given un texto muy largo (nombre de alumno >40 chars, dirección >80 chars), When se renderiza en tabla/card, Then hace truncate con ellipsis, no desborda.

---

## 4. Out of scope

- ❌ Rediseño visual completo — esta spec es de corrección, no de rediseño
- ❌ Nuevas features o flujos — solo correcciones de lo existente
- ❌ Performance / Core Web Vitals — es un problema separado
- ❌ Contenido/copy de textos de negocio — solo estructura y estilo
- ❌ Tests unitarios de componentes visuales — verificación con Playwright es suficiente

---

## 5. Dependencias

### Specs previas
- 0009-rediseno-ux-flujo-inscripcion-online-publico (done) — flujo público ya auditado

### Capacidades del proyecto que se asumen existentes
- Design System completo: tokens `var(--)`, `.btn-primary`, `.bento-grid`, `app-icon`, `app-empty-state`, `app-skeleton-block`
- Playwright MCP disponible para QA visual
- `ng build` para validación de template

### Capacidades nuevas requeridas
- Ninguna — solo correcciones de código existente

---

## 6. Datos y modelo (preliminar)

No aplica — esta spec no toca BD ni modelos.

---

## 7. UX y flujos (preliminar)

**Alcance:** Flujo de inscripción pública únicamente — ambos sub-flujos completos.

| Sub-flujo | Steps |
|-----------|-------|
| **Clase B** | Tipo licencia → Datos personales → Modalidad pago → Horario → Foto carnet → Contrato → Pago → Confirmación |
| **Clase Profesional** | Tipo licencia → Datos personales → Test psicológico intro → Test psicológico (6 págs) → Pre-confirmación |
| **Estados transversales** | Draft restore, Orientación (sin branchId), Retorno Webpay (success/rejected/error) |

**Viewports a auditar (todos obligatorios):**
- `390 × 844` — iPhone 14 (mobile crítico)
- `768 × 1024` — iPad (tablet)
- `1280 × 900` — Desktop estándar
- `1440 × 900` — Desktop wide

**Áreas de inspección profesional:**

1. **Progress bar (wizard shell)** — visibilidad, contraste, legibilidad en todos los viewports. Known issue: el header hero puede tapar los steps o viceversa.
2. **Superposición card ↔ hero** — el card glassmorphism tiene `margin-top: calc(var(--space-10) * -1)` para overlap. Verificar que no corte el progress bar ni genere scroll no intencional.
3. **Tipografía y jerarquía** — tamaños de fuente en cada step, legibilidad en mobile, contraste vs fondo del hero.
4. **Formularios** — alignment de labels, inputs, feedback de error/éxito, touch targets en mobile (mín 44px).
5. **Botones y CTAs** — consistencia de tamaño, estado hover/focus/disabled, visibilidad en todos los viewports.
6. **Grilla de horarios** — post hotfix-001, verificar usabilidad real en mobile y tablet.
7. **Test psicológico** — 6 páginas de 14 preguntas: legibilidad, sticky nav, progreso, transiciones entre páginas.
8. **Retorno Webpay** — los 4 estados (loading, success, rejected, error): alineación, contenido, CTAs.
9. **Animaciones GSAP** — ¿funcionan en todos los viewports? ¿causan layout shift?
10. **Accesibilidad básica** — contraste de color, focus visible, aria-labels en campos críticos.

**Metodología:**
1. Playwright sweep sistemático: cada step en los 4 viewports → screenshot + snapshot
2. Checklist DS por componente (tokens, iconos, clases semánticas)
3. Inventario de issues con severidad (Blocker / Mayor / Menor / Cosmético)
4. Fixes implementados en la misma rama, agrupados por área

---

## 8. Métricas de éxito post-launch

- 0 overflows horizontales en mobile detectados por Playwright
- 0 colores hardcodeados en `src/app/` (validado por `npm run lint:arch`)
- 100% de tablas con `app-empty-state` cuando datos vacíos
- 100% de estados de carga con skeleton/spinner (no pantalla en blanco)

---

## 9. Notas / decisiones abiertas

- [ ] ¿Se auditará el portal del alumno e instructor además del panel admin?
- [ ] ¿Se incluye el flujo de Clase Profesional (promociones, asistencia, certificaciones)?
- [ ] ¿Hay un viewport de tablet (768px) que sea prioritario o se enfoca en desktop + mobile?
- [ ] ¿Los fixes se hacen en esta misma spec o se abren fixes/hotfixes separados por área?

---

## Changelog

- 2026-06-04 — draft inicial por Akxlarre
