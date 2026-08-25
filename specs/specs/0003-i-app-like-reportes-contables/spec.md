# Spec 0003-i — App-like: reportes contables (`admin` + `secretaria`)

> **Status:** draft
> **Created:** 2026-08-24
> **Owner:** i
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Paso 14 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`), separado de
`ASG-b-082` (que agrupaba reportes contables + cuadratura en una sola Asignación).

**Persona afectada:** Admin y Secretaria (rutas `/admin/contabilidad/reportes` y
`/secretaria/contabilidad/reportes`, mismo componente `shared`).

**Problema que resuelve:**
`reportes-contables-content` tiene 784 líneas y **7 secciones `.bento-banner` secuenciales**
(verificado en auditoría — no 4-5 como decía una pasada anterior), sin mapear en detalle. No
puede aplicarse el patrón app-like fill-screen tal cual: primero hay que rediseñar en tabs,
igual que se hizo en Asistencia B (Prácticas/Ciclos Teóricos) y en el piloto de
`instructor-ficha` (ASG-b-084).

**Hipótesis de valor:**
La página deja de requerir scroll de documento completo en desktop — cada sección de reporte
pasa a ser su propio panel con scroll interno, consistente con el resto del rollout app-like.

---

## 2. User Stories

- **US1**: Como Admin/Secretaria, quiero navegar los reportes contables por tabs en vez de
  hacer scroll por 7 secciones seguidas, para encontrar el reporte que necesito más rápido.
- **US2**: Como Admin/Secretaria en desktop, quiero que la página de reportes ocupe toda la
  pantalla sin que el documento scrollee, para tener una experiencia app-like consistente con
  el resto del sistema.
- **US3**: Como Admin/Secretaria en mobile, quiero seguir teniendo scroll nativo normal, sin
  que el patrón fill-screen rompa la usabilidad táctil.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given estoy en `/admin/contabilidad/reportes` en desktop (lg+), When la página
  carga, Then las 7 secciones de reportes están agrupadas en tabs, sin scroll de documento.
- **AC2**: Given estoy en cualquiera de los 4 puntos de entrada (`admin`/`secretaria` ×
  desktop/mobile), When navego entre tabs, Then no se pierde ningún reporte de los 7
  originales.
- **AC3**: Given estoy en mobile, When abro la página de reportes, Then el comportamiento es
  scroll nativo normal (sin fill-screen forzado).
- **AC4**: Given hay un drawer abierto sobre la página de reportes, When se activa
  `force-compact`, Then el layout no se rompe.

### Edge cases obligatorios

- **AC-E1**: Given estoy en 768px de alto (viewport bajo), When reviso cualquier tab, Then el
  contenido es usable sin recortes.
- **AC-E2**: Given cambio de tab, When el contenido de la sección nueva es más largo que el
  alto disponible, Then scrollea internamente sin romper el shell.

---

## 4. Out of scope

- ❌ `cuadratura-content` — separado en spec `0004-i-app-like-cuadratura` (antes agrupados en
  `ASG-b-082`, se dividieron a pedido del usuario porque son dominios de UI distintos aunque
  compartan módulo de negocio).
- ❌ Cambiar la lógica de negocio o los cálculos de los reportes — solo el layout/estructura.

---

## 5. Dependencias

### Specs previas
- Ninguna formal, pero conviene revisar el patrón ya aplicado en Asistencia B (tabs) y en
  `fix-027-i-app-like-instructor-ficha-tabs` (piloto de tabs app-like) antes de diseñar.

### Capacidades del proyecto que se asumen existentes
- `.bento-grid--fill-screen*`, `.bento-fill`, `LayoutService.tier()` (patrón app-like ya
  documentado en `.claude/rules/visual-system.md`).

### Capacidades nuevas requeridas
- Ninguna — es reestructuración de UI existente, no requiere schema ni endpoints nuevos.

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna.
- Modelos UI nuevos: ninguno esperado (evaluar si hace falta un enum/tipo de tab en
  `plan.md`).
- RLS requerida: ninguna (no toca acceso a datos).

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): `/admin/contabilidad/reportes`, `/secretaria/contabilidad/reportes`.
- Flujo principal (happy path): usuario entra a la página, ve tabs agrupando las 7 secciones,
  navega entre ellas sin perder contexto de scroll entre tabs.
- Estados especiales (loading, error, vacío): heredados de cada sección existente — no se
  espera que cambien, solo el contenedor que las agrupa.

---

## 8. Métricas de éxito post-launch

- N/A — spec interna de deuda técnica de UI, sin métrica de producto.

---

## 9. Notas / decisiones abiertas

- [ ] Definir en `plan.md` cómo se agrupan las 7 secciones en tabs (cuántos tabs, qué entra en
  cada uno) — requiere leer las 784 líneas completas y catalogar cada sección primero.
- [ ] Confirmar que ningún otro punto del sistema linkea directo a una sección específica por
  anchor/fragment que se rompería al mover a tabs.
- Originado de Asignación `ASG-b-082` (`specs/assignments/ASG-b-082-app-like-reportes-y-cuadratura.md`),
  dividida en 2 specs (`0003-i` y `0004-i`) a pedido del usuario en vez de una sola spec conjunta.

---

## Changelog

- 2026-08-24 — draft inicial por i
