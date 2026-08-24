# Fix: Eliminar la ruta inalcanzable "Asistencia — Matriz General" de secretaria
> id: fix-210-m-eliminar-asistencia-matriz-inalcanzable
> refs: —
> status: done
> closed: 2026-08-24
> created: 2026-08-24

## Root Cause
`secretaria/asistencia/matriz` es una ruta viva que carga
`SecretariaAsistenciaMatrizComponent`, un placeholder de 41 líneas cuyo hero dice
*"Asistencia — Matriz General / Vista consolidada de asistencia por alumno y sesión"* y cuyo
cuerpo es un cartel "Próximamente".

No tiene **ninguna** vía de acceso: cero ítems de menú, cero `routerLink`, cero navegaciones
programáticas — solo aparece en `app.routes.ts`. Admin no tiene equivalente. Es un resto de la
etapa de calcar mockups.

No confundir con las otras dos "matrices" del proyecto, que **sí existen y ya las tienen ambos
roles**:
- `week-matrix.component.ts` — matriz semanal de Clase Profesional (días × Teoría/Práctica),
  dentro de Asistencia Prof.
- la matriz de notas de `evaluaciones-profesional-content`.

La idea específica de esta ruta (grilla alumno × sesión para Clase B) no existe en ningún rol; la
asistencia de Clase B se ve hoy como lista de clases prácticas + ciclos teóricos vía
`asistencia-clase-b-content`.

## Decisión del dueño (2026-08-24)
Borrarla. Si más adelante se quiere una vista consolidada de asistencia de Clase B, conviene
especificarla de cero en vez de heredar un placeholder vacío.

## ACs Afectados
Ninguno — fix autónomo. Detectado en la auditoría de paridad admin/secretaria (2026-08-24).

## Cambio
- **Archivo:** `src/app/app.routes.ts`
  **Qué cambia:** se elimina la ruta `asistencia/matriz` del bloque `secretaria`.
- **Archivo:** `src/app/features/secretaria/asistencia-matriz/secretaria-asistencia-matriz.component.ts`
  **Qué cambia:** se **elimina**.
- **Archivos:** `indices/*.md`
  **Qué cambia:** se quitan las referencias a la página eliminada.

## Test de Regresión
- `npx ng build` sin errores (garantiza que no queda ninguna referencia al componente ni a su ruta).
- `npm run lint:arch` sin errores nuevos.
- Verificación: `grep asistencia-matriz` en `src/` sin resultados.
