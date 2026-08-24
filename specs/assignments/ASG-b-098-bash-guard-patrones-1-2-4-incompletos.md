# Asignación ASG-b-098 — El parche del Bash Guard arregló 1 de 4 patrones

> **status:** completada
> **owner:** b
> **tipo_sugerido:** hotfix
> **priority:** P2
> **created:** 2026-08-24
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-08-24
> **resulting_track:** hotfix-054-b-bash-guard-patrones-1-2-4

---

## Contexto / Objetivo

`ASG-b-097` corrigió un falso positivo del Bash Guard. **Corrigió 1 de los 4 patrones.** Los
otros 3 arrastran el mismo defecto de raíz.

Se descubrió porque el guard **volvió a bloquear un comando read-only** dos días después, esta
vez con `echo` en vez de un redirect suelto.

## El defecto, que es uno solo repetido 4 veces

Un `.*` que **cruza separadores de comando** (`;` `|` `&`), y en dos casos además un `>` sin
anclar que confunde `2>&1` y `/dev/null` con escritura de archivo.

| Patrón | ¿Corregido en ASG-b-097? | Síntoma |
|---|---|---|
| 1 · `cat\|echo\|printf … > … src/app` | ❌ No | `echo "x"; ls comp.ts 2>/dev/null; grep … otro.ts` bloqueado |
| 2 · `tee … src/app` | ❌ No | `ls \| tee /tmp/x.log; grep … comp.ts` bloqueado (¡sin usar `>`!) |
| 3 · `> … src/app` | ✅ Sí | — |
| 4 · `cat\|echo\|printf … > … migrations` | ❌ No | `echo "x"; ls migrations 2>/dev/null; grep … x.sql` bloqueado |

El patrón 2 es el más instructivo: **no necesita un redirect para fallar**. Eso confirma que la
causa raíz no era el `>` sino el `.*` sin acotar, y que el arreglo anterior atacó el síntoma
en un solo lugar.

## Por qué el test anterior no lo detectó

`scripts/harness/test-bash-guard-patch.js` daba **7/7 verde** sobre el fix incompleto. Ninguno
de sus 7 casos combinaba un verbo de escritura (`echo`/`cat`/`printf`) con un redirect de
diagnóstico **y** una ruta de fuente en el mismo comando, ni probaba `tee` seguido de una
lectura.

**La lección es sobre el test, no sobre el regex:** un suite verde sobre un fix parcial da una
falsa sensación de cierre. Cuando el bug es una *clase* (acá: "regex de guard sin acotar"),
el test tiene que cubrir **todas las instancias de esa clase**, no solo la que se reportó.

El test ya está extendido a **13 casos** y reproduce el bug: contra el hook vigente da
**10 pass · 3 fail**.

## Cómo aplicarlo

```bash
node scripts/harness/patch-bash-guard-patrones-1-2-4.js .claude/hooks/bash-guard.js
```

Requiere una persona: `.claude/hooks/` está protegido y así debe seguir.

## Verificación obligatoria — las DOS direcciones

```bash
node scripts/harness/test-bash-guard-patch.js .claude/hooks/bash-guard.js
```

| Estado | Resultado |
|---|---|
| Hook vigente | **10 pass · 3 fail** |
| Parcheado (validado contra copia, 2026-08-24) | **13 pass · 0 fail** |

De los 13, **6 son casos de BLOQUEO** que deben seguir bloqueando. Si alguno de esos falla,
revertir con `git checkout -- .claude/hooks/` — un guard más permisivo es peor que el falso
positivo que corrige.

## Qué hace el parche

- **Patrón 1 → se elimina.** Es un subconjunto estricto del patrón 3 ya corregido, que atrapa
  cualquier `>` hacia una ruta de fuente sin importar el verbo. Mantenerlo solo duplica la
  superficie donde el bug puede reaparecer. El caso de test "BLOQUEAR: echo redirigido a un
  componente" prueba que no se pierde cobertura.
- **Patrón 2 → se ancla** con `[^;|&]*`.
- **Patrón 4 → se ancla espejando al patrón 3**, y pasa a ser agnóstico del verbo (estrictamente
  más fuerte que exigir `cat|echo|printf`).

## Hueco conocido que NO cierra, a propósito

`tee supabase/migrations/x.sql` no queda cubierto — **tampoco lo estaba antes**, porque el
patrón 4 siempre exigió un `>`. Se deja anotado en vez de ampliarlo en silencio: este parche
corrige falsos positivos, no cambia el alcance de lo que se bloquea. Si se quiere cerrar, es
una decisión aparte.

## Nota de implementación (costó un intento)

La primera versión del patcher ancló bloques multilínea con `\n` y **falló**: el hook tiene
terminaciones de línea **MIXTAS** (CRLF y LF), cortesía de `core.autocrlf` en Windows. La
versión final trabaja **por líneas, buscando por contenido**, y preserva el estilo dominante.

Regla que deja: **un patcher que ancle strings multilínea es frágil en este repo.** Anclar por
contenido de línea.
