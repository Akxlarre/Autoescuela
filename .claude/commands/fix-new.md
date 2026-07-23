---
description: Crear un fix track SDD para una corrección post-implementación (bug, edge case, ajuste)
argument-hint: "<descripción corta del fix>"
allowed-tools: Read, Write, Bash, Glob
---

# /fix-new — Crear un Fix Track SDD

## Argumento recibido

**$ARGUMENTS**

## ¿Qué es un Fix Track?

Un Fix Track es el carril ligero del sistema SDD para correcciones post-implementación.
A diferencia de una spec (que requiere spec → plan → tasks → acceptance), un fix solo
necesita `fix.md` — un contrato mínimo que declara qué rompió, qué AC afecta y qué
test prueba la corrección.

**Cuándo usar `/fix-new` en vez de `/spec-new`:**
- Corrección de un bug descubierto durante QA manual de una spec existente
- Ajuste de comportamiento declarado pero implementado incorrectamente
- Edge case no cubierto por la implementación original
- Refactor puntual de código ya en producción (sin nueva funcionalidad)

**NO usar `/fix-new` para:**
- Features nuevas (→ `/spec-new`)
- Cambios de diseño o UX que alteran los AC originales (→ nueva spec)
- Múltiples cambios no relacionados (→ un fix por corrección)

## Procedimiento

1. Parsear `$ARGUMENTS`:
   - Si está vacío → mostrar error "Falta la descripción del fix. Uso: /fix-new 'descripción corta'"
   - Si tiene contenido → es el título del fix

2. Determinar el próximo ID:
   - Listar `specs/fix-*/` con `Glob` o `Bash`
   - Tomar el número más alto existente + 1 (formato `fix-NNN`, 3 dígitos, ej: `fix-001`)
   - Si no hay ninguno, empezar en `fix-001`

3. Construir el slug:
   - Título → lowercase → reemplazar espacios/acentos/caracteres especiales por guiones
   - Ejemplo: "myTasks KPI incorrecto" → `mytasks-kpi-incorrecto`
   - ID completo: `fix-NNN-<slug>` (ej: `fix-001-mytasks-kpi-incorrecto`)

4. Crear `specs/<id>/fix.md`:
   - Usar el template de abajo, rellenando título e ID
   - El campo `refs:` queda vacío para que el usuario lo complete
   - El campo `status:` siempre `in_progress` al crear

5. Escribir el ID en `specs/.active` (sobrescribe lo que haya)

6. Imprimir confirmación:
   ```
   ✅ Fix track creado: specs/<id>/fix.md
   ✅ specs/.active actualizado: <id>
   
   Próximo paso:
     1. Edita specs/<id>/fix.md → completa Root Cause, ACs Afectados y Test de Regresión
     2. Haz el cambio en el código (el spec-gate ya permite escrituras)
     3. Corre el test de regresión para verificar
     4. /fix-close cuando el test esté verde
   ```

## Template de fix.md

```markdown
# Fix: {TÍTULO}
> id: {ID}
> refs: (spec relacionada, ej: 0001-sistema-de-tareas-multi-rol, o "—" si es independiente)
> status: in_progress
> created: {FECHA_HOY}

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
...

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
<!-- Si el fix es independiente de cualquier spec, escribir "Ninguno — fix autónomo". -->
- AC-X: cómo el fix lo corrige

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `ruta/al/archivo.ts`
- **Qué cambia:** ...

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- `ruta/archivo.spec.ts > nombre del test` ✓
```

## Reglas

- Un fix track = una causa raíz = un cambio puntual. Si encuentras dos bugs, crea dos fixes.
- El ID es secuencial y NO se reutiliza.
- `specs/.active` solo puede tener un ID a la vez (spec o fix, no ambos).
- Si hay una spec activa cuando corres `/fix-new`, el fix la reemplaza en `.active`. La spec
  sigue existiendo — puedes volver con `/spec-activate <id>` cuando termines el fix.
- El Fix Gate no requiere `plan.md` ni `tasks.md`. Solo `fix.md`.
