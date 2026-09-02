# Tasks 0039-b — Benchmark empírico del umbral de virtual scroll

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Evidencia:** [acceptance.md](./acceptance.md)
> **Estado del track: LISTO PARA CERRAR** — todas las tareas cumplidas.

---

## Progreso

- [x] **T1** — Auditar en código qué superficies tienen DOM sin techo.
      *DoD:* tabla de 3 superficies con archivo:línea (`spec.md` §1.2). Resultado: **3 → 1**.
- [x] **T2** — Cerrar el contrato con ACs que admitan "no implementar" como éxito.
      *DoD:* 6 AC + 3 edge cases, con umbral de decisión numérico (200 ms INP).
- [x] **T3** — Harness de benchmark con datos sintéticos en memoria.
      *DoD:* montaba el Dumb real; `__bench0039.seed(n)` cambiaba volumen sin recompilar.
- [x] **T4** — Medir re-render por volumen (100 → 2.000).
      *DoD:* 7 puntos medidos, ~0,66 ms/fila lineal. Tabla en `acceptance.md`.
- [x] **T5** — Medir conteo real de nodos incluyendo la vista oculta (AC-E1).
      *DoD:* factor **×2 confirmado** — `rows === cards === N` en cada medición.
- [x] **T6** — Medir ventana por defecto vs "Todo el historial" (AC-E3).
      *DoD:* 201 filas (~133 ms) vs 1.000 filas (774 ms) con 1.000 ventas sembradas.
- [x] **T7** — Veredicto sobre el umbral de 300.
      *DoD:* **confirmado** — cruce empírico de los 200 ms en ≈290 filas.
- [x] **T8** — Implementar (el veredicto dio ≥ 200 ms).
      *DoD:* `<p-paginator>` único alimentando AMBAS vistas. **1.371 → 70 ms**, **77.903 → 702**
      nodos, constantes hasta N=5.000. Decisión del owner: paginar, no virtual scroll (ver AC4).
- [x] **T8b** — Tests de la lógica nueva (`testing-tdd.md`).
      *DoD:* `servicios-especiales-content.component.spec.ts`, **9/9 verdes** — incluye el caso de
      página fuera de rango.
- [x] **T9** — Borrar el harness (AC5).
      *DoD:* componente, carpeta y ruta eliminados. `grep bench-0039 src/` → 0 resultados. Fila
      quitada de `COMPONENTS.md`.
- [x] **T10** — Actualizar la investigación con el resultado real.
      *DoD:* `docs/research/listas-grandes-virtual-scroll.md` §4 con el bloque RESUELTO y los 3
      hallazgos que cambiaron el cuadro.
- [x] **T12** — Verificación visual en la app real.
      *DoD:* `/app/admin/servicios-especiales` renderiza con datos reales (5 ventas); paginador
      correctamente **oculto** con ≤ 10 filas.
- [x] **T11** — Validar y sincronizar.
      *DoD:* `tsc --noEmit` limpio · `lint:arch` exit 0 (único hallazgo sobre el archivo: ARCH-09
      de tamaño, **pre-existente**) · **`npm run test:ci` verde: 2.273 tests / 182 archivos
      pasados, 2 skipped, exit 0** · `COMPONENTS.md` y la investigación actualizados.
- [x] **T13** — Cierre formal del track.
      *DoD:* `acceptance.md` con los 6 AC + 3 edge cases verificados y veredicto **✅ PASA**.

---

## Nota de harness (para `/harness-feedback`)

El AC Verifier reconoce "trabajo en progreso" buscando items `[ ]`, pero la tabla de tareas que
veníamos usando marcaba el estado con emoji (`✅`/`🔲`) en una columna. Con ese formato el hook no
detectaba la declaración honesta de avance parcial y bloqueaba el cierre en cada turno, aunque el
propio `tasks.md` dijera que T11 seguía abierta. Este archivo pasó a checkboxes por eso.
