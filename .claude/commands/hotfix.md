---
description: Crear un hotfix track SDD para correcciones donde el "cómo" es obvio y no cambia contratos públicos. Se cierra automáticamente al terminar la sesión.
argument-hint: "<descripción corta del problema>"
allowed-tools: Read, Write, Bash, Glob
---

# /hotfix — Crear un Hotfix Track SDD

## Argumento recibido

**$ARGUMENTS**

## ¿Cuándo usar `/hotfix` vs `/fix-new` vs `/spec-new`?

Un hotfix aplica cuando **TODAS** estas condiciones se cumplen:

| Condición | ✅ Hotfix | ❌ Fix o Spec |
|-----------|----------|--------------|
| Contratos públicos | No cambia interfaces, firmas de funciones ni signals expuestos al template | Los cambia → `/fix-new` o `/spec-new` |
| Decisión de diseño | El "cómo" es obvio — no hay alternativas a evaluar | Hay más de una forma razonable → `/spec-new` |
| Base de datos / RLS | No toca BD ni migraciones | Los toca → `/spec-new` |
| Verificación | Se puede validar con tests existentes o revisión visual | Requiere nuevos tests de regresión → `/fix-new` |
| ACs nuevos | No necesita definir "cuándo está done" — es obvio | Necesita ACs → `/spec-new` |

**Sin límite de líneas ni archivos.** Un hotfix puede tocar 10 líneas en 5 archivos — lo que importa es que los cambios sean mecánicos/obvios, no que sean pequeños.

**Diferencias clave respecto a `/fix-new`:**
- Sin `Test de Regresión` obligatorio
- Sin `Root Cause` detallado
- **Auto-close**: el track se cierra solo al terminar la sesión
- Vive en `specs/fixes/hotfixes/` (separado, con sistema de aprendizaje futuro)

## Procedimiento

1. Parsear `$ARGUMENTS`:
   - Si está vacío → error "Falta la descripción. Uso: /hotfix 'descripción corta'"
   - Si tiene contenido → es el título del hotfix

2. Determinar el próximo ID:
   - Listar `specs/fixes/hotfixes/hotfix-*/` con `Glob` o `Bash`
   - Tomar el número más alto existente + 1 (formato `hotfix-NNN`, 3 dígitos)
   - Si no hay ninguno, empezar en `hotfix-001`
   - Si `specs/fixes/hotfixes/` no existe, crearla (mkdir -p o simplemente crear el archivo)

3. Construir el slug:
   - Título → lowercase → reemplazar espacios/acentos/caracteres especiales por guiones
   - Ejemplo: "TS2345 handlers fileSelected usan Event" → `ts2345-handlers-fileselected-usan-event`
   - ID completo: `hotfix-NNN-<slug>` (ej: `hotfix-001-ts2345-handlers-fileselected-usan-event`)

4. Crear `specs/fixes/hotfixes/<id>/hotfix.md`:
   - Usar el template de abajo, rellenando título e ID
   - Completar la sección "Cambio" con el archivo y descripción según `$ARGUMENTS`

5. Escribir el ID en `specs/.active` (sobrescribe lo que haya)

6. Imprimir confirmación:
   ```
   ✅ Hotfix track creado: specs/fixes/hotfixes/<id>/hotfix.md
   ✅ specs/.active actualizado: <id>

   Este track se cierra automáticamente al terminar la sesión.
   Ya podés editar el código — el spec-gate permite escrituras.
   ```

## Template de hotfix.md

```markdown
# Hotfix: {TÍTULO}
> id: {ID}
> status: in_progress
> created: {FECHA_HOY}

## Problema
<!-- Qué está roto o mal. Una línea clara. -->
...

## Cambios
<!-- Listar todos los archivos afectados. Sin límite, pero cada línea debe ser obvia. -->
- **Archivo:** `ruta/al/archivo.ts` — descripción del cambio en una línea
- **Archivo:** `ruta/al/otro.ts` — descripción del cambio en una línea
```

## Reglas

- Un hotfix = un problema con causa obvia. Si hay dudas sobre el "cómo" → abrir `/spec-new`.
- Puede tocar múltiples archivos siempre que los cambios sean mecánicos, no decisiones de diseño.
- Los IDs son secuenciales dentro de `hotfixes/` y NO se reutilizan.
- `specs/.active` solo puede tener un ID a la vez. `/hotfix` reemplaza cualquier activo previo.
- El autoclose script limpia `.active` al cierre de sesión y marca `status: done`.
- Si durante la implementación aparece complejidad inesperada → cerrarlo y abrir `/fix-new` o `/spec-new`.
