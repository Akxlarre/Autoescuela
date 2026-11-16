# 013 — Documentos de referencia (PDF y correos)

> **Fase:** 3 · **Prioridad sugerida:** P2 · **Tipo sugerido:** fix
> **Depende de:** nada · **Desbloquea:** nada
> **Nivel hoy:** 0 (no existe) · **Meta:** 2 (el CI compara contra una versión aprobada)

## En una frase

Un contrato o un certificado no cambia sin que alguien haya visto y aprobado la diferencia.

## El concepto

Algunos resultados son difíciles de afirmar con un test normal: un documento de tres páginas, un
correo con formato. Escribir "el texto de la cláusula 4 dice tal cosa" para cada línea no es
viable. La técnica para estos casos es el **archivo de referencia** (_golden file_, _golden
master_, _snapshot_):

1. Se genera el resultado una vez.
2. Una persona lo revisa y lo aprueba.
3. Se guarda en el repositorio como la referencia.
4. Cada test genera el resultado de nuevo y lo compara. Si difiere, falla.
5. Si el cambio era intencional, se regenera la referencia y la diferencia se revisa en el PR.

A esto último se le llama **prueba por aprobación** (_approval testing_): el test no dice qué es
correcto, dice "esto cambió, ¿está bien?".

Sirve además para código heredado cuyo comportamiento exacto nadie tiene escrito: se captura lo
que hace hoy y se protege. Se llama **test de caracterización** (_characterization test_).

Qué se puede comparar de un documento:

| Nivel | Qué compara | Detecta | Fragilidad |
| ----- | ----------- | ------- | ---------- |
| Texto extraído | Las palabras del PDF | Cambios de redacción, datos faltantes, campos mal ubicados | Baja |
| Estructura | Número de páginas, campos, fuentes | Documentos truncados o con página de más | Baja |
| Imagen | Cada página convertida a imagen | Cambios de diseño, texto que se sale | Alta: depende de fuentes y del motor |

La condición para que funcione es el **determinismo**: con las mismas entradas, la salida tiene
que ser idéntica. Todo lo que varía solo (la fecha de hoy, un identificador al azar, la hora de
creación del archivo) hay que fijarlo o excluirlo de la comparación.

## Por qué importa acá

Verificado el 2026-11-15:

- **El sistema emite documentos con valor legal o regulatorio:** contrato de matrícula,
  certificado Clase B, certificado profesional, libro de clases, ficha de matrícula, hoja de ruta,
  licencia de alumno, informe del test psicológico, y los reportes contables y de nómina.
- **Son unas 15 edge functions `generate-*`** más las de exportación.
- **La generación está centralizada:** `pdf-lib` (versión 1.17.1) se usa desde
  `_shared/table-pdf.ts`, junto a `_shared/contract-pdf.ts`, `_shared/ficha-tecnica-pdf.ts` y
  `_shared/pdf-utils.ts`. Un cambio en un módulo compartido altera varios documentos a la vez.
- **Lo que hay probado es el dato, no el documento.** Existen tests de formateo
  (`enrollment-sheet-format.test.ts`, `template-tokens.test.ts`, `promotion-certificate.test.ts`,
  `ficha-tecnica-pdf.test.ts`, `table-pdf.test.ts`). Ninguno compara un documento completo contra
  una versión aprobada.
- **No hay comparación de imágenes en todo el repo** (0 usos de `toHaveScreenshot`).
- **Un detalle ya causó trabajo:** `docs/DEPLOY.md` registra que el dominio de la app está
  impreso en los contratos (`APP_BASE_URL` en `contract-pdf.ts`) y hay que acordarse de cambiarlo
  a mano. Una referencia lo habría mostrado en el diff.
- **Los correos también son documentos:** contrato por correo, invitaciones, comunicados, clases
  por Zoom, recuperación de contraseña. Tienen tests de construcción en `_shared`.

## Qué hay hoy

- Los módulos compartidos de PDF y sus tests de formato.
- Los tests de correo en `_shared` (`contract-email`, `announcement-email`, `auth-email`,
  `school-email` y otros).
