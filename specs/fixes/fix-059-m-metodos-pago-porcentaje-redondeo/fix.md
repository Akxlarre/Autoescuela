# Fix: Porcentajes de Métodos de Pago del mes no suman 100%
> id: fix-059-m-metodos-pago-porcentaje-redondeo
> refs: —
> status: done
> closed: 2026-07-23
> created: 2026-07-23

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
En `PagosFacade.fetchMetodosPagoMes()`, cada método de pago redondea su porcentaje de forma independiente (`Math.round((m.total / grandTotal) * 100)`). Al redondear cada valor por separado, la suma de los porcentajes mostrados puede exceder o quedar por debajo de 100 (ej. valores reales de 87.5% y 12.5% redondean ambos hacia arriba a 88% y 13%, sumando 101%). Es el problema clásico de "redondeo a 100%" — falta un método que reparta el remanente/déficit de forma consistente (largest remainder method).

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
- Ninguno — fix autónomo (hallazgo de QA manual del usuario)

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo nuevo:** `src/app/core/utils/percentage.utils.ts` — función pura `roundPercentagesTo100(values: number[]): number[]` que implementa el método del mayor remanente (largest remainder): redondea hacia abajo todos los valores, calcula cuántos puntos faltan para llegar a 100, y los reparte de a uno en los valores con mayor parte fraccionaria descartada. Garantiza que la suma sea siempre exactamente 100 (cuando el total de entrada es > 0).
- **Archivo:** `src/app/core/facades/pagos.facade.ts` — `fetchMetodosPagoMes()` usa `roundPercentagesTo100()` sobre los totales de los 4 métodos en vez de redondear cada uno por separado.

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- `percentage.utils.spec.ts > roundPercentagesTo100 siempre suma exactamente 100 (caso 87.5/12.5 que antes daba 101)` ✓
