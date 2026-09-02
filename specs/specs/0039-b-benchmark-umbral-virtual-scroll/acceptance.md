# Acceptance 0039-b — Benchmark empírico del umbral de virtual scroll

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Medido:** 2026-09-01
> **Verificado:** 2026-09-01 · pendiente visto bueno del owner
> **Veredicto del benchmark:** el umbral estimado de **300 filas se CONFIRMA** (AC2). El re-render
> supera los 200 ms en volúmenes que el negocio alcanza dentro del horizonte de 5 años → **AC3 no
> aplica, AC4 sí**: corresponde implementar.

---

## Veredicto final: ✅ PASA

- AC totales: **9** (6 + 3 edge cases) — **9 cumplidos**
- Suite: **2.273 passed / 2 skipped (182 archivos), exit 0**
- `tsc --noEmit` limpio · `lint:arch` exit 0
- Tests nuevos del track: **9/9** (`servicios-especiales-content.component.spec.ts`)
- QA visual en navegador real: página `/app/admin/servicios-especiales` con datos reales

### Resultado de la implementación (medido antes/después, mismo escenario)

| Métrica (2.000 ventas, "Todo el historial") | Antes | Después |
|---|---:|---:|
| Bloqueo del hilo principal | 1.371 ms | **70 ms** |
| Subtrees renderizados | 4.000 | **20** |
| Nodos DOM | 77.903 | **702** |

Y ahora es **constante**: 702 nodos entre N=100 y N=5.000, verificado en 4 volúmenes.

---

## Condiciones de la medición (declaradas — AC1)

| Parámetro | Valor |
|---|---|
| Superficie | `app-servicios-especiales-content` (historial de ventas) montado en el harness `_bench-0039` |
| Datos | Sintéticos en memoria, repartidos en 5 años hacia atrás. Ninguna BD tocada |
| Build | **Desarrollo** (`ng serve`), no producción |
| CPU throttling | **Ninguno** — ver §Sesgos, es una limitación real de esta medición |
| Viewport | 1280×720, DPR 1 |
| Métrica | `blocking` = suma de `PerformanceObserver({entryTypes:['longtask']})` durante el re-render. **No** se usa `wall`: está dominado por los ~400 ms constantes de la animación del dropdown de PrimeNG, que no es trabajo de renderizado |
| Interacción medida | Cambio del selector de período de "Últimos 12 meses" a "Todo el historial" — re-render puro, sin generación de datos |

## Resultados (AC1, AC2)

| N ventas | Filas renderizadas | Bloqueo del hilo principal | Subtrees en DOM | Nodos DOM | ms/fila |
|---:|---:|---:|---:|---:|---:|
| 100 | 100 | 96 ms | 200 | 4.183 | 0,96 |
| 200 | 200 | 133 ms | 400 | 8.063 | 0,67 |
| 250 | 250 | 155 ms | 500 | 10.003 | 0,62 |
| **300** | **300** | **244 ms** ⚠️ | 600 | 11.943 | 0,81 |
| 600 | 600 | 411 ms | 1.200 | 23.583 | 0,69 |
| 1.000 | 1.000 | 654–774 ms | 2.000 | 39.103 | 0,65 |
| 2.000 | 2.000 | 1.371 ms | 4.000 | 77.903 | 0,69 |

**Costo marginal: ~0,66 ms por fila**, notablemente lineal en todo el rango (0,62–0,96).

**Cruce de los 200 ms: entre 250 y 300 filas (≈ 290).** El 300 estimado en
`docs/research/listas-grandes-virtual-scroll.md` §4 resultó casi exacto — se **confirma**, no se
ajusta ni se refuta.

## Verificación por AC

### AC1 — Medición con ≥1.000 filas y condiciones declaradas
✅ Cumplido. Medido hasta 2.000. Condiciones en la tabla de arriba, incluida la limitación de no
haber podido aplicar throttling.

### AC2 — Veredicto sobre el umbral de 300
✅ Cumplido: **confirmado**. Cruce empírico en ≈290 filas.

### AC3 — Si el re-render se mantiene bajo 200 ms → no implementar
✅ Evaluado, **no se cumple la condición**: 244 ms a 300 filas, 774 ms a 1.000.

El criterio decisivo es el de la propia asignación: *"solo si el benchmark confirma jank real **por
debajo del acumulado proyectado a 5 años**"*. La proyección de la investigación para
`special_service_sales` es de **300–1.200 registros a 5 años** (§2, 60–240/año). El jank arranca en
≈290 filas, es decir **por debajo incluso del piso** de esa proyección. Corresponde implementar.

### AC4 — Implementación
🔲 Pendiente — **con una corrección de rumbo respecto de lo que este AC decía**, ver §Hallazgo que
cambia el diseño.

