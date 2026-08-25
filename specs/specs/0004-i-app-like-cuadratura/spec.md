# Spec 0004-i — App-like: cuadratura (`admin` + `secretaria`)

> **Status:** done
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
`cuadratura-content` tiene 990 líneas, estructura 2 columnas (izquierda 2/3: Ingresos + Egresos
apilados; derecha 1/3 `sticky`: card "Arqueo y Cierre Operativo" con fondo de apertura, resumen
y el contador de billetes/monedas). No puede aplicarse el patrón app-like fill-screen de forma
mecánica por 2 motivos, uno técnico y uno de diseño real (encontrado por el usuario probando el
render actual, 2026-08-25, no en la spec original):

1. **Técnico:** el contador de billetes/monedas, al activarse (toggle "Realizar arqueo de
   efectivo físico"), **agranda el card de Arqueo dramáticamente** (9 inputs de denominación +
   totales) — dentro de una columna `sticky`/`.bento-tall` de ancho fijo, ese crecimiento hoy
   empuja todo el layout, y sería peor aún dentro de un contenedor de alto fijo (fill-screen).
2. **De diseño:** con las 3 piezas (Ingresos, Egresos, Arqueo) compitiendo por 2 columnas,
   "Egresos/Retiros" queda relegado al fondo de la columna izquierda, exigiendo scroll para
   llegar a él incluso en la página actual (no app-like).

**Decisión de rediseño (usuario, 2026-08-25, sobre el render real):** en vez de forzar las 3
piezas a convivir en 2 columnas fijas, **Arqueo y Cierre Operativo pasa a ser un Drawer** (mismo
patrón `LayoutDrawerFacadeService` que ya usa `ServiciosEspecialesFacade`/`HistorialCuadraturasFacade`),
disparado por un botón/card resumen en la columna derecha (donde antes vivía el card completo).
Esto resuelve el problema técnico de raíz: el contador crece **dentro del Drawer**, que ya tiene
su propio manejo de overflow, sin empujar el grid de la página. Egresos/Retiros pasa a ocupar el
lugar que dejó Arqueo en la columna derecha. "Cerrar Caja" se separa del flujo de Arqueo y pasa a
vivir en las acciones del Hero (junto a "Exportar"/"Ver Historial").

**Hipótesis de valor:**
La página deja de requerir scroll de documento completo en desktop, Egresos/Retiros deja de
estar escondido al fondo de la columna izquierda, y el contador táctil deja de romper el layout
de la página al crecer (ahora crece dentro de su propio Drawer).

---

## 2. User Stories

- **US1**: Como Admin/Secretaria en desktop, quiero que la página de cuadratura ocupe toda la
  pantalla sin scroll de documento, para tener una experiencia app-like consistente con el
  resto del sistema.
- **US2**: Como Admin/Secretaria contando caja chica, quiero que el contador de
  billetes/monedas mantenga su tamaño y precisión de toque en cualquier breakpoint, y que
  crecer no rompa el layout de la página (vive en un Drawer, no en una columna de ancho fijo).
- **US3**: Como Admin/Secretaria, quiero ver "Egresos/Retiros" sin tener que scrollear al fondo
  de la columna izquierda — pasa a la columna derecha, en el lugar que dejó Arqueo.
- **US4**: Como Admin/Secretaria, quiero abrir "Arqueo y Cierre Operativo" como un Drawer bajo
  demanda (no siempre visible ocupando espacio permanente), para dedicarle toda la atención al
  conteo cuando lo necesito sin que compita con Ingresos/Egresos por espacio en pantalla.
- **US5**: Como Admin/Secretaria, quiero que "Cerrar Caja" esté en el Hero (junto a
  Exportar/Ver Historial), no enterrado al final del flujo de Arqueo, para encontrarlo rápido.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given estoy en `/admin/contabilidad/cuadratura` en desktop (lg+), When la página
  carga, Then veo Hero (con "Cerrar Caja" entre sus acciones) + 2 columnas: izquierda = Registro
  de Ingresos (toda la altura), derecha = Egresos/Retiros arriba + un resumen/botón "Ver Arqueo
  y Cierre" abajo — sin scroll de documento.
