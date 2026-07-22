---
description: Verificar Acceptance Criteria de la spec activa y generar acceptance.md con evidencia
allowed-tools: Read, Write, Bash, Glob, Grep
---

# /spec-verify — Verificar AC y cerrar la spec

Vas a producir el `acceptance.md` de la spec activa, marcando cada AC con evidencia concreta.

## Procedimiento

### 1. Identificar la spec activa

```bash
cat specs/.active
```

- Si está vacío → "No hay spec activa para verificar."

### 2. Leer los 3 artefactos

- `specs/<active>/spec.md` → extraer los AC
- `specs/<active>/plan.md` → contexto de qué se prometió
- `specs/<active>/tasks.md` → ver cuáles tareas están marcadas como `[x]`

### 3. Recolectar evidencia

Para cada AC de la spec:

1. **Buscar tests relacionados**:
   ```bash
   git log --oneline --since="2 weeks ago" -- "**/*.spec.ts" "**/*.test.ts"
   grep -r "AC<N>" specs/ src/ tests/  # buscar referencias explícitas al AC
   ```

2. **Buscar commits recientes que toquen el área**:
   ```bash
   git log --oneline --since="2 weeks ago" -- src/app/features/<area>
   ```

3. **Identificar archivos creados/modificados** desde la activación de la spec.

### 4. Clasificar cada AC

Para cada AC marcá:

- ✅ **Cumplido** con evidencia: commit hash + archivo de test/código + descripción 1 línea
- ⚠️ **Parcial**: qué falta concretamente
- ❌ **No abordado**: nada en la sesión/repo lo cubre

### 5. Validar out-of-scope

Por cada item de "Out of scope" en `spec.md`:
- Confirmar que NO se implementó (buscar pistas en commits y archivos)
- Si se implementó algo del out-of-scope → marcarlo como deuda y avisar al usuario que es scope creep

### 6. Generar `acceptance.md`

Lee la plantilla `.claude/skills/sdd/templates/acceptance.md` y completala con:

- Reemplazos básicos (`{{ID}}`, `{{TITLE}}`, `{{DATE}}`, `{{OWNER}}`)
- Resumen ejecutivo (totales, cumplidos, fallidos)
- Bloque por cada AC con evidencia
- Sección de out-of-scope respetado
- Deuda técnica detectada
- Cambios en índices (cruzá con `indices/` actuales)

### 7. Veredicto final

Calculá:
- **✅ PASA**: todos los AC cumplidos, out-of-scope respetado, sin deuda crítica
- **⚠️ PARCIAL**: 80%+ cumplidos pero quedan gaps menores no bloqueantes
- **❌ NO PASA**: hay AC importantes sin cumplir o scope creep significativo

### 8. Reportar al usuario

Si **PASA**:
```
✅ Spec <id> verificada — todos los AC cumplidos.

Próximos pasos:
  1. Actualizar specs/ROADMAP.md: mover spec a "Done"
  2. /spec-activate --clear  (desactivar la spec)
  3. Cambiar status en spec.md de "in_progress" → "done"

¿Querés que lo haga ahora?
```

Si **NO PASA** o **PARCIAL**:
```
⚠️ Spec <id> con gaps:

  ❌ AC2 — sin evidencia (no se encontró validación de email único)
  ⚠️ AC-E1 — parcial (falta caso de pre-inscripción expirada)

acceptance.md ya tiene el detalle completo.

Opciones:
  - Seguir trabajando: implementar lo que falta y re-ejecutar /spec-verify
  - Aceptar gap: editar manualmente acceptance.md con justificación
  - Descartar: cambiar status a "archived" si decidiste no continuar
```

## Reglas

- NO marques AC como cumplido sin evidencia concreta (commit hash, archivo + línea, test caso)
- NO bloquees el cierre si los gaps son no-críticos y el usuario lo aprueba conscientemente
- NO toques `specs/.active` (eso es de `/spec-activate --clear`)
- NO modifiques `spec.md` (las specs aprobadas son inmutables; si necesitan cambio, abrí spec nueva)
- Si encontrás scope creep, sé directo: nombrá qué se implementó que no estaba en la spec
