---
description: Activar una spec SDD existente (la marca como en ejecución para los hooks)
argument-hint: "<spec-id> | --clear | --bypass <motivo>"
allowed-tools: Read, Write, Bash, Glob
---

# /spec-activate — Activar una spec SDD

## Argumento recibido

**$ARGUMENTS**

## Modos de operación

### Modo 1: Activar una spec específica

`/spec-activate 0001-pre-inscripcion-profesional`

- Verifica que `specs/0001-pre-inscripcion-profesional/spec.md` exista
- Escribe el ID en `specs/.active` (sobrescribe lo que haya)
- Si la spec no tiene `plan.md`, avisa que el usuario debe correr `/spec-plan` antes de poder tocar código

### Modo 2: Desactivar (clear)

`/spec-activate --clear`

- Vacía el contenido de `specs/.active`
- Avisa: "Spec desactivada. El spec-gate bloqueará escrituras en código de producto."

### Modo 3: Bypass de emergencia

`/spec-activate --bypass "motivo del bypass"`

- Escribe `--bypass <motivo>` en `specs/.active`
- Esto hace que `spec-gate.js` permita escrituras sin spec activa
- Pensado para hotfixes, refactors menores, o experimentación temporal
- Imprime ADVERTENCIA: "Bypass activo. Recordá revertir con /spec-activate --clear cuando termines."

## Procedimiento

1. Parsear `$ARGUMENTS`:
   - Si empieza con `--clear` → modo 2
   - Si empieza con `--bypass` → modo 3 (resto es el motivo, obligatorio)
   - Cualquier otra cosa → tratar como spec ID (modo 1)
   - Si está vacío → mostrar el estado actual de `specs/.active` y la lista de specs disponibles

2. Para modo 1:
   - Aceptar el ID con o sin el prefijo numérico (ej: `0001` o `0001-pre-inscripcion`). Si solo dan el número, buscar el match único.
   - Verificar existencia de `specs/<id>/spec.md`
   - Si no existe, listar las specs disponibles y abortar
   - Escribir el ID completo en `specs/.active`
   - Verificar `plan.md` y reportar estado

3. Para todos los modos, al terminar imprimir:
   ```
   ✅ specs/.active actualizado.
   Estado actual: <id activo | vacío | bypass: motivo>
   ```

## Ejemplos

```
/spec-activate 0001
/spec-activate 0001-pre-inscripcion-profesional
/spec-activate --clear
/spec-activate --bypass "hotfix urgente del bug de auth"
```

## Reglas

- NUNCA actives una spec con status `done` o `archived`. Avisa al usuario.
- NUNCA actives una spec con status `draft` sin avisar: las specs deben estar `approved` antes de ejecutarse.
- El archivo `specs/.active` debe tener UNA sola línea con el ID o el bypass.
