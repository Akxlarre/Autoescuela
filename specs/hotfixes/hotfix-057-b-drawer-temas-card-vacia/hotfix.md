# Hotfix: El drawer de Temas Clase B deja una tarjeta vacía cuando la carga falla
> id: hotfix-057-b-drawer-temas-card-vacia
> status: done
> closed: 2026-09-22
> created: 2026-09-22

## Problema
Encontrado en la verificación visual de `fix-169-b` (`/verify`). Si la malla no carga —hoy porque
la migración no está aplicada, mañana por un fallo de red o de RLS— el drawer muestra el banner de
error y, debajo, **una tarjeta con borde y sin contenido**: el `<ul class="card">` se renderiza
igual con cero `<li>`. Se ve como un hueco sin explicación.

Ningún probe automático lo detecta: no hay error de consola, ni clase muerta, ni overflow. Solo
se ve mirando la captura.

## Cambios
- **Archivo:** `src/app/features/admin/configuracion-academica/class-b-topics-drawer.component.ts`
  — la lista solo se renderiza si hay temas que mostrar; si no hay ninguno, el banner de error
  queda solo, sin la tarjeta vacía debajo.