- **AC2**: Given hago clic en el resumen/botón de Arqueo, When se abre, Then aparece como Drawer
  (`LayoutDrawerFacadeService`) con fondo de apertura, resumen de ingresos/egresos en efectivo,
  el toggle "Realizar arqueo de efectivo físico" y (si está activo) el contador de
  billetes/monedas — el Drawer NO contiene el botón "Cerrar Caja" (vive en el Hero).
- **AC3**: Given el Drawer de Arqueo está abierto, When activo el toggle de arqueo físico, Then
  el contador de billetes/monedas aparece y el Drawer crece/scrollea internamente — el grid de
  la página de fondo (Ingresos/Egresos) **no se ve afectado**.
- **AC4**: Given estoy contando caja chica dentro del Drawer, When interactúo con el contador de
  billetes/monedas, Then el área táctil y la precisión son iguales o mejores que antes del
  cambio, en mobile y en desktop.
- **AC5**: Given hay un drawer abierto (el propio Arqueo, u otro) sobre cuadratura, When se
  activa `force-compact` en el grid de fondo, Then el comportamiento es el mismo que existía
  antes de este cambio para Ingresos/Egresos (no se reimplementa desde cero).
- **AC6**: Given estoy en mobile, When abro cuadratura, Then el comportamiento es scroll nativo
  normal, y el botón de Arqueo sigue abriendo el Drawer igual que en desktop.

### Edge cases obligatorios

- **AC-E1**: Given el host del grid tiene `p-6 pb-12` extra (comportamiento inusual actual —
  investigado: es padding elegido a mano desde las primeras versiones del componente, cuando la
  página tenía scroll de documento normal, no un parche de un bug puntual), When se aplica el
  nuevo layout de 2 columnas sin Arqueo inline, Then se decide en `plan.md` si ese padding
  sigue teniendo sentido o se reemplaza por el canon de `--bento-pad-lg`.
- **AC-E2**: Given estoy en 768px de alto con el Drawer de Arqueo abierto y el contador activo,
  When uso el contador táctil, Then sigue siendo usable sin recortes ni pérdida de precisión
  (el Drawer scrollea internamente si hace falta).

---

## 4. Out of scope

- ❌ `reportes-contables-content` — separado en spec `0003-i-app-like-reportes-contables`.
- ❌ Cambiar la lógica de cálculo de la cuadratura (fondo, saldo teórico, diferencia) — solo el
  layout/estructura visual y dónde vive cada pieza.
- ❌ Cambiar el flujo de conteo de billetes/monedas en sí (los mismos inputs, misma lógica) —
  solo dónde vive (Drawer en vez de card inline).

---

## 5. Dependencias

### Specs previas
- Ninguna formal, pero conviene revisar el patrón ya aplicado en `fix-027-i-app-like-instructor-ficha-tabs`
  (piloto de tabs app-like), y los precedentes de Drawer con formulario complejo:
  `ServiciosEspecialesFacade.openAgregarServicioDrawer()` / `HistorialCuadraturasFacade`
  (`app-detalle-cuadratura-modal`) — mismo patrón `LayoutDrawerFacadeService`.

### Capacidades del proyecto que se asumen existentes
- `.bento-grid--fill-screen*`, `.bento-fill`, `LayoutService.tier()`, `LayoutDrawerFacadeService`,
  el CSS custom actual de `cuadratura-content` para `force-compact` (se conserva para
  Ingresos/Egresos, ya no aplica al Drawer de Arqueo que se abre por encima).

### Capacidades nuevas requeridas
- `CuadraturaFacade` necesita un método `abrirArqueoDrawer()` (mismo patrón que
  `ServiciosEspecialesFacade.openAgregarServicioDrawer()` — import dinámico de
  `LayoutDrawerFacadeService`, ya que un Facade de dominio no puede inyectar Facades
  transversales directo según `.claude/rules/architecture.md`, pero **sí puede llamar al
  servicio** vía import dinámico, que es el patrón ya usado).
