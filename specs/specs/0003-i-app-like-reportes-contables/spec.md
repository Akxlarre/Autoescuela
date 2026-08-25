# Spec 0003-i — App-like: reportes contables (`admin` + `secretaria`)

> **Status:** done
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

- **US1**: Como Admin/Secretaria, quiero que Hero, Filtros y Categorías se sigan viendo igual
  que hoy, y navegar por tabs (Evolución Mensual/Detalle Diario/Rentabilidad, y Gastos Fijos si
  soy admin) en vez de hacer scroll para llegar a esas secciones, para encontrar el reporte que
  necesito más rápido sin perder lo que ya funciona bien.
- **US2**: Como Admin/Secretaria en desktop, quiero que la página de reportes ocupe toda la
  pantalla sin que el documento scrollee, para tener una experiencia app-like consistente con
  el resto del sistema.
- **US3**: Como Admin/Secretaria en mobile, quiero seguir teniendo scroll nativo normal, sin
  que el patrón fill-screen rompa la usabilidad táctil.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given estoy en `/admin/contabilidad/reportes` en desktop (lg+), When la página
  carga, Then veo Hero, Filtros y Categorías exactamente como hoy (sin cambios de posición ni
  de contenido), con los 4 tabs (Evolución Mensual, Detalle Diario, Rentabilidad, Gastos Fijos)
  compactos en la misma línea que "Mes actual"/"Aplicar", y un único panel debajo que muestra
  el contenido de la tab activa, sin scroll de documento.
- **AC1b**: Given soy secretaria (no admin), When entro a `/secretaria/contabilidad/reportes`,
  Then veo solo 3 tabs (sin "Gastos Fijos" — `fixed_expenses` es RLS admin-only, fix-010-i).
- **AC2**: Given estoy en cualquiera de los 4 puntos de entrada (`admin`/`secretaria` ×
  desktop/mobile), When navego entre tabs, Then no se pierde ninguna de las 7 secciones
  originales (3 fijas — Hero/Filtros/Categorías — + 4 en tabs para admin, 3 para secretaria).
- **AC3**: Given estoy en mobile, When abro la página de reportes, Then el comportamiento es
  scroll nativo normal (sin fill-screen forzado).
- **AC4**: Given hay un drawer abierto sobre la página de reportes, When se activa
  `force-compact`, Then el layout no se rompe. **Nota (T4.2):** esta ruta no maneja
  `force-compact` hoy (no hay drawer en su flujo actual) — AC no aplica, documentado en
  `tasks.md`.

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
- Flujo principal (happy path): usuario entra a la página, ve Hero/Filtros/Categorías igual que
  siempre, y navega por tabs compactas en la fila de Filtros (Evolución Mensual/Detalle
  Diario/Rentabilidad, +Gastos Fijos si es admin) en un panel único debajo, sin perder contexto
  de scroll de documento.
- Estados especiales (loading, error, vacío): heredados de cada sección existente — no se
  espera que cambien, solo el contenedor que las agrupa.

---

## 8. Métricas de éxito post-launch

- N/A — spec interna de deuda técnica de UI, sin métrica de producto.

---

## 9. Notas / decisiones abiertas

- [x] Agrupación de tabs definida y **corregida tras QA visual real** (2026-08-24 → 25):
  primera pasada tenía Hero+Filtros+Categorías+Gastos Fijos todos fijos, lo que en /verify
  resultó ser más alto (954px) que el viewport disponible (680-780px), colapsando el panel de
  tabs a 0px — bug real, no cosmético. Estructura final (2026-08-25, decisión del usuario sobre
  el render real): Hero y Filtros cada uno en su propia fila fija; Categorías en su propia fila
  con scroll interno si no entra; Gastos Fijos pasó a ser un **4º tab** (filtrado por
  `isAdmin()`, ya no fijo) en vez de sección fija — ver `plan.md` §5.
- [ ] Confirmar que ningún otro punto del sistema linkea directo a una sección específica por
  anchor/fragment que se rompería al mover a tabs.
- Originado de Asignación `ASG-b-082` (`specs/assignments/ASG-b-082-app-like-reportes-y-cuadratura.md`),
  dividida en 2 specs (`0003-i` y `0004-i`) a pedido del usuario en vez de una sola spec conjunta.

---

## Changelog

- 2026-08-24 — draft inicial por i
- 2026-08-24 — agrupación de tabs corregida tras revisar mockup real: Hero/Filtros/Categorías/
  Gastos Fijos fijos, solo Evolución Mensual/Detalle Diario/Rentabilidad pasan a tabs (antes
  la spec asumía las 7 secciones agrupadas en tabs)
- 2026-08-25 — segunda corrección tras `/verify` en navegador real: el bloque fijo de la
  primera pasada (954px) no entraba en el viewport disponible, colapsando el panel de tabs a
  0px. Estructura final: Filtros separado de Categorías (cada uno su fila), Gastos Fijos pasa
  de sección fija a 4º tab (filtrado por rol). AC1/AC1b/AC2/AC4 actualizados
