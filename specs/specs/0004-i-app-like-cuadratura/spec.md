# Spec 0004-i — App-like: cuadratura (`admin` + `secretaria`)

> **Status:** draft
> **Created:** 2026-08-24
> **Owner:** i
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Paso 14 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`), separado de
`ASG-b-082` (que agrupaba reportes contables + cuadratura en una sola Asignación).

**Persona afectada:** Admin y Secretaria (rutas `/admin/contabilidad/cuadratura` y
`/secretaria/contabilidad/cuadratura`, mismo componente `shared`).

**Problema que resuelve:**
`cuadratura-content` tiene 990 líneas y **ya tiene CSS custom inline** para `.bento-grid` +
manejo propio de `force-compact` (cuando hay un drawer abierto), además de `p-6 pb-12` extra en
el host del grid (inusual — hay que investigar por qué antes de tocarlo). No puede aplicarse el
patrón app-like fill-screen de forma mecánica: hay que adaptar `.bento-feature` a `.bento-fill`
sin romper ese CSS custom existente **ni el contador de billetes/monedas**, que es una
interacción táctil real (conteo de caja chica) — no debe perder tamaño ni precisión de toque en
ningún breakpoint.

**Hipótesis de valor:**
La página deja de requerir scroll de documento completo en desktop, integrando el
`force-compact` ya existente al canon del patrón app-like en vez de mantenerlo como una
solución paralela, sin degradar la usabilidad del contador táctil.

---

## 2. User Stories

- **US1**: Como Admin/Secretaria en desktop, quiero que la página de cuadratura ocupe toda la
  pantalla sin scroll de documento, para tener una experiencia app-like consistente con el
  resto del sistema.
- **US2**: Como Admin/Secretaria contando caja chica, quiero que el contador de
  billetes/monedas mantenga su tamaño y precisión de toque en cualquier breakpoint, para no
  perder productividad ni cometer errores de conteo por un layout más apretado.
- **US3**: Como Admin/Secretaria con un drawer abierto sobre cuadratura, quiero que
  `force-compact` se siga comportando igual que hoy, para no perder una funcionalidad que ya
  funciona.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given estoy en `/admin/contabilidad/cuadratura` en desktop (lg+), When la página
  carga, Then el layout usa `.bento-fill` sin scroll de documento, integrando el `force-compact`
  ya existente (no duplicado).
- **AC2**: Given estoy contando caja chica, When interactúo con el contador de
  billetes/monedas, Then el área táctil y la precisión son iguales o mejores que antes del
  cambio, en mobile y en el nuevo layout fill-screen.
- **AC3**: Given hay un drawer abierto sobre cuadratura, When se activa `force-compact`, Then
  el comportamiento es el mismo que existía antes de este cambio (no se reimplementa desde
  cero).
- **AC4**: Given estoy en mobile, When abro cuadratura, Then el comportamiento es scroll nativo
  normal.

### Edge cases obligatorios

- **AC-E1**: Given el host del grid tiene `p-6 pb-12` extra (comportamiento inusual actual),
  When se investiga su origen, Then se documenta en `plan.md` si es necesario mantenerlo o si
  era un parche que el nuevo layout ya no necesita.
- **AC-E2**: Given estoy en 768px de alto, When uso el contador táctil, Then sigue siendo
  usable sin recortes ni pérdida de precisión.

---

## 4. Out of scope

- ❌ `reportes-contables-content` — separado en spec `0003-i-app-like-reportes-contables`.
- ❌ Cambiar la lógica de cálculo de la cuadratura — solo el layout/estructura visual.
- ❌ Reescribir el CSS custom existente desde cero — el objetivo es integrarlo al canon, no
  reemplazarlo si ya funciona.

---

## 5. Dependencias

### Specs previas
- Ninguna formal, pero conviene revisar el patrón ya aplicado en `fix-027-i-app-like-instructor-ficha-tabs`
  (piloto de tabs app-like) y cualquier pieza previa del rollout que ya haya manejado
  `force-compact` con drawer.

### Capacidades del proyecto que se asumen existentes
- `.bento-grid--fill-screen*`, `.bento-fill`, `LayoutService.tier()`, el CSS custom actual de
  `cuadratura-content` para `force-compact`.

### Capacidades nuevas requeridas
- Ninguna — es reestructuración de UI existente.

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna.
- Modelos UI nuevos: ninguno esperado.
- RLS requerida: ninguna.

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): `/admin/contabilidad/cuadratura`, `/secretaria/contabilidad/cuadratura`.
- Flujo principal (happy path): usuario entra a cuadratura, cuenta caja chica con el contador
  táctil, el layout no le exige scrollear el documento completo en desktop.
- Estados especiales (loading, error, vacío): heredados del componente existente.

---

## 8. Métricas de éxito post-launch

- N/A — spec interna de deuda técnica de UI, sin métrica de producto.

---

## 9. Notas / decisiones abiertas

- [ ] Investigar el origen del `p-6 pb-12` extra en el host del grid antes de tocarlo — puede
  ser un parche necesario o deuda que ya no aplica con el nuevo layout.
- [ ] Confirmar en `plan.md` cómo se integra el `force-compact` ya existente al canon
  `.bento-fill` sin duplicar lógica.
- Originado de Asignación `ASG-b-082` (`specs/assignments/ASG-b-082-app-like-reportes-y-cuadratura.md`),
  dividida en 2 specs (`0003-i` y `0004-i`) a pedido del usuario en vez de una sola spec conjunta.

---

## Changelog

- 2026-08-24 — draft inicial por i