- El precedente de método: la línea base de accesibilidad en `e2e/a11y-baseline/`, con su regla
  "se regenera solo después de corregir, nunca para aceptar algo nuevo".
- `e2e/alumnos-b-*.spec.ts` verifica algunos PDF reales desde la interfaz.

## Cómo se hace

### 1. Empezar por el texto

Para cada documento elegido:

- Un conjunto de datos de entrada fijo y ficticio.
- Generar el PDF con el reloj fijado.
- Extraer el texto y compararlo con un archivo `.txt` aprobado, guardado en el repo.

El diff de un `.txt` se lee en cualquier PR. Detecta la mayoría de los errores que importan: una
cláusula que desapareció, un nombre en el lugar del RUT, un monto sin formato.

### 2. Sumar la estructura

Número de páginas y presencia de los campos obligatorios.

### 3. La imagen, solo donde el diseño importa

Convertir las páginas a imagen y comparar con tolerancia. Hacerlo en un solo entorno fijo (el
contenedor del CI): las fuentes y el motor cambian el resultado entre equipos.

### 4. El flujo de aprobación

- Un comando para regenerar las referencias.
- La diferencia se revisa en el PR.
- Para el contrato y los certificados, quien aprueba el texto es quien responde por él ante la
  escuela, no solo quien programó.

### 5. Los correos

Lo mismo con el HTML generado: un archivo de referencia por plantilla.

### 6. Las planillas

Las exportaciones a Excel: comparar las celdas, no el archivo binario.

### Por cuáles empezar

Los que firma o recibe un tercero: contrato de matrícula, los dos certificados y el libro de
clases. Después, los reportes de caja.

## Alcance propuesto

- Referencia de texto y estructura para el contrato, los dos certificados y el libro de clases.
- Referencia de HTML para los correos que salen hacia alumnos.
- El comando de regeneración y la regla de aprobación, documentados.
- El job en el CI.

## Fuera de alcance

- Comparación por imagen de todos los documentos.
- Validar el contenido legal de los documentos: eso es revisión de una persona que sepa, y
  `compliance-cl` para la normativa.
- Los reportes contables, en una primera ronda.

## Cómo saber que está terminado

- [ ] Cambiar una palabra del contrato deja el CI en rojo, con la diferencia legible.
- [ ] Regenerar la referencia es un solo comando.
- [ ] Dos corridas seguidas sin cambios producen el mismo resultado, en cualquier zona horaria.
- [ ] Los datos de las referencias son ficticios.
- [ ] Está escrito quién aprueba un cambio de texto en cada documento.

## Trampas conocidas

- **La fecha de creación del archivo.** Las librerías de PDF la escriben por defecto. Fijarla o
  comparar el texto en vez de los bytes.
- **La fecha impresa.** "Chillán, 15 de noviembre de 2026" cambia cada día: reloj fijo en el test,
  con un instante explícito en UTC (regla de `dates.md`).
- **Regenerar por reflejo.** Si ante cada rojo se regenera sin mirar, la referencia no protege
  nada. Es la misma regla de la línea base de accesibilidad.
- **Datos reales en la referencia.** Nunca copiar un contrato real como referencia: va a un
  repositorio.
- **Fuentes.** Si la fuente no está incrustada, la imagen cambia según el equipo.
- **Referencias gigantes.** Un archivo enorme no lo revisa nadie. Mejor varios casos pequeños: un
  contrato Clase B, uno profesional, uno con descuento.
- **Imágenes y firmas.** El texto extraído no las ve. Si importan, van en el chequeo de estructura.

## Decisiones pendientes

| Decisión | De quién |
| -------- | -------- |
| Qué documentos entran primero | Equipo, con el dueño de la escuela |
| Quién aprueba los cambios de texto del contrato y los certificados | Dueño de la escuela |
| Si algún documento justifica la comparación por imagen | Equipo |

## Vocabulario

- **Golden file / snapshot:** resultado aprobado contra el que se compara.
- **Approval testing:** el test muestra qué cambió y una persona aprueba.
- **Characterization test:** capturar el comportamiento actual de código sin especificación.
- **Deterministic:** misma entrada, misma salida, siempre.
- **Diff:** la diferencia entre dos versiones.
