# Spec 0033-b — Asistencia Profesional: fill-screen app-like + tabs (Firma semanal | Resumen)

> **Status:** done
> **Created:** 2026-07-21
> **Owner:** Benjamín
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Continuación de la serie de mejoras app-like (specs 0028–0032). Sesión de análisis 2026-07-21 sobre `/app/admin/clase-profesional/asistencia` (código + navegación real con Playwright).

**Persona afectada:** Admin y Secretaría. La página de secretaría (`/app/secretaria/profesional/asistencia`) es un thin-wrapper que reutiliza `AdminProfesionalAsistenciaComponent`, así que ambos portales heredan la mejora de una vez.

**Problema que resuelve:**
Asistencia Prof. es de las últimas páginas operativas diarias que aún scrollea el documento en desktop: el mapa semanal, la tabla de firma y el resumen quedan apilados y la secretaria pierde de vista el mapa al operar las tablas. Además arrastra deuda: un duplicado huérfano de 585 líneas (`SecretariaAsistenciaProfesionalComponent`, ruta sin enlace en el menú) que se desactualiza en silencio, dos tablas inline que comparten ~90% del markup, código muerto en el componente admin y bugs visuales menores (el estado "PENDIENTE" se trunca a "PENDIEN" en las day-cards).

**Hipótesis de valor:**
Con el shell fill-screen y las tablas en tabs con scroll interno, la operación semanal (pasar asistencia + registrar firmas) se hace sin perder nunca el contexto del mapa semanal, con paridad visual con Asistencia B y Ciclos Teóricos.

---

## 2. User Stories

- **US1**: Como admin/secretaria, quiero que Asistencia Prof. ocupe toda la pantalla en desktop sin scroll de página (mapa semanal siempre visible, tablas con scroll interno) para operar como en una app nativa, igual que Asistencia B y Ciclos Teóricos.
- **US2**: Como admin/secretaria, quiero alternar entre "Firma semanal" y "Resumen por alumno" mediante tabs en un solo panel, para ver cada tabla a todo el ancho sin apilarlas.
- **US3**: Como admin/secretaria en móvil o tablet, quiero que la página vuelva a scroll nativo normal sin recortes de contenido.
- **US4**: Como equipo de desarrollo, quiero eliminar el duplicado huérfano de secretaría para que no exista una segunda implementación que se desactualice en silencio.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no podés escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1** (fill-screen desktop): Given viewport desktop (lg+), When abro `/app/admin/clase-profesional/asistencia`, Then el documento no scrollea (el `.shell-content` no genera overflow propio) y todo overflow vive dentro del panel de tabs (`.bento-fill` con scroll interno).
- **AC2** (tabs): Given un curso seleccionado, When cargo la página, Then veo un panel único con tabs **"Firma semanal"** (default) y **"Resumen por alumno"**; When cambio de tab, Then no aparece scroll de página ni shift de layout (modificador fill-screen incondicional, canon spec 0031).
- **AC3** (firma intacta): Given alumnos sin firma en la semana visible, When selecciono checkboxes (individual o "Marcar todos") y pulso "Registrar firmas", Then las firmas se registran con el mismo método del facade que hoy y la selección se limpia; el contador "N/M firmaron" se actualiza.
- **AC4** (mapa semanal intacto): Given un curso seleccionado, When navego con ◄ semana ►, "Volver a Hoy" o cambio Promoción/Módulo, Then el mapa se actualiza igual que hoy y las filas Teoría/Práctica siguen abriendo el drawer de sesión.
- **AC5** (layout dual por contenedor): Given el contenedor `<main>` bajo el umbral (tier mobile/tablet por CONTENEDOR, no por viewport), Then la página usa scroll nativo y el panel de tabs muestra su contenido completo sin scroll interno forzado.
- **AC6** (duplicado eliminado): Given el build post-spec, Then `SecretariaAsistenciaProfesionalComponent` y la ruta `/app/secretaria/asistencia/profesional` no existen, `ng build` pasa limpio y `indices/ROUTES.md` regenerado ya no lista esa ruta.
- **AC7** (secretaría hereda): Given login como secretaria, When abro `/app/secretaria/profesional/asistencia`, Then veo exactamente el mismo layout nuevo (thin-wrapper intacto, `professionalBranchGuard` sigue aplicando).
- **AC8** (cero SCSS nuevo): Given el diff de la spec, Then `src/styles/layout/_bento-grid.scss` queda sin cambios — se reutilizan los modificadores fill-screen existentes.
- **AC9** (limpieza y canon DS): Given el diff de la spec, Then se eliminó el código muerto del componente admin (`getSessionClasses`, `drawerTitle`, `closeDrawer`, estilos `.session-*`), no queda `mb-6` manual entre celdas bento, "PENDIENTE" ya no se trunca en las day-cards, los pills `.pct-badge`/`.firma-badge` migran a `<app-badge>` canónico y la entrada usa `[appBentoReveal]` (canon fix-018).
- **AC10** (regresión): `npm run test:ci` verde completo, `npm run lint:arch` sin errores nuevos respecto a HEAD, `ng build` limpio.

