# Alcance real de los 9 documentos del expediente Ley 21.719

> Nota interna del equipo de desarrollo — **no es parte del expediente legal** que se muestra a un
> fiscalizador ni al titular. Es para entender qué tan completo está cada documento y quién debe
> terminarlo antes de darlo por bueno. Generado 2026-08-18.

## Contexto: por qué esto importa

El equipo de desarrollo **no es dueño de la autoescuela** — son devs contratados para construir el
sistema de gestión; el dueño del negocio (Sociedad Comercial Chillán Capacita Limitada) es un tercero.
El expediente de `.compliance/docs/conductores/` se generó con el skill `compliance-cl`, que descubre
evidencia de dos formas:

1. **Grep/glob sobre el código del repositorio** — ve exactamente lo que el software hace con datos
   personales.
2. **Un cuestionario respondido por el equipo** — cubre lo operativo del negocio, pero solo hasta donde
   el equipo lo conoce o alcanzó a preguntar.

Ninguna de las dos fuentes puede ver procesos de la empresa que **no pasan por el software y que nadie
preguntó explícitamente**: sitio web/analytics, pagos con POS físico, archivo en papel, cámaras de
seguridad del local, seguros, WhatsApp Business, etc. Por eso varios documentos están estructuralmente
incompletos — no por un error puntual, sino porque **describen a la empresa completa** y el método de
descubrimiento solo alcanza a ver la porción que toca el software.

## Roles bajo la Ley 21.719

- **Responsable** (decide para qué se usan los datos): la autoescuela. Le corresponden las
  declaraciones legales de toda la empresa.
- **Encargado** (trata datos por cuenta de otro, bajo instrucciones): el equipo de desarrollo, por tener
  acceso técnico a producción. El Art. 15 bis exige un contrato escrito entre ambos — es el DPA (Anexo 8).

## Clasificación de los 9 documentos

### A cargo del equipo de desarrollo

| Anexo | Documento | Por qué es del equipo |
|---|---|---|
| 8 | Contrato de Tratamiento de Datos (DPA) | Es el contrato que protege al equipo como encargado. Deben negociarlo y hacerlo firmar — es su propio interés, no algo delegable. |
| 9 | Transferencia Internacional | Declara dónde vive la infraestructura que **el equipo eligió** (Supabase, hosting de correo, Zoom). Es un anexo técnico sobre su propia arquitectura. |
| 4 | Consentimientos y avisos en el punto de captura | Texto de UI que el equipo implementa literalmente en el código (casillas, banners, orden de aparición). El mecanismo es 100% suyo. |

### A cargo del dueño de la autoescuela (entregar como borrador avanzado, no como definitivo)

| Anexo | Documento | Por qué es del dueño |
|---|---|---|
| 1 | Registro de Actividades de Tratamiento (RAT) | Inventario de **toda** la empresa. El equipo solo puede certificar la porción que pasa por el software. |
| 2 | Evaluación de Impacto (EIPD) | Hereda los huecos del RAT y hace juicios de riesgo (ej. probabilidad/impacto de cada riesgo, aceptación de un riesgo residual) que en rigor le corresponde validar al representante legal, no al equipo. |
| 3 | Política de Privacidad (pública) | Debe declarar todo lo que la empresa hace con datos personales (Art. 14 ter) — hoy solo refleja lo que el software toca. Debe existir publicada en la app (los propios checkboxes de consentimiento la referencian), pero su contenido necesita revisión del dueño antes de publicarse en producción. |
| 6 | Plan de Respuesta a Brechas | Asigna roles organizacionales reales ("Coordinador del incidente: [representante legal]") — es su plan de continuidad de negocio. |
| 7 | Registro de Vulneraciones | Bitácora operativa que la secretaría/el dueño llena en el día a día. Se entrega lista como plantilla; el mantenimiento es de ellos. |

### Caso mixto

