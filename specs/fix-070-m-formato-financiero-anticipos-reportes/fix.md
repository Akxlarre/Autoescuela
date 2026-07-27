# Fix: Anticipos muestra enum crudo "both" sin traducir, KPIs financieros sin separador de miles + "Otros (Sede 0)" sin resolver nombre
> id: fix-070-m-formato-financiero-anticipos-reportes
> refs: ASG-020
> status: in_progress
> created: 2026-07-27

## Root Cause

[Heredado de ASG-020, a confirmar]: 2 hallazgos de formato en módulos financieros:
- **H-004**: en Anticipos (`/app/admin/contabilidad/anticipos`), la columna TIPO muestra el enum crudo `both` para algunos instructores en vez de "Teórico y Práctico" (mismo valor, mapeo incompleto).
- **H-005**: los KPIs grandes de Reportes (`$ 180000`) y Cursos Singulares (`$220000`) omiten el separador de miles, mientras las tablas de las mismas páginas sí lo usan (`$180.000`). Además, en Reportes aparece una categoría "Otros (Sede 0)" — nombre de sede sin resolver, cae al id crudo.

## ACs Afectados

- Ninguno — fix autónomo, encadenado a ASG-020 (no proviene de una spec).

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `ruta/al/archivo.ts`
- **Qué cambia:** ...

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- `ruta/archivo.spec.ts > nombre del test` ✓