### Edge cases obligatorios

- **AC-E1**: Given desktop con el drawer de sesión abierto (angosta `<main>`), When el contenedor cae de tier, Then el layout no se rompe ni recorta (switch por contenedor, no por `lg:` de Tailwind — canon spec 0030).
- **AC-E2**: Given un curso sin alumnos matriculados, Then los empty states de ambos tabs se muestran dentro del panel sin romper el alto fijo ni generar scroll de página.
- **AC-E3**: Given que aún no se selecciona Promoción/Módulo, Then el estado "Selecciona la Promoción…" mantiene el shell fill-screen estable (sin salto de layout al seleccionar).
- **AC-E4**: Given la primera carga (skeleton), Then los skeletons son fieles al layout final (canon fix-046) y no provocan scroll de página en desktop.

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Cambios funcionales o visuales al drawer de sesión (`AdminSesionDrawerComponent`) más allá de que siga abriendo.
- ❌ Cambios al `AsistenciaProfesionalFacade` en queries, SWR o modelo de datos (solo se admite lo mínimo si los tabs lo requieren, sin tocar contratos).
- ❌ Funcionalidad nueva de negocio (editar sesiones, nuevos KPIs, exportaciones).
- ❌ Rollout app-like a otras páginas pendientes (siguen en el backlog de 0028).
- ❌ Cambios de BD / migraciones (la spec es 100% frontend).

---

## 5. Dependencias

### Specs previas
- 0028 (canon `.bento-fill` + `LayoutService.tier()` por contenedor) — done
- 0029 (`--fill-screen-kpi`) — done
- 0030 (layout dual Asistencia B, switch por contenedor) — done
- 0031 (tabs + fill-screen sin shift de scrollbar, host como celda `.bento-fill`) — done

### Capacidades del proyecto que se asumen existentes
- `AsistenciaProfesionalFacade` con SWR completo (promociones → cursos → sesiones, firmas, resumen)
- Modificadores `.bento-grid--fill-screen*` y `.bento-fill` en `_bento-grid.scss`
- `LayoutService.tier()` alimentado por `observeMain()` en `AppShellComponent`
- Patrón de tabs fill-screen ya probado en Ciclos Teóricos (spec 0031)
- `<app-badge>` como fuente única de pills (fix-036+)
- `[appBentoReveal]` + `animateBentoGrid` tokenizado (fix-018)
- `LayoutDrawerFacadeService` para el drawer de sesión

### Capacidades nuevas requeridas
- Componente(s) de presentación extraídos para las tablas de Firma semanal y Resumen (hoy inline, ~90% de markup compartido) — solo UI, sin lógica de datos nueva.

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

- Tablas nuevas / modificadas: ninguna.
- Modelos UI nuevos: en principio ninguno (se reutiliza `sesion-profesional.model.ts`); si la tabla extraída necesita config, se define en `plan.md`.
- RLS requerida: n/a.

---

## 7. UX y flujos (preliminar)

- **Pantallas afectadas:** `/app/admin/clase-profesional/asistencia` y `/app/secretaria/profesional/asistencia` (thin-wrapper). Se elimina `/app/secretaria/asistencia/profesional` (huérfana).
- **Layout desktop (100vh, sin scroll de página):**
  1. Hero slim con KPIs (fila fija)
  2. Card principal: toolbar (selects + navegador de semana) + mapa semanal Lun–Sáb (fila fija)
  3. Panel `.bento-fill` con tabs **[Firma semanal | Resumen por alumno]** y scroll interno
- **Móvil/tablet (por contenedor):** scroll nativo, mismas secciones apiladas.
- **Estados especiales:** skeleton fiel al layout (primera carga), empty state "Selecciona la Promoción…" (sin curso), empty state "No hay alumnos matriculados" (por tab), fail silencioso SWR con datos stale.

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- n/a (mejora interna de UX; el éxito se valida con el visto bueno visual del owner en `/verify`).

---

## 9. Notas / decisiones abiertas

- [x] Layout desktop de la zona de tablas: **tabs en un solo panel** — decidido por el owner (sesión 2026-07-21, con mockups comparados).
- [x] Duplicado huérfano `SecretariaAsistenciaProfesionalComponent`: **eliminarlo junto con su ruta** — decidido por el owner (sesión 2026-07-21).
- [ ] `plan.md` debe validar qué modificador fill-screen existente calza (¿`--fill-screen-kpi` con el mapa semanal en la banda media, o `--fill-screen` genérico?) manteniendo AC8 (cero SCSS nuevo).
- [ ] `plan.md` decide si las tablas extraídas viven colocated en `features/admin/profesional-asistencia/` (como `session-day-card`) o en `shared/` — según reuso real esperado.

---

## Changelog

- 2026-07-21 — draft inicial por Benjamín (redacción asistida en sesión; decisiones de layout y duplicado ya tomadas por el owner)