### AC5 — Ningún harness queda en producción
🔲 Pendiente (T9). Vive en `src/app/features/_bench-0039/` + ruta `bench-0039` en `app.routes.ts`,
documentado como temporal en `indices/COMPONENTS.md`.

### AC6 — ex-alumnos documentadas como fuera de riesgo con evidencia
✅ Cumplido, con archivo y línea:
- `ex-alumnos-content.component.ts:162-172` → `<p-table [rows]="10" [paginator]="true">`
- `ex-alumnos-profesional-content.component.ts:156-159` → idem

El DOM de esas dos nunca supera 10 filas sin importar el volumen. Virtualizarlas no puede mejorar
nada. **La investigación de 2026-08-03 las clasificó como "mostrar todo + scroll interno", y eso
hoy es falso** — probablemente lo corrigió `0007-i` sin proponérselo.

### AC-E1 — Conteo real de nodos, contando la vista oculta
✅ Cumplido y **confirmado empíricamente**: en cada medición `rows === cards === N`. Las dos vistas
(tabla desktop y tarjetas mobile) coexisten en el DOM porque se alternan con CSS
(`@container svc-historial` + `display:none`), no con `@if`. Con N ventas Angular crea y mantiene
**2N** vistas embebidas. A 2.000 ventas: 4.000 subtrees y **77.903 nodos DOM**.

### AC-E2 — Medir el cambio de filtro, no solo la carga
✅ Cumplido: con 2.000 ventas en "Todo el historial", filtrar a un solo servicio (2.000 → 500
filas) bloquea **192 ms**.

### AC-E3 — Margen que aporta la ventana por defecto de `0038-b`
✅ Cumplido y es el dato que salva la situación actual: con 1.000 ventas sembradas, la ventana por
defecto de 12 meses renderiza **201 filas (~133 ms)**, mientras que "Todo el historial" renderiza
1.000 (**774 ms**). `0038-b` mantiene el caso común por debajo del umbral; **el problema vive
exclusivamente en el escape hatch**.

---

## Hallazgo que cambia el diseño de la implementación

**La mitad del costo es renderizar una vista que nadie mira.** El factor ×2 de AC-E1 no es un
detalle: a 1.000 ventas son 1.000 tarjetas construidas y mantenidas en el DOM que el usuario de
escritorio nunca ve (y 1.000 filas de tabla que el de móvil nunca ve).

Esto reordena las opciones respecto de lo que AC4 asumía cuando se redactó (antes de medir):

1. **Eliminar el ×2** (renderizar solo la vista activa) es el fix más barato y baja el costo a la
   mitad — pero **no alcanza solo**: a 1.200 filas quedaría en ~395 ms, todavía sobre el umbral.
2. **`p-table [virtualScroll]`** (lo que decía AC4) resuelve el desktop, pero **no cubre la vista
   de tarjetas** — esa necesitaría `cdk-virtual-scroll-viewport`, que la investigación descartó
   explícitamente (§3: *"el proyecto no lo usa hoy en ningún lado"*).
3. **Acotar las filas renderizadas (paginar)**, que es **lo que las 2 superficies hermanas ya
   hacen** (`ex-alumnos` B y Profesional, `p-table [paginator] [rows]="10"`). Deja el DOM en ~10
   filas para siempre, independiente de N. Es el precedente vivo del propio proyecto para
   exactamente este problema.

La tensión: la investigación (§3) **rechazó** paginar por contradecir la decisión de UX de las
specs 0028-0031 ("ver todo lo filtrado de un vistazo")... pero ese rechazo ya no describe al
código: las dos listas históricas hermanas **están paginadas hoy**. `servicios-especiales` es la
excepción que nunca recibió ese tratamiento, no el estándar que las otras abandonaron.

Decidir entre (2) y (3) es una elección de UX con riesgo distinto — y la superficie está bajo UAT
activa con el cliente. **Elevada al owner antes de implementar.**

## Sesgos de la medición (declarados)

Dos sesgos que empujan en direcciones opuestas y no se cancelan de forma verificable:

- **Build de desarrollo** → *sobreestima* el costo. Producción suele ser 1,5–2× más rápido.
- **Sin throttling, en máquina de desarrollo** → *subestima* el costo. El hardware de oficina que
  pide la asignación suele ser 2–4× más lento.

**La conclusión es robusta a ambos:** incluso asumiendo el mejor caso de producción (2× más
rápido), el techo proyectado a 5 años (1.200 filas) queda en ~395 ms, todavía ~2× sobre el umbral.
La decisión de implementar no depende del factor incierto.

## Reproducir

```
/bench-0039  →  __bench0039.seed(N)  →  cambiar el selector de período a "Todo el historial"
```
Métrica con `PerformanceObserver({entryTypes:['longtask']})`, no con tiempo de pared.
