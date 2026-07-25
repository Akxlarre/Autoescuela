# Hotfix: SkeletonBlockComponent no renderiza anchos en porcentaje
> id: hotfix-047-m-skeleton-block-width-porcentaje-colapsa
> status: done
> closed: 2026-07-25
> created: 2026-07-25

## Problema
`SkeletonBlockComponent` (`skeleton-block.component.ts`) aplica `[style.width]="width()"` al `<div>` interno, no al host (`:host { display: block }`, sin tamaño propio). Cuando `width()` es un porcentaje (`"9%"`, `"11%"`, `"15%"`, `"7%"`), ese porcentaje se resuelve contra el ancho del div interno... que a su vez depende del host, cuyo tamaño depende de su contenido — un ciclo indefinido que el navegador resuelve como ancho 0. Como consecuencia, en cualquier lugar del proyecto que use `<app-skeleton-block width="XX%">` dentro de un contenedor flex (ej. la tabla de Alumnos), esos bloques son invisibles: solo se ven los que usan anchos fijos en `px` (que sí funcionan, porque no dependen del tamaño del padre). Esto explica por qué el skeleton de la tabla de Alumnos "solo muestra 3 columnas" — son los 3 únicos bloques `rect` con ancho en `px` (Curso/Estado/Expediente); los bloques `text` con ancho en `%` (RUT, Nº Exp, Sede, Fecha) nunca se pintan. Bug del componente compartido, no específico de esa tabla — afecta a los ~21 archivos que usan `app-skeleton-block` con anchos en `%`.

## Cambios
- **Archivo:** `src/app/shared/components/skeleton-block/skeleton-block.component.ts` — mover `[style.width]="width()"` del `<div>` interno al host (vía `host: { '[style.width]': 'width()' }` en el decorador `@Component`), y cambiar el `<div>` interno a `width: 100%` (llena el host, que ahora sí tiene el tamaño real dentro de su contenedor flex/grid).
