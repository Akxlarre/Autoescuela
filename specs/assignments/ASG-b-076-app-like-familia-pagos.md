# Asignación ASG-b-076 — App-like: familia "pagos" (`admin` + `secretaria`)

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

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

## Checklist de cierre (rollout app-like)

- [ ] `force-compact` verificado con drawer abierto (ambas páginas)
- [ ] `.spec.ts` nuevo para AMBOS sets de `sliceByBudget`/`mobileShown` (Deudores Y Pagos
      Recientes) en CADA archivo (4 sets de tests en total, admin+secretaria × 2 listas) —
      obligatorio por `testing-tdd.md`
- [ ] `/verify` en ambas rutas, 390×844, 1440×900 y 768 de alto — atención especial a que 3
      bloques quepan razonablemente en 768px de alto
- [ ] Realtime/SWR: caso de prueba explícito de reset de scroll (2 pestañas, una registra un
      pago) — ver ítem 6 de "Edge cases estresados"

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — filas `/admin/pagos` y `/secretaria/pagos`
- `specs/assignments/ASG-b-066-app-like-familia-instructores.md` — patrón de densidad a copiar

## Archivos involucrados

- `src/app/features/admin/pagos/admin-pagos.component.ts`
- `src/app/features/secretaria/pagos/secretaria-pagos.component.ts`
