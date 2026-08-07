# Asignación ASG-b-076 — App-like: familia "pagos" (`admin` + `secretaria`)

> **status:** reclamada
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** m
> **claimed_at:** 2026-08-06
> **resulting_track:** fix-132-m-app-like-familia-pagos

---

## Contexto / Objetivo

Paso 9 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`) — página de mayor tráfico de este
lote. `AdminPagosComponent` y `SecretariaPagosComponent` son casi duplicados línea-por-línea (no
comparten un `*-content`, son 2 archivos separados — aplicar el mismo cambio en ambos).

**Corrección importante sobre la primera pasada del audit:** NO son 2 tablas — son **3 bloques
SIEMPRE visibles** apilados en 1 sola `.bento-banner`: (1) Deudores (paginación hand-rolled), (2)
fila 2-columnas `lg:col-span-8`/`lg:col-span-4` con Pagos Recientes (paginada) + sidebar Métodos
de Pago.

**Decisión de diseño ya tomada con el owner (2026-08-02, no re-discutir):** NO usar tabs
(Deudores/Pagos) como sugería la primera pasada del audit — hoy todo es visible a la vez y
esconder Pagos Recientes detrás de un click cambiaría el flujo de trabajo real de la secretaria.

Plan:
1. Root → `bento-grid--fill-screen-2`.
2. Fila 1 = Deudores `.bento-fill`: sacar paginación hand-rolled, mismo patrón
   `LayoutService`+`mobileShown`+`sliceByBudget`+"Cargar más" que instructores (ASG-b-066).
3. Fila 2 = Pagos Recientes + sidebar Métodos de Pago, AMBAS `.bento-fill` compartiendo la fila
   (comparten la misma `minmax(0,1fr)`). Pagos Recientes: mismo tratamiento de paginación que
   Deudores. Sidebar: probablemente estático, `bento-fill flex flex-col h-full` con
   `overflow-y-auto` defensivo.

## ⚠️ Decisión revisada durante la implementación (2026-08-06)

El plan de arriba (fila 2 con Pagos Recientes + sidebar compartiendo `.bento-fill`) se
implementó primero tal cual y se descartó tras verificar con Playwright: en un laptop típico
(1440×900) la fila de Pagos Recientes quedaba con solo 220px totales — su header (buscador + 2
selects) y footer ya consumían casi todo ese espacio, dejando **0 filas de pago visibles**. A
768px de alto la situación era peor. La premisa "un split de filas visible siempre tiene
espacio suficiente" (base de la decisión "NO tabs" de 2026-08-02) no se sostuvo con datos reales
en esta página concreta (a diferencia de instructores/secretarias, que sí tienen headers
livianos).

**Decisión nueva, tomada con el dueño:** Deudores pasa a ser el único bloque de contenido
(pantalla completa, `bento-grid--fill-screen`). Pagos Recientes + Métodos de Pago se movieron a
un **drawer** (`PagosRecientesDrawerComponent`, scroll nativo sin límite de alto), abierto con
un botón "Pagos Recientes" en el hero — la misma idea de "esconder detrás de un click" que la
decisión original rechazaba, pero ahora justificada por evidencia concreta de que la
alternativa (todo visible) no rendereaba filas reales en viewports típicos. Deudores además
ganó paginador real (10/página) en desktop, igual que `alumnos-list-content` ("Base Alumnos
B"), en vez de scroll interno sin límite.

**Para quien lea esto en el futuro:** si vas a aplicar "NO tabs/drawer" como precedente en otra
página de este rollout, primero medí con `/verify` si el contenido real cabe — no asumas que
"todo visible" siempre es mejor UX que un drawer bien señalizado.

## Checklist de cierre (rollout app-like)

- [x] `force-compact` verificado con drawer abierto (ambas páginas) — ya no aplica el split de
      columnas (Deudores es la única celda), pero se verificó que Deudores se compacta bien con
      el drawer de Pagos Recientes abierto (`.deudores-compact`)
- [x] `.spec.ts` nuevo para densidad de Deudores (paginador desktop + `sliceByBudget`/
      `mobileShown` mobile) en CADA archivo, más `.spec.ts` de filtros para
      `PagosRecientesDrawerComponent` (compartido, un solo archivo) — obligatorio por
      `testing-tdd.md`
- [x] `/verify` en ambas rutas, 390×844, 1440×900 y 1440×768 — confirmado que Deudores +
      drawer caben sin overflow ni filas invisibles en los 3 tamaños
- [ ] Realtime/SWR: caso de prueba explícito de reset de scroll (2 pestañas, una registra un
      pago) — ver ítem 6 de "Edge cases estresados" — **pendiente**, no verificado en esta
      sesión (requiere 2 pestañas simultáneas)

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — filas `/admin/pagos` y `/secretaria/pagos`
- `specs/assignments/ASG-b-066-app-like-familia-instructores.md` — patrón de densidad a copiar
- `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` — patrón
  de paginador real (desktop) + `sliceByBudget`/"Cargar más" (mobile) copiado para Deudores

## Archivos involucrados

- `src/app/features/admin/pagos/admin-pagos.component.ts`
- `src/app/features/secretaria/pagos/secretaria-pagos.component.ts`
- `src/app/features/admin/pagos/pagos-recientes-drawer.component.ts` (nuevo)
