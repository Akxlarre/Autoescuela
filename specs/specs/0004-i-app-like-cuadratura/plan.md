# Plan 0004-i — App-like: cuadratura (`admin` + `secretaria`)

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-08-24

---

## 1. Resumen ejecutivo

Reestructurar `cuadratura-content.component.ts` (990 líneas, Dumb compartido entre `admin` y
`secretaria`): Arqueo y Cierre Operativo deja de ser una columna `sticky` siempre visible y pasa
a ser un **Drawer** nuevo (`app-arqueo-cierre-drawer`), abierto vía `LayoutDrawerFacadeService`
— exactamente el mismo patrón que ya usan "Agregar Ingreso"/"Agregar Egreso" en esta misma
página (`abrirIngreso`/`abrirEgreso`, ya enrutados por el Smart wrapper). Egresos/Retiros ocupa
el lugar que deja Arqueo en la columna derecha. "Cerrar Caja" se mueve al Hero. El shell pasa a
`.bento-grid--fill-screen` con `.bento-fill` en ambas columnas (Ingresos a la izquierda,
Egresos+resumen de Arqueo a la derecha), cada una con scroll interno independiente. Orden: (1)
extraer el contenido de Arqueo a un componente Drawer nuevo, (2) agregar `abrirArqueoDrawer()`
a `CuadraturaFacade`, (3) mover "Cerrar Caja" al Hero, (4) aplicar el shell fill-screen, (5)
`/verify`.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/shared/components/cuadratura-content/arqueo-cierre-drawer/arqueo-cierre-drawer.component.ts` | Organismo / Drawer (Smart-ish, mismo patrón que otros drawers del proyecto) | Contiene todo lo que hoy vive en el card `.bento-tall`: fondo de apertura, resumen ingresos/egresos efectivo, saldo, toggle de arqueo físico, contador de billetes/monedas, diferencia, justificación. **No** incluye el botón "Cerrar Caja" (se mueve al Hero) |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/shared/components/cuadratura-content/cuadratura-content.component.ts` | Quitar el card `.bento-tall` de Arqueo (se va al Drawer nuevo); Egresos pasa a la columna derecha; agregar resumen/botón que abre el Drawer; mover "Cerrar Caja" al `app-section-hero` (vía `heroActions`); aplicar shell `.bento-grid--fill-screen` con `.bento-fill` en ambas columnas | Núcleo del cambio |
| `src/app/core/facades/cuadratura.facade.ts` | Agregar `abrirArqueoDrawer()` (import dinámico de `LayoutDrawerFacadeService`, mismo patrón que `ServiciosEspecialesFacade.openAgregarServicioDrawer()`) | El Facade es el único autorizado a abrir el Drawer — el Dumb component no puede inyectar `LayoutDrawerFacadeService` directo |
| `src/app/features/admin/contabilidad-cuadratura/admin-contabilidad-cuadratura.component.ts` (y su par `secretaria`) | Verificar que sigan pasando los inputs correctos tras el refactor; conectar el nuevo trigger de Arqueo si el Smart wrapper es quien decide abrir el drawer (a confirmar en implementación cuál capa dispara `abrirArqueoDrawer()`) | Wrappers delgados, cambio menor esperado |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|
| Ninguno | El código de Arqueo se **mueve** al Drawer nuevo, no se borra |

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `LayoutDrawerFacadeService` — mismo patrón que ya usan "Agregar Ingreso"/"Agregar Egreso" en
  esta misma página (`abrirIngreso`/`abrirEgreso` outputs) y `ServiciosEspecialesFacade`/
  `HistorialCuadraturasFacade` en otros módulos. **De-riesgo importante:** esta página YA abre
  2 drawers desde el mismo patrón — agregar un 3ro (Arqueo) no es territorio nuevo.
