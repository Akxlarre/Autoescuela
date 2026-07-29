# fix-034-m — Asistencia B: botón "Justificar" sin cursor, columna Acciones desalineada y modal roto

## Contexto

El dueño reportó, en `/app/admin/asistencia` (tab Prácticas), tres problemas
sobre la fila de una clase con estado "Ausente":

1. El botón "Justificar" (columna Acciones) no muestra `cursor: pointer` al
   pasar el mouse.
2. La columna "Acciones" está pegada al borde derecho de la tabla y muy
   separada de la columna "Estado" contigua (gran hueco en blanco entre
   el badge de Estado y el botón Justificar).
3. Al hacer clic en "Justificar" se abre un modal totalmente roto: aparece
   como una columna angosta pegada a la izquierda de la pantalla en vez de
   un modal centrado con overlay, y es ilegible.

## Causa raíz

Los tres bugs están en
`shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`:

1. El botón "Justificar" (línea ~466) usa
   `class="text-xs font-medium hover:underline"` sin `cursor-pointer`, a
   diferencia de los demás botones de esa misma columna de acciones
   (Iniciar, Finalizar) que sí lo tienen.
2. El `<th>`/`<td>` de "Acciones" (líneas 347 y 415) no tienen padding
   izquierdo (`pl-4`) como el resto de columnas, y el contenido usa
   `text-right` + `justify-end` — al ser la última columna de una tabla
   `w-full`, el texto/botón queda anclado al borde derecho físico del
   contenedor, dejando un hueco grande respecto a la columna Estado (que sí
   tiene contenido de ancho fijo pequeño).
3. El overlay del modal de justificación (línea ~530-534) tenía **dos
   atributos `class` en el mismo elemento**:
   ```html
   <div
     class="fixed inset-0 z-50 flex items-center justify-center p-4"
     class="bg-black/40"
     ...
   >
   ```
   Angular no fusiona atributos `class` estáticos duplicados en un mismo
   nodo de plantilla — solo se aplica uno, perdiendo el posicionamiento
   `fixed inset-0`/centrado. El `div` termina renderizándose en el flujo
   normal del documento (de ahí la "columna angosta pegada a la izquierda").
   **Ya corregido en esta sesión** fusionando ambos en un solo atributo
   `class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"`.

## Alcance

Todo en `shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`:

1. ~~Fusionar los dos atributos `class` duplicados del overlay del modal de
   justificación en uno solo.~~ (Ya aplicado.)
2. Agregar `cursor-pointer` a la clase del botón "Justificar".
3. Ajustar la columna "Acciones": agregar `pl-4` al `<th>` y alinear el
   contenido del `<td>` de forma consistente con el resto de la tabla
   (reducir el hueco respecto a la columna Estado), sin romper el layout
   de los otros estados de la columna (Iniciar/Marcar inasistencia,
   Finalizar, Finalizada).

No se toca ninguna otra columna, ni la lógica de `openJustifyModal` /
`submitJustification`, ni otros componentes.

## Acceptance Criteria

- [x] AC0: El botón "Justificar" muestra `cursor: pointer` al pasar el mouse.
  Agregada la clase `cursor-pointer`.
- [x] AC1: La columna "Acciones" no deja un hueco grande respecto a la
  columna "Estado". Cambiado `th`/`td` de `text-right`/`justify-end` a
  `pl-4`/`text-left`/`justify-start`, igual que el resto de columnas.
- [x] AC2: Al hacer clic en "Justificar" se abre un modal centrado con
  overlay oscuro de fondo, legible. Fusionados los dos atributos `class`
  duplicados del overlay en uno solo.
- [x] AC3: No hay regresión visual en los otros estados de la columna
  Acciones — el cambio de alineación aplica al contenedor flex compartido
  por todos los estados (Iniciar/Marcar inasistencia, Finalizar,
  Finalizada, justificación ya registrada), sin tocar su lógica.

## Cierre

`tsc --noEmit` sin errores. Verificación visual confirmada por el dueño en
vivo: cursor pointer en "Justificar", columna Acciones ya no pegada al
borde derecho, modal de justificación se abre centrado y legible. Fix
cerrado.

## Test de regresión

Cambio puramente visual/CSS (clases Tailwind, sin lógica de decisión nueva)
— no aplica test unitario Vitest. Verificación visual manual (Playwright
MCP no disponible en este entorno) a confirmar por el dueño.
