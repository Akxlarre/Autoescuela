# Hotfix: Anclar los patrones 1, 2 y 4 del Bash Guard (el parche de ASG-b-097 fue incompleto)

> id: hotfix-054-b-bash-guard-patrones-1-2-4
> refs: ASG-b-098
> status: done
> closed: 2026-08-24
> created: 2026-08-24

## Problema

`ASG-b-097` corrigió un falso positivo del Bash Guard. **Corrigió 1 de los 4 patrones.**

Se descubrió porque el guard volvió a bloquear un comando read-only dos días después, esta vez
con `echo` en lugar de un redirect suelto.

## Causa raíz — una sola, repetida cuatro veces

Un `.*` que **cruza separadores de comando** (`;` `|` `&`), y en dos casos además un `>` sin
anclar que confunde `2>&1` y `/dev/null` con escritura de archivo.

| Patrón | ¿Corregido en ASG-b-097? |
|---|---|
| 1 · `cat\|echo\|printf … > … src/app` | ❌ |
| 2 · `tee … src/app` | ❌ |
| 3 · `> … src/app` | ✅ |
| 4 · `cat\|echo\|printf … > … migrations` | ❌ |

El **patrón 2 es el más instructivo: fallaba sin usar un redirect**. Eso confirma que la causa
raíz nunca fue el `>` sino el `.*` sin acotar — y que el arreglo anterior atacó el síntoma en un
solo lugar en vez de la clase de bug.

## Cambios

- **Patrón 1 eliminado.** Subconjunto estricto del patrón 3 ya corregido, que atrapa cualquier
  `>` hacia una ruta de fuente sin importar el verbo. Mantenerlo solo duplicaba la superficie
  donde el bug puede reaparecer.
- **Patrón 2 anclado** con `[^;|&]*`.
- **Patrón 4 anclado** espejando al patrón 3, y ahora agnóstico del verbo — estrictamente más
  fuerte que exigir `cat|echo|printf`.

Aplicado a mano por el owner: `.claude/hooks/` está protegido y así debe seguir.

## Verificación — las dos direcciones, sobre el archivo real

`scripts/harness/test-bash-guard-patch.js`, 13 casos (7 heredados + 6 nuevos):

| Estado | Resultado |
|---|---|
| Antes | **10 pass · 3 fail** — reproducía los 3 falsos positivos |
| Después | **13 pass · 0 fail** |

Los **6 casos de BLOQUEO siguen bloqueando**. En particular *"BLOQUEAR (patrón 1 legítimo): echo
redirigido a un componente"* pasa, que es la prueba de que eliminar el patrón 1 no perdió
cobertura. `node --check` limpio.

## Hueco conocido que NO se cierra, a propósito

`tee supabase/migrations/x.sql` sigue sin cubrirse — **tampoco lo estaba antes**, porque el
patrón 4 siempre exigió un `>`. Este hotfix corrige falsos positivos; ampliar el alcance de lo
que se bloquea es una decisión aparte.

## Lecciones

**1. Un suite verde sobre un fix parcial da falsa sensación de cierre.** El test daba 7/7 sobre
el fix incompleto: ninguno de sus casos combinaba un verbo de escritura con un redirect de
diagnóstico *y* una ruta de fuente, ni probaba `tee` seguido de una lectura.

> **Regla:** cuando el bug es una *clase* (acá, "regex de guard sin acotar"), el test debe cubrir
> **todas las instancias de esa clase**, no solo la reportada. Buscar los hermanos del bug antes
> de dar por cerrado el fix.

**2. Los patchers de un solo uso deben anclar por contenido de línea, no por bloques
multilínea.** La primera versión falló silenciosamente: el hook tiene terminaciones **mixtas
CRLF/LF** por `core.autocrlf` en Windows, y un ancla con `\n` no matchea. La versión final
trabaja por líneas y preserva el estilo dominante.

**3. `node --check` no valida el sistema de módulos.** Un antecedente de `ASG-b-097`: los
patchers usaban `require()` en un paquete con `"type": "module"` y pasaban `--check`, pero
explotaban en runtime. Para un script de un solo uso, la única verificación que sirve es
**ejecutarlo contra una copia**.