- `app-section-hero` — ya en uso, se le agrega una acción más (`heroActions`) para "Cerrar Caja".
- `.bento-grid--fill-screen`, `.bento-fill` — modificador ya existente (2 filas: hero + contenido),
  **no hace falta crear uno nuevo** a diferencia de spec 0003-i, porque acá no hay múltiples
  filas fijas apiladas — es un layout de 2 columnas side-by-side dentro de una sola fila de
  contenido, y `.bento-fill` puede aplicarse a ambas columnas simultáneamente (el canon ya
  soporta `.bento-fill` en más de una celda por grid, ver `_bento-grid.scss`).

### Facades/Services existentes que extendemos
- `CuadraturaFacade` — agregar `abrirArqueoDrawer()`. Ya tiene `SupabaseService`, `AuthFacade`,
  `BranchFacade`, `ToastService` — se le suma el import dinámico de `LayoutDrawerFacadeService`.

### Componentes/Facades que NO existen y debemos crear
- `ArqueoCierreDrawerComponent` — no hay drawer de arqueo hoy, se crea nuevo (ver Inventario).

---

## 4. Modelo de datos

N/A — solo reestructuración de UI existente. No hay tablas, RLS ni migraciones nuevas. El Drawer
nuevo recibe los mismos datos que hoy recibe `cuadratura-content` para esa sección (fondo,
ingresos/egresos efectivo, saldo, `cajaYaCerrada`) — vía signals del Facade, no vía `input()`
(los Drawer abiertos por `LayoutDrawerFacadeService.open()` no soportan inputs, mismo patrón que
`HistorialEmisionesDrawerComponent`/`GenerarPendientesDrawerComponent`: inyectan el Facade
directo).

---

## 5. Arquitectura del feature

### Layout final (decisión del usuario, 2026-08-25, sobre el render real)

```
┌─────────────────────────────────────────────────────────────┐
│ Hero: "Cuadratura Diaria" + [Ver Historial] [Exportar] [Cerrar Caja] │  (fijo)
├───────────────────────────────┬───────────────────────────────┤
│ Columna izquierda (.bento-fill)│ Columna derecha (.bento-fill)  │
│                                 │                                 │
│ Registro de Ingresos            │ Egresos / Retiros               │
│ (toda la altura, scroll interno)│ (arriba)                        │
│                                 │                                 │
│                                 │ ─────────────────────────────  │
│                                 │ Resumen "Arqueo y Cierre" →     │
│                                 │ botón/card que abre el Drawer   │
└───────────────────────────────┴───────────────────────────────┘

Al hacer clic en el resumen de Arqueo:
┌─────────────────────────────────────────┐
│ Drawer: Arqueo y Cierre Operativo         │
│ ─────────────────────────────────────────│
│ Fondo de Apertura (editable)              │
│ Ingresos/Egresos en Efectivo (resumen)    │
│ Debe Haber en Caja                        │
│ Toggle: Realizar arqueo físico            │
│   @if activo → contador billetes/monedas  │
│   (el Drawer crece/scrollea internamente) │
│ Diferencia + Justificación                │
└─────────────────────────────────────────┘
(SIN botón "Cerrar Caja" — eso vive en el Hero)
```

### Diagrama de flujo (verbal)

```
AdminContabilidadCuadraturaComponent / SecretariaContabilidadCuadraturaComponent (Smart, delgados)
  └─ inject(CuadraturaFacade)
  └─ <app-cuadratura-content [inputs...]>  (Dumb, reestructurado)
        ├─ .bento-hero → <app-section-hero [actions]="heroActions()">  (incluye "Cerrar Caja")
        ├─ .bento-fill (izquierda) → Registro de Ingresos
        └─ .bento-fill (derecha)
              ├─ Egresos / Retiros
              └─ resumen/botón → (click) → facade.abrirArqueoDrawer()

CuadraturaFacade.abrirArqueoDrawer()
  └─ import dinámico de LayoutDrawerFacadeService (patrón ServiciosEspecialesFacade)
  └─ .open(ArqueoCierreDrawerComponent)

ArqueoCierreDrawerComponent (nuevo)
  └─ inject(CuadraturaFacade) directo (mismo patrón que otros *-drawer.component.ts)
  └─ Lee signals del Facade: fondoLocal, cantidades, notas, realizarArqueo, diferencia, etc.
  └─ (submit) → facade.guardarCierre(payload) — MISMA lógica que hoy, solo cambia dónde vive la UI
```

