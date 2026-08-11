# Fix: Skeleton de la tabla de resultados no coherente en `/admin/clase-profesional/archivo`
> id: fix-151-m-skeleton-tabla-archivo-profesional
> refs: —
> status: done
> closed: 2026-08-11
> created: 2026-08-11

## Root Cause
El skeleton de carga que se muestra al seleccionar un curso (`facade.isLoadingAlumnos()`)
renderiza 5 barras genéricas de ancho completo (`<app-skeleton-block variant="text" width="100%"
height="44px" />` en un `flex flex-col`), sin ninguna relación con la estructura real de la
tabla que reemplaza: columna "Alumno" (sticky, con avatar circular + nombre + rut), Teoría,
Práctica, M1–M7, Promedio y Estado. El usuario ve un placeholder que no anticipa el layout que
va a cargar — detectado durante QA visual de fix-150 (rollout app-like de esta misma página).

## ACs Afectados
Ninguno — fix autónomo (fidelidad visual de skeleton, no ligado a un AC de negocio).

## Cambio
- **Archivo:** `src/app/features/admin/profesional-archivo/admin-profesional-archivo.component.ts`
- **Qué cambia:** reemplazar el bloque `@if (facade.isLoadingAlumnos())` (skeleton genérico)
  por una versión que aproxime la forma real de las filas: fila con avatar circular +
  dos líneas de texto (nombre/rut) en la zona "Alumno", y bloques rectangulares angostos para
  Teoría/Práctica/M1-M7/Promedio/Estado — usando `<app-skeleton-block>` con `variant`/`width`
  ajustados por columna, siguiendo el mismo patrón de fidelidad ya usado en otros skeletons de
  tabla del proyecto (ver `indices/COMPONENTS.md` / precedente fix-038-m-drawer-skeletons-fidelity).

## Test de Regresión
- [x] Verificación visual manual (`/verify`) en `/admin/clase-profesional/archivo`: al
      seleccionar una promoción + curso, el skeleton muestra encabezados reales (Alumno,
      Teoría, Práctica, M1-M7, Promedio, Estado), avatar circular + 2 líneas de texto en la
      columna sticky, y celdas angostas por columna — confirmado con red throttleada
      (`window.fetch` parcheado con delay de 3s) en desktop y mobile.
- [x] Datos reales cargan sin errores tras resolver el skeleton (consola limpia, KPIs y filas
      correctas).
