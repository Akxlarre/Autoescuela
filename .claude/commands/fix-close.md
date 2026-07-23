---
description: Cerrar el fix track activo (marca como done, limpia .active)
argument-hint: ""
allowed-tools: Read, Write, Bash, Glob
---

# /fix-close — Cerrar el Fix Track Activo

## Procedimiento

1. Leer `specs/.active`:
   - Si está vacío → error "No hay fix track activo. Nada que cerrar."
   - Si el ID NO empieza con `fix-` → error "El activo es una spec, no un fix. Usa /spec-verify para cerrarla."

2. Leer `specs/<id>/fix.md`:
   - Si no existe → error "fix.md no encontrado en specs/<id>/. El fix track está corrupto."

3. Verificar el test de regresión:
   - Leer la sección "Test de Regresión" del fix.md
   - Si hay un test listado, mostrar al usuario:
     ```
     ⚠️  Antes de cerrar, verificá que el test de regresión esté verde:
         <test listado en fix.md>
     ¿Confirmás que el test está verde? (el cierre no lo corre automáticamente)
     ```
   - Continuar con el cierre (el usuario es responsable de confirmar)

4. Actualizar `fix.md`:
   - Cambiar `status: in_progress` → `status: done`
   - Agregar `closed: <fecha de hoy>` después del campo `status:`

5. Limpiar `specs/.active`:
   - Escribir contenido vacío (una línea en blanco)

6. Imprimir confirmación:
   ```
   ✅ Fix <id> cerrado.
   
   Resumen:
     - specs/<id>/fix.md → status: done
     - specs/.active → vacío
   
   El spec-gate volverá a bloquear escrituras en código de producto.
   Si querés continuar con una spec, usá /spec-activate <id>.
   ```

## Notas

- `/fix-close` NO hace commit. El usuario commitea cuando quiera.
- Si el fix descubrió scope adicional durante la implementación → crear spec nueva ANTES de cerrar.
- Un fix cerrado no se reabre. Si surge otro problema → `/fix-new` con nuevo ID.