### Capas tocadas

- **Smart**: wrappers `admin`/`secretaria` — cambio menor, verificar conexión del trigger nuevo
- **Dumb**: `cuadratura-content.component.ts` — reestructuración de columnas + Hero action
- **Organismo/Drawer (nuevo)**: `arqueo-cierre-drawer.component.ts` — puede inyectar el Facade de
  su propio dominio (`CuadraturaFacade`), permitido para Organismos que se abren dinámicamente
  vía `LayoutDrawerFacadeService.open()` (`.claude/rules/architecture.md` §Organismo)
- **Facade**: `CuadraturaFacade` — nuevo método `abrirArqueoDrawer()`
- **Migration**: N/A

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — `cuadratura-content` sigue Dumb (solo `input()`/`output()`); el Drawer
  nuevo es Organismo (inyecta `CuadraturaFacade`, se abre dinámicamente vía
  `LayoutDrawerFacadeService.open()` — no tiene padre en ningún template, cumple el criterio de
  la regla)
- [x] `facades.md` — `CuadraturaFacade.abrirArqueoDrawer()` sigue el patrón de import dinámico ya
  documentado (`ServiciosEspecialesFacade.openAgregarServicioDrawer()`)
- [ ] `models.md` — N/A, no se tocan modelos DTO/UI existentes
- [x] `visual-system.md` — Bento Grid (`--fill-screen`, `.bento-fill` en 2 columnas), Drawer
  (`LayoutDrawerFacadeService`), sin colores hardcodeados
- [ ] `swr-pattern.md` — N/A, no cambia el patrón de carga de datos
- [ ] `notifications.md` — N/A
- [x] `testing-tdd.md` — `.spec.ts` para el Drawer nuevo si tiene lógica propia (ej. validación
  antes de submit); `CuadraturaFacade.abrirArqueoDrawer()` no necesita test de lógica compleja
  (solo abre el drawer, sin decisiones)
- [x] `ai-readability.md` — mantener `data-llm-action` existentes (`toggle-arqueo-efectivo`,
  `cerrar-caja-guardar`), agregar uno nuevo para el botón que abre el Drawer

---

## 7. Plan de testing

- Tests unitarios: si el Drawer nuevo extrae alguna lógica de validación (ej. "puede cerrar" ya
  existe como computed en el componente actual — verificar si se mueve tal cual o se testea de
  nuevo en el nuevo home).
- Tests de integración: N/A.
- QA manual (golden path + edge cases):
  - `/verify` en las 4 rutas (`admin`/`secretaria` × desktop/mobile).
  - Abrir el Drawer de Arqueo, activar el toggle de conteo físico → confirmar que el Drawer
    crece/scrollea internamente **sin afectar** el grid de fondo (Ingresos/Egresos siguen fijos).
  - Confirmar que "Cerrar Caja" en el Hero refleja el estado correcto (deshabilitado si falta
    justificación con diferencia ≠ 0, aunque el Drawer esté cerrado — el estado vive en el
    Facade/componente, no en el Drawer).
  - Confirmar que Egresos/Retiros ya no requiere scroll para verse (antes quedaba al fondo de
    la columna izquierda).
  - Confirmar `force-compact` con los drawers de Ingreso/Egreso ya existentes (no debe romperse).
  - Confirmar el contador táctil en mobile y con el Drawer abierto en 768px de alto.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| El estado de Arqueo (`cantidades`, `notas`, `realizarArqueo`, `fondoLocal`) hoy vive como signals **dentro de `cuadratura-content.component.ts`** (Dumb) — moverlo al Drawer nuevo sin pasar por el Facade podría dejar el estado "atrapado" en un componente que se destruye al cerrar el Drawer, perdiendo el conteo si el usuario lo cierra sin querer | Media | Evaluar en implementación si ese estado debe subir al `CuadraturaFacade` (signals compartidos, sobreviven al cierre del Drawer) en vez de vivir local al Drawer — decisión de diseño a tomar antes de codear, no asumir |
