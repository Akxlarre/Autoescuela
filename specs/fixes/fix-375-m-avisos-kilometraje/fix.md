# Fix: iniciar y finalizar clase no avisan kilometrajes sospechosos
> id: fix-375-m-avisos-kilometraje
> refs: fix-366-m-testing-asistencia-clase-b (C04, D03) · ASG-i-027
> status: done
> closed: 2026-10-11
> created: 2026-10-11

## Síntoma

Bloque 2 de `fix-366-m`:
- **C04:** al iniciar con 1.000 km un vehículo que está en 300.015 km, no hay aviso.
- **D03:** al finalizar con +5.000 km de recorrido en una clase, no hay aviso.

## Root Cause

Los drawers de Iniciar y Finalizar solo validan rango (≥ 0, ≤ 999.999) y que el km de retorno sea
mayor al de salida.

## Fix

**Decisión de Matías (2026-10-11):** que avise.

Función pura `kmWarning()` en `core/utils/odometer.utils.ts`:
- Iniciar: km menor al `current_km` del vehículo → "Es menor al kilometraje registrado del
  vehículo (N km). Revisa el odómetro." Mayor por más de 300 km → "Supera por mucho el
  kilometraje registrado (N km)…".
- Finalizar: recorrido mayor a 300 km → "Son N km en una clase. Revisa el odómetro."

Es un aviso (ámbar), no bloquea: el odómetro real manda.

## Acceptance Criteria

- [x] AC1 — Iniciar con km menor al del vehículo muestra el aviso.
- [x] AC2 — Iniciar con km muy por encima (+300) muestra el aviso.
- [x] AC3 — Finalizar con un recorrido de más de 300 km muestra el aviso.
- [x] AC4 — El aviso no impide guardar.

## Regression Test

`odometer.utils.spec.ts` → `kmWarning`. Verificación en navegador.

## Verificación (2026-10-11)

Drawer de Iniciar (BBCD12 en 2.085 km), km 10 → "Es menor al kilometraje registrado del vehículo
(2.085 km). Revisa el odómetro." y "Comenzar Clase" sigue habilitado; al volver a 2.085 el aviso
desaparece. Drawer de Finalizar (salida 1.000), retorno 6.500 → "Son 5.500 km en una clase. Revisa
el odómetro." con "Cerrar Clase" habilitado. `kmWarning` 5 tests; drawers con tests del aviso.
