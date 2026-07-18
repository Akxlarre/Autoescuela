# Hotfix: espaciado entre cards en drawer "Registrar Cobro" (curso singular)

## Problema
En `admin-curso-singular-cobro-drawer.component.ts`, las cards (resumen del curso, stat-boxes,
lista de inscriptos, nota SENCE) se proyectan directamente dentro de `<app-drawer-form>` sin un
wrapper con `gap`, por lo que quedan pegadas entre sí.

## Fix
Envolver el contenido proyectado en `<div class="flex flex-col gap-4">`, igual que el patrón usado
en el drawer hermano `admin-curso-singular-detalle-drawer.component.ts:71`.

## AC
- Las cards del drawer de cobro tienen separación visual (gap-4) entre sí, igual que el drawer de detalle.