| El botón "Cerrar Caja" en el Hero necesita leer `puedeCerrar()`/`diferencia()`/`notas()` que hoy son computeds locales del card de Arqueo — si esos computeds se mueven al Drawer, el Hero (en el componente padre) no podría leerlos | Alta (si no se resuelve en el diseño) | Ligado al riesgo anterior: si el estado de Arqueo sube al Facade, tanto el Hero como el Drawer leen del mismo lugar sin problema. Si se decide mantenerlo local al Drawer, hay que exponerlo igual vía el Facade o replantear dónde vive "Cerrar Caja" |
| Layout de 2 columnas con `.bento-fill` en ambas simultáneamente no tiene precedente exacto en el rollout (siempre fue 1 columna fill + resto fijo) | Media | Verificar en navegador que el canon `.bento-grid--fill-screen > .bento-fill { contain:size }` funciona igual aplicado a 2 celdas hermanas — si no, puede necesitar ajuste (documentar como se hizo en 0003-i) |
| Perder el manejo de `force-compact` existente para Ingreso/Egreso al reestructurar | Baja | El CSS custom ya existente para `force-compact` se conserva tal cual para las 2 columnas — no se reimplementa desde cero (AC5) |

---

## 9. Orden de implementación

1. **Decisión de diseño previa (bloqueante):** ¿el estado de Arqueo (`cantidades`, `notas`,
   `realizarArqueo`, `fondoLocal`) sube al `CuadraturaFacade`, o se queda local al Drawer con
   algún mecanismo de persistencia? Resolver antes de escribir código (ver riesgos §8).
2. Crear `ArqueoCierreDrawerComponent` con el contenido movido del card `.bento-tall` (sin el
   botón "Cerrar Caja").
3. Agregar `CuadraturaFacade.abrirArqueoDrawer()`.
4. Reestructurar `cuadratura-content.component.ts`: Egresos a la derecha, resumen/botón de
   Arqueo, "Cerrar Caja" al Hero (`heroActions`), shell `--fill-screen` con `.bento-fill` en
   ambas columnas.
5. Decidir el destino del `p-6 pb-12` (AC-E1) — probablemente se reduce/quita al pasar a
   fill-screen (el "cierre visual" de fondo de página deja de aplicar del mismo modo).
6. `/verify` en las 4 rutas × 3 breakpoints, con foco en: Drawer de Arqueo creciendo sin romper
   el fondo, Hero con "Cerrar Caja" funcional, `force-compact` de los otros 2 drawers intacto.
7. Actualizar `indices/APP-LIKE-ROLLOUT.md`, `indices/COMPONENTS.md`, `indices/FACADES.md`.

---

## 10. Estimación

M — 1-3 días (componente Drawer nuevo + reestructuración de Facade + shell app-like, pero sin
backend nuevo).

---

## Changelog

- 2026-08-25 — plan generado con `/spec-plan` tras discovery del componente real (990 líneas) y
  decisión de rediseño del usuario (Arqueo → Drawer, Egresos a la derecha, Cerrar Caja al Hero).
  Talla M confirmada por el usuario
- 2026-08-25 — implementado y verificado en `/verify` real (admin + secretaria, desktop +
  mobile). 2 ajustes sobre el plan original: (1) el estado del arqueo (§1 "decisión previa
  bloqueante") se resolvió subiéndolo a `CuadraturaFacade`, confirmado necesario porque el
  Drawer no es hijo de `cuadratura-content`; (2) el trigger del Drawer se abre desde el **Smart
  wrapper** (`LayoutDrawerFacadeService` inyectado directo, como ya hacían "Agregar Ingreso"/
  "Agregar Egreso" en esta misma página), NO desde un método nuevo en el Facade como proponía
  §5 — se ajustó al precedente ya establecido en el propio código, no al patrón de otros
  módulos (`ServiciosEspecialesFacade.openXDrawer()`). El bug técnico original (contador
  agrandando la columna sticky) queda confirmado resuelto: crece dentro del Drawer sin afectar
  el grid de fondo
