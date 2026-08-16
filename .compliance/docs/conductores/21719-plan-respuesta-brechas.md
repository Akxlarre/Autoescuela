# Plan de Respuesta a Brechas de Datos Personales

**Empresa:** Sociedad Comercial Chillán Capacita Limitada · **RUT:** 77.940.120-0
**Responsable del plan:** Jorge Enrique Pérez Godoy, representante legal
**Contacto:** conductorchillan@gmail.com · **Versión:** 1.0 · **Fecha:** 2026-08-16

**Plazo legal:** notificar a la Agencia **sin dilaciones indebidas** (Art. 14 sexies). La ley chilena
**NO fija un plazo de 72 horas** — eso es estándar europeo. En la práctica: apenas se tenga claro que
hubo una vulneración y su alcance aproximado, se notifica; no se espera a tener el informe completo.

Además hay que mantener un **registro de todas las vulneraciones**, aunque no se notifiquen
(ver `21719-registro-vulneraciones.md`).

---

## Roles

| Rol | Quién | Contacto |
|---|---|---|
| **Coordinador del incidente** | Representante legal — Jorge Enrique Pérez Godoy | conductorchillan@gmail.com |
| **Apoyo técnico** | Responsable del sistema / desarrollador | `[COMPLETAR: nombre y teléfono]` |
| **Apoyo administrativo** | Secretaría en funciones | conductorchillan@gmail.com |
| **Apoyo legal** | `[COMPLETAR: abogado de confianza — solo se activa si la brecha es grande o llega fiscalización]` | |

## Qué cuenta como brecha

Cualquier **destrucción, pérdida, filtración o alteración no autorizada** de datos personales. Casos
concretos y realistas en esta escuela:

- Un expediente de alumno (cédula, certificado médico) queda accesible públicamente en internet.
- Un correo con datos de varios alumnos se envía por error a un destinatario equivocado.
- Se pierde o roban un computador o teléfono con acceso al sistema.
- Una cuenta de secretaría o administrador es comprometida (contraseña filtrada, phishing).
- Supabase, Google o Zoom informan un incidente que afecta a nuestros datos.
- Un ex trabajador conserva acceso al sistema después de irse.

---

## Fase 1 — Detección y contención (0–4 horas)

1. Registrar **fecha y hora exactas** de la detección y quién la detectó.
2. **Contener de inmediato:**
   - Revocar el acceso de la cuenta comprometida.
   - Cambiar contraseñas y rotar las credenciales del sistema.
   - Si hay un archivo expuesto públicamente, quitarlo de circulación.
3. **Abrir la bitácora del incidente** — desde este momento se anota todo, con hora.
4. **No borrar evidencia.** Los registros de auditoría del sistema (que guardan usuario, acción, IP y
   fecha) son la principal fuente para reconstruir qué pasó.

## Fase 2 — Evaluación (4–24 horas)

1. **¿Qué datos se vieron afectados y de cuántos titulares?**
2. **¿Hay datos sensibles, financieros o de menores de edad involucrados?** En esta escuela es muy
   probable que sí: el expediente contiene certificados médicos y hay alumnos menores.
3. **¿El riesgo para los titulares es alto?** Considerar: posibilidad de suplantación de identidad,
   exposición de información de salud, perjuicio económico.
4. Si el incidente fue de un **proveedor**, exigirle por escrito el detalle: qué pasó, qué datos, cuántos
   titulares, qué medidas tomó.

## Fase 3 — Notificación (sin dilaciones indebidas)

### A la Agencia de Protección de Datos Personales

Siempre que haya una vulneración con riesgo para los titulares. Contenido mínimo:

- Naturaleza de la vulneración: qué pasó y cómo.
- Categorías y volumen aproximado de datos y titulares afectados.
- Consecuencias probables.
- Medidas adoptadas y las que se adoptarán.
- Datos de contacto para el seguimiento.

### A los titulares afectados

Obligatorio cuando hay **riesgo alto**, y **también** cuando la brecha afecta **datos sensibles,
económicos/financieros/bancarios, o de niños, niñas y adolescentes** — supuestos que en esta escuela se
dan con facilidad.

Aviso en lenguaje claro: qué pasó, qué datos suyos se vieron afectados, qué pueden hacer para protegerse
y a quién contactar. Si el afectado es menor de edad, se avisa a su representante legal.

> **No notificar deliberadamente es una infracción gravísima** (hasta 20.000 UTM). El costo de notificar
> de más es siempre menor que el de no notificar.

## Fase 4 — Cierre y mejora

1. Determinar la **causa raíz**.
2. Implementar la **medida correctiva** que impide que vuelva a pasar.
3. **Actualizar** el RAT, este plan y la EIPD si el incidente reveló un riesgo no considerado.
4. Anotar la vulneración en `21719-registro-vulneraciones.md`, **se haya notificado o no**.

---

## Plantilla de aviso a la Agencia

> **Notificación de vulneración de seguridad — Art. 14 sexies Ley 21.719**
>
> Responsable: Sociedad Comercial Chillán Capacita Limitada, RUT 77.940.120-0.
> Contacto: conductorchillan@gmail.com
>
> El [FECHA], a las [HORA], detectamos [DESCRIPCIÓN DE LO OCURRIDO].
> Naturaleza de la vulneración: [pérdida / filtración / alteración / destrucción no autorizada].
> Datos afectados: [CATEGORÍAS — indicar expresamente si hay datos sensibles o de menores].
> Titulares afectados: aproximadamente [N].
> Consecuencias probables: [DESCRIPCIÓN].
> Medidas adoptadas: [CONTENCIÓN Y CORRECCIÓN].
> Medidas por adoptar: [PLAN].
> Notificación a titulares: [sí, el DD-MM-AAAA / no, por los siguientes motivos].

## Plantilla de aviso a los titulares

> Estimado/a [nombre]:
>
> Te escribimos para informarte de un incidente de seguridad ocurrido el [FECHA] que afectó
> información tuya que tenemos como escuela.
>
> **Qué pasó:** [descripción en lenguaje simple].
> **Qué datos tuyos se vieron afectados:** [categorías].
> **Qué hicimos:** [medidas].
> **Qué te recomendamos hacer:** [ej. cambiar tu contraseña, estar atento a comunicaciones sospechosas
> que usen tu nombre o RUT].
>
> Lamentamos lo ocurrido. Ante cualquier consulta escríbenos a conductorchillan@gmail.com.
>
> Sociedad Comercial Chillán Capacita Limitada

---
*Borrador generado con compliance-cl (pack ley-21719). No constituye asesoría legal; es un borrador fundado en la normativa chilena vigente.*
