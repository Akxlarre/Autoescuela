# Fix: 3 cosméticos — label Agenda inconsistente, texto RBAC engañoso, chips "P" ambiguos
> id: fix-010-i-cosmeticos-agenda-rbac-chips
> refs: ASG-b-028
> status: in_progress
> created: 2026-07-31

## Root Cause
[Heredado de ASG-b-028, a confirmar]: 3 hallazgos cosméticos pequeños, sin relación entre sí:
- **H-010**: en Agenda, el selector de instructor muestra "Todos los instructores" al entrar, pero en realidad ya cargó un instructor específico (el primero de la lista) — label inconsistente con el estado real.
- **H-014**: en `/app/secretaria/contabilidad/reportes`, la sección "Gastos Fijos del Período" dice en su propio subtítulo "solo visible para admin", pero se muestra igual a la secretaria (incluido el botón "Registrar Gasto Fijo") — o sobra la sección (fuga RBAC) o el texto miente.
- **H-018**: en el Dashboard del alumno, "Asistencia reciente" muestra chips "P" sobre fechas que en "Mis Clases" figuran como Inasistencia — ambiguo si "P" significa "Práctica" o "Presente" (y en este último caso, sería incorrecto).

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
- **H-010** (`src/app/features/admin/agenda/admin-agenda.component.ts`): cambiar el label inicial para reflejar el instructor realmente cargado, o cargar "todos" de verdad si eso es lo esperado.
- **H-014** (`src/app/features/secretaria/contabilidad-reportes/secretaria-contabilidad-reportes.component.ts`): decidir si la sección "Gastos Fijos del Período" debe ocultarse para secretaría (fuga RBAC real, dado que `fixed_expenses` es solo-admin per RLS) o si el texto está desactualizado y debe corregirse.
- **H-018** (`src/app/features/alumno/dashboard/alumno-dashboard.component.ts`): aclarar el significado de "P" (texto completo o ícono sin ambigüedad) y verificar que coincida con el estado real de asistencia.

## Test de Regresión
- Pendiente de definir al implementar, una vez investigado cada archivo.
