# Hotfix: Skeleton de la tabla de alumnos no coincide con las columnas reales
> id: hotfix-046-m-skeleton-alumnos-columnas-desalineadas
> status: done
> closed: 2026-07-25
> created: 2026-07-25

## Problema
El skeleton de carga de `AlumnosListContentComponent` (vista desktop, `alumnos-list-content.component.ts:227-258`) quedó desalineado con la tabla real: (1) nunca contempló la columna "Sede" agregada en fix-064 (condicionada a `showSedeColumn()`), y (2) los bloques del skeleton son 7 barras genéricas de ancho fijo que no reflejan el contenido real de cada columna (Nº Exp. son chips cortos, Curso es un badge redondeado, Estado/Expediente son `p-tag` — hoy todos se ven como simples barras de texto o `rect`, algunos ya correctos pero el conjunto no fue revisado tras agregar Sede).

## Cambios
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` — header skeleton (línea ~227): agregar bloque condicional `@if (showSedeColumn())` entre Curso y Fecha Ingreso, igual que la columna real. Row skeleton (línea ~237): mismo bloque condicional con un `app-skeleton-block variant="text"` de ancho acorde a un nombre de sede.
