# Anexo 6 — Plan de Respuesta a Brechas de Datos Personales

> **Expediente de Cumplimiento Ley 21.719** · Jorge Enrique Pérez Godoy Capacitación y Servicios EIRL
> **Clasificación:** documento operativo. Debe estar impreso y accesible sin depender del sistema —
> una brecha puede ser, precisamente, la pérdida de acceso a él.

**Empresa:** Jorge Enrique Pérez Godoy Capacitación y Servicios EIRL · **RUT:** 76.007.217-6
**Responsable del plan:** Jorge Enrique Pérez Godoy, representante legal
**Contacto:** otecchillan@gmail.com · **Versión:** 1.0 · **Fecha:** 2026-08-16

**Plazo legal:** notificar a la Agencia **sin dilaciones indebidas** (Art. 14 sexies). La ley chilena
**NO fija un plazo de 72 horas** — eso es estándar europeo. En la práctica: apenas se tenga claro que
hubo una vulneración y su alcance aproximado, se notifica; no se espera a tener el informe completo.

Además hay que mantener un **registro de todas las vulneraciones**, aunque no se notifiquen
(ver **Anexo 7 — Registro de Vulneraciones**).

---

## Roles

| Rol | Quién | Contacto |
|---|---|---|
| **Coordinador del incidente** | Representante legal — Jorge Enrique Pérez Godoy | otecchillan@gmail.com |
| **Apoyo técnico** | Responsable del sistema / desarrollador | `[COMPLETAR: nombre y teléfono]` |
| **Apoyo administrativo** | Secretaría en funciones | otecchillan@gmail.com |
| **Apoyo legal** | `[COMPLETAR: abogado de confianza — solo se activa si la brecha es grande o llega fiscalización]` | |

## Qué cuenta como brecha

Cualquier **destrucción, pérdida, filtración o alteración no autorizada** de datos personales. Casos
concretos y realistas en esta Autoescuela:

- Un expediente de alumno (cédula, certificado médico si lo tiene cargado) queda accesible públicamente en internet.
- Un correo con la nómina de alumnos de un curso se envía por error a un destinatario equivocado, o con
  todos los correos visibles en copia abierta en vez de copia oculta.
- **Se le envía a una empresa cliente información de sus trabajadores que excede lo pactado** (por
  ejemplo, un certificado médico). Esto es una cesión indebida y cuenta como brecha.
- Se pierde o roban un computador o teléfono con acceso al sistema.
- Una cuenta de secretaría o administrador es comprometida (contraseña filtrada, phishing).
- Supabase, Google o Zoom informan un incidente que afecta a nuestros datos.
- Un ex trabajador o un relator externo conserva acceso al sistema después de terminar su vínculo.

---

## Fase 1 — Detección y contención (0–4 horas)

1. Registrar **fecha y hora exactas** de la detección y quién la detectó.
2. **Contener de inmediato:**
   - Revocar el acceso de la cuenta comprometida.
   - Cambiar contraseñas y rotar las credenciales del sistema.
   - Si hay un archivo expuesto públicamente, quitarlo de circulación.
   - Si el envío indebido fue por correo, solicitar de inmediato al destinatario su eliminación y dejar
     constancia escrita de esa solicitud.
3. **Abrir la bitácora del incidente** — desde este momento se anota todo, con hora.
4. **No borrar evidencia.** Los registros de auditoría del sistema (que guardan usuario, acción y fecha)
   y el registro de consentimientos (que guarda la IP de cada consentimiento otorgado) son la principal
   fuente para reconstruir qué pasó.

## Fase 2 — Evaluación (4–24 horas)

1. **¿Qué datos se vieron afectados y de cuántos titulares?**
2. **¿Hay datos sensibles, financieros o de menores de edad involucrados?** En esta Autoescuela es muy probable
   que sí: el expediente contiene certificados médicos y hay alumnos menores.
3. **¿El riesgo para los titulares es alto?** Considerar: posibilidad de suplantación de identidad,
   exposición de información de salud, perjuicio económico, y —caso propio de la Autoescuela— **perjuicio en la
   relación laboral** del trabajador si el dato llegó a su empleador.
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
económicos/financieros/bancarios, o de niños, niñas y adolescentes** — supuestos que en esta Autoescuela se dan
con facilidad.

Aviso en lenguaje claro: qué pasó, qué datos suyos se vieron afectados, qué pueden hacer para protegerse
y a quién contactar. Si el afectado es menor de edad, se avisa a su representante legal.

### A la empresa cliente, cuando corresponde

Si la brecha afecta datos que una **empresa cliente** nos entregó para capacitar a su personal, hay que
avisarle a ella además de a los trabajadores afectados: respecto de esos datos actuamos como encargados y
el contrato lo exige (Anexo 8, Modelo B, cláusula B.3.5 — **dentro de 24 horas**). **Avisarle a la empresa no reemplaza el aviso a los trabajadores**, que son los
titulares.

> **No notificar deliberadamente es una infracción gravísima** (hasta 20.000 UTM). El costo de notificar
> de más es siempre menor que el de no notificar.

## Fase 4 — Cierre y mejora

1. Determinar la **causa raíz**.
2. Implementar la **medida correctiva** que impide que vuelva a pasar.
3. **Actualizar** el Registro de Actividades de Tratamiento (Anexo 1), este plan y la Evaluación de
   Impacto (Anexo 2) si el incidente reveló un riesgo no considerado.
4. Anotar la vulneración en el **Anexo 7 — Registro de Vulneraciones**, **se haya notificado o no**.

---

## Plantilla de aviso a la Agencia

> **Notificación de vulneración de seguridad — Art. 14 sexies Ley 21.719**
>
> Responsable: Jorge Enrique Pérez Godoy Capacitación y Servicios EIRL, RUT 76.007.217-6.
> Contacto: otecchillan@gmail.com
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
> información tuya que tenemos como institución de capacitación.
>
> **Qué pasó:** [descripción en lenguaje simple].
> **Qué datos tuyos se vieron afectados:** [categorías].
> **Qué hicimos:** [medidas].
> **Qué te recomendamos hacer:** [ej. cambiar tu contraseña, estar atento a comunicaciones sospechosas
> que usen tu nombre o RUT].
>
> Lamentamos lo ocurrido. Ante cualquier consulta escríbenos a otecchillan@gmail.com.
>
> Jorge Enrique Pérez Godoy Capacitación y Servicios EIRL

---
*Documento preparado internamente sobre la base del texto vigente de la Ley 21.719. No constituye asesoría legal.*
