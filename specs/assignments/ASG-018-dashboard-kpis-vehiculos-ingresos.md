# Asignación ASG-018 — Fix H-001 + H-002 + H-008: Dashboard admin — KPIs y estados

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

3 hallazgos del Dashboard admin, todos cosméticos/de formato (no críticos, pero visibles todo el tiempo):
- **H-001**: KPI "Vehículos" siempre en 0 con 6 vehículos reales en Flota. Causa raíz confirmada: el seed inserta vehículos con `status='operational'`, pero `dashboard.facade.ts:281` compara contra `status==='available'` (nunca matchea). `flota.facade.ts` tiene un `resolveStatus()` que tampoco incluye `'operational'` y cae a un fallback que enmascara el mismo desajuste.
- **H-002**: KPI "Ingresos Mes" muestra `$0.18M` y `▼ 60vs mes pasado` (falta espacio y el símbolo `%`).
- **H-008**: cada clase en "Clases Actuales" muestra a la vez "Por Iniciar" y "Transcurriendo" — estados contradictorios en el mismo ítem.

## Alcance sugerido

- H-001: agregar `'operational'` al mapa de `resolveStatus()` en `flota.facade.ts`, y corregir la comparación en `dashboard.facade.ts:281` para usar el mismo mapeo canónico.
- H-002: revisar el pipe de formato de moneda/porcentaje usado en el KPI grande vs. el resto de la app.
- H-008: revisar la lógica que calcula "Por Iniciar" vs "Transcurriendo" — probablemente una de las dos etiquetas usa un umbral de tiempo incorrecto.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgos H-001, H-002, H-008.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/dashboard.facade.ts`
- `src/app/core/facades/flota.facade.ts`
- `src/app/features/dashboard/dashboard.component.ts`

## Notas para quien la reclame

- ⚠️ **Coordinar con ASG-005** (cobertura `data-llm-*`, también toca `dashboard.component.ts`) — avisarse antes de editar en paralelo.
