# Asignación ASG-b-082 — App-like: familia "reportes contables" + "cuadratura" (`admin` + `secretaria`)

> **status:** reclamada
> **owner:** i
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** i
> **claimed_at:** 2026-08-24
> **resulting_track:** 0003-i-app-like-reportes-contables

---

## Contexto / Objetivo

Paso 14 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`). **Sugerido como `spec`, no `fix`**
— ambas piezas requieren rediseño con tabs antes de que el shell app-like tenga sentido, no es
una pasada mecánica. Agrupadas porque comparten el mismo tipo de problema (muchas secciones) y
porque `reportes-contables-content`/`cuadratura-content` son componentes `shared` entre admin y
secretaria.

### `reportes-contables-content` (`/admin/contabilidad/reportes` + `/secretaria/...`)

**Verificado en la auditoría: son 7 `.bento-banner` secuenciales** (no 4-5 como decía la primera
pasada), 784 líneas, no mapeadas en detalle. Confirma el diagnóstico: necesita rediseño en tabs
antes de fill-screen. La spec debe decidir cómo agrupar las 7 secciones en tabs **sin perder
ningún reporte** — primer paso es leer las 784 líneas completas y catalogar qué es cada una de
las 7 secciones.

### `cuadratura-content` (`/admin/contabilidad/cuadratura` + `/secretaria/...`)

990 líneas, YA tiene CSS custom inline para `.bento-grid` + manejo de `force-compact` (drawer
abierto) que hay que respetar; `p-6 pb-12` extra en el host del grid (inusual, investigar por
qué antes de tocarlo). La spec debe adaptar `.bento-feature` a `.bento-fill` **sin romper el CSS
custom existente ni el contador de billetes/monedas** (es una interacción táctil real —
conteo de caja chica — no debe perder tamaño ni precisión de toque en ningún breakpoint).

## Por qué van juntas en una sola spec

Ambas son componentes `shared` de la sección Contabilidad, ambas necesitan diseño previo (no son
mecánicas), y quien las resuelva se va a familiarizar con el mismo módulo de negocio para las
dos — separarlas en 2 specs distintas duplicaría el trabajo de entender el dominio financiero de
la escuela sin necesidad. Si quien la reclama prefiere dividirlas en 2 tracks igual, es válido.

## Reclamada — dividida en 2 specs (2026-08-24)

Quien reclamó (`i`) prefirió dividirla, como preveía esta nota. Resultó en:
- [0003-i-app-like-reportes-contables](../specs/0003-i-app-like-reportes-contables/spec.md)
- [0004-i-app-like-cuadratura](../specs/0004-i-app-like-cuadratura/spec.md)

(`resulting_track` del frontmatter apunta solo a `0003-i` porque el script de sync espera un
único track por Asignación — la referencia completa vive acá.)

## Checklist de cierre (rollout app-like, además de lo normal de una spec)

- [ ] `force-compact` verificado con drawer abierto en las 4 rutas — cuadratura YA tiene manejo
      propio de `force-compact`, no duplicarlo, integrarlo
- [ ] `.spec.ts` para cualquier lógica de densidad/tabs nueva que se agregue
- [ ] `/verify` en **LAS 4 RUTAS** (`admin` y `secretaria` de cada una — componentes `shared`),
      390×844, 1440×900 y 768 de alto
- [ ] Cuadratura: verificar específicamente que el contador de billetes/monedas mantiene su
      tamaño de toque en mobile y en el nuevo layout fill-screen

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — filas `/admin/contabilidad/reportes` y
  `/admin/contabilidad/cuadratura`

## Archivos involucrados

- `src/app/shared/components/reportes-contables-content/reportes-contables-content.component.ts`
- `src/app/shared/components/cuadratura-content/cuadratura-content.component.ts`