- Un componente nuevo `app-arqueo-cierre-drawer` (o similar) que envuelva el contenido que hoy
  vive en el card `.bento-tall` — recibe los mismos inputs que hoy recibe `cuadratura-content`
  para esa sección (fondo, ingresos/egresos efectivo, saldo, cantidades de denominaciones) y
  emite los mismos outputs (cambios de fondo, cambios de cantidad, submit). **Sin
  `LayoutDrawerFacadeService`no soporta inputs** (igual que otros drawers del proyecto) — el
  Facade debe exponer los datos necesarios como signals que el drawer lee directo.

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna.
- Modelos UI nuevos: ninguno esperado.
- RLS requerida: ninguna.

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): `/admin/contabilidad/cuadratura`, `/secretaria/contabilidad/cuadratura`.
- Flujo principal (happy path): usuario entra a cuadratura, ve Ingresos (izquierda) y
  Egresos + resumen de Arqueo (derecha) sin scrollear el documento. Clic en el resumen de
  Arqueo → se abre el Drawer con fondo/resumen/toggle de conteo físico. Si activa el conteo,
  el contador de billetes/monedas aparece y el Drawer crece internamente sin afectar la página
  de fondo. Cuando termina, cierra el Drawer y usa "Cerrar Caja" desde el Hero.
- Estados especiales (loading, error, vacío): heredados del componente existente — el Drawer
  hereda el estado `cajaYaCerrada()` (deshabilita edición) igual que hoy.

---

## 8. Métricas de éxito post-launch

- N/A — spec interna de deuda técnica de UI, sin métrica de producto.

---

## 9. Notas / decisiones abiertas

- [x] Origen del `p-6 pb-12`: investigado (2026-08-25) — padding elegido a mano desde las
  primeras versiones del componente, para dar cierre visual al fondo de la página cuando tenía
  scroll de documento normal. No es un parche de bug puntual. Decisión final se toma en
  `plan.md` al definir el nuevo shell.
- [x] **Decisión de rediseño tomada (usuario, 2026-08-25, sobre el render real — no estaba en el
  draft original):** Arqueo y Cierre Operativo deja de ser una columna sticky siempre visible y
  pasa a ser un **Drawer** (`LayoutDrawerFacadeService`). Egresos/Retiros ocupa el lugar que
  deja Arqueo en la columna derecha. "Cerrar Caja" se separa del flujo de Arqueo y va al Hero.
  Motivo: el contador de billetes/monedas, al activarse, agrandaba dramáticamente el card de
  Arqueo dentro de una columna de ancho fijo — llevarlo a un Drawer resuelve eso de raíz.
- [x] Nombre final del componente: `ArqueoCierreDrawerComponent` (selector `app-arqueo-cierre-drawer`,
  confirmado tal como se propuso).
- [x] **Ajuste sobre §5 durante la implementación:** el trigger del Drawer NO se abre desde un
  método nuevo en `CuadraturaFacade` como proponía la spec — se abre desde el **Smart wrapper**
  (`admin-contabilidad-cuadratura.component.ts`/`secretaria-...`), que ya inyecta
  `LayoutDrawerFacadeService` directo para los drawers de Ingreso/Egreso existentes en esta
  misma página. Se siguió ese precedente ya establecido en el propio código en vez del patrón
  de otros módulos (`ServiciosEspecialesFacade.openXDrawer()`).
- Originado de Asignación `ASG-b-082` (`specs/assignments/ASG-b-082-app-like-reportes-y-cuadratura.md`),
  dividida en 2 specs (`0003-i` y `0004-i`) a pedido del usuario en vez de una sola spec conjunta.

---

## Changelog

- 2026-08-24 — draft inicial por i
- 2026-08-25 — rediseño real tras discovery del componente + feedback visual del usuario sobre
  la página actual: Arqueo pasa de columna sticky a Drawer, Egresos ocupa su lugar, Cerrar Caja
  se mueve al Hero. ACs reescritos (AC1-AC6, antes AC1-AC4) para reflejar la estructura nueva