| Anexo | Documento | Detalle |
|---|---|---|
| 5 | Canal de ejercicio de derechos | El procedimiento (quién responde, en qué plazo, cómo verifica identidad) es operativo del dueño/secretaría. Pero si el software no tiene forma técnica de exportar o eliminar los datos de un alumno, el documento es papel mojado — ahí sí hay una tarea del equipo. |

## Qué tan completo está cada documento hoy

### Necesitan mucha más información (documentos de empresa completa; el RAT que los alimenta está incompleto)

| # | Doc | Por qué le falta |
|---|---|---|
| 1 | RAT | Fuente que alimenta a casi todos los demás. Falta: sitio web/analytics, pixels de marketing, POS de pago con tarjeta, archivo físico, cámaras de seguridad, seguros, WhatsApp Business, etc. |
| 2 | EIPD | Hereda los huecos del RAT — si el RAT no sabe que algo existe, la EIPD no evalúa su riesgo. |
| 3 | Política de Privacidad | Por ley debe declarar todo lo que la empresa hace con datos personales — si el RAT no menciona Analytics/Pixel/POS/cámaras, la política tampoco. |
| 9 | Transferencia Internacional | Si hay Google Analytics o Meta Pixel en el sitio sin declarar, eso también es una transferencia internacional que hoy no aparece. |

### Necesitan actualización moderada (procedimiento bien armado, pero ejemplos/categorías dependen del RAT)

| # | Doc | Detalle |
|---|---|---|
| 6 | Plan de Respuesta a Brechas | Estructura completa y reutilizable (fases, plantillas de aviso, roles). Los ejemplos de "qué cuenta como brecha" y el análisis de riesgo asumen las categorías de datos del RAT actual — si el RAT crece, esta lista debería revisarse. |

### Ya tienen todo lo necesario para su alcance real (acotado al software, no a la empresa completa)

| # | Doc | Por qué sí está completo |
|---|---|---|
| 4 | Consentimientos y avisos en el punto de captura | Alcance = lo que el software captura. Ahí el equipo tiene visibilidad total porque son sus propias pantallas. |
| 5 | Canal de ejercicio de derechos | Procedimiento operativo bien definido (verificación, plazos, tabla de qué se puede/no se puede borrar). No depende de conocer procesos fuera del sistema. |
| 7 | Registro de Vulneraciones | Plantilla vacía por diseño — pensada para empezar en blanco y llenarse operativamente. |
| 8 | DPA (Contrato de Tratamiento) | Acotado a la relación responsable↔encargado, que el equipo conoce por completo. Solo faltan datos de identificación (`[COMPLETAR]` razón social/RUT de quien firma), no categorías enteras de información. |

## Recomendación de entrega

1. **Documentos "a cargo del equipo" (4, 8, 9):** mantenerlos actualizados como parte normal del trabajo
   de desarrollo — no requieren validación del dueño más allá de confirmar los hechos puntuales que ya
   se corrigieron (finalidad real del certificado médico, uso real de la IP).
2. **Documentos "a cargo del dueño" (1, 2, 3, 6, 7):** entregarlos como **borrador avanzado**, con aviso
   explícito de que están pendientes de revisión y aprobación del responsable — especialmente el RAT,
   que es la base de todos los demás. Antes de publicar la Política de Privacidad en producción, el
   dueño debe confirmar cada hecho de negocio (cámaras, personal, proveedores, retención).
3. **Anexo 5 (mixto):** el equipo confirma que el software soporta técnicamente lo que el documento
   promete (exportar/eliminar datos de un alumno); el resto lo revisa el dueño.
4. Antes de dar por completo el RAT, vale la pena preguntarle directamente al dueño si ya existe una
   versión previa de este documento (hecha con un abogado u otro asesor) para no duplicar trabajo ni
   generar dos inventarios contradictorios de la misma empresa.

---
*Documento de trabajo interno del equipo de desarrollo. No forma parte del expediente que se exhibe ante
la Agencia de Protección de Datos ni ante el titular.*
