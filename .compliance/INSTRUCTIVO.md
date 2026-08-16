# Instructivo — qué hacer ante cada situación

**Para:** secretarías y representante legal de ambas sociedades
**Versión:** 1.0 · **Fecha:** 16 de agosto de 2026

Manual operativo. No hay que leerlo entero: se busca la situación y se sigue el paso a paso.
**Cuando entre una secretaria nueva, este es el documento que se le entrega.**

| Sociedad | Correo del canal |
|---|---|
| Sociedad Comercial Chillán Capacita Ltda. (escuela de conductores) | conductorchillan@gmail.com |
| Jorge Enrique Pérez Godoy Capacitación y Servicios EIRL (OTEC) | otecchillan@gmail.com |

---

## A. Un alumno pide ver, corregir o borrar sus datos

**Tienes 30 días corridos**, prorrogables una sola vez por 30 más avisándole. El plazo corre desde que
llega el correo, no desde que lo lees.

1. **Anótalo el mismo día** en la bitácora de `21719-canal-derechos.md` (fecha, quién, qué pide).
2. **Confirma que es él.** Foto de su cédula, o que escriba desde el correo de su matrícula. Si es
   menor de edad, tiene que pedirlo su papá, mamá o representante legal.
   → **Si no puedes confirmar quién es, no entregues nada.** Entregar datos a la persona equivocada es
   tan grave como no entregarlos.
3. **Ejecuta lo que pidió:**
   - *Ver sus datos (acceso)* → arma un documento con su ficha, matrícula, asistencia, evaluaciones,
     pagos y documentos.
   - *Llevárselos (portabilidad)* → lo mismo, pero en Excel o CSV.
   - *Corregir* → corrígelo en el sistema.
   - *Borrar* → **ojo, ver la tabla de abajo.**
   - *Dejar de recibir promociones* → sácalo de la lista, de inmediato.
4. **Respóndele por escrito** y guarda ese correo. La evidencia de haber respondido es lo que protege a
   la escuela.

### Qué NO se puede borrar aunque lo pida

| Qué pide borrar | ¿Se puede? | Qué le respondes |
|---|---|---|
| Su registro de alumno, asistencia, certificación | **No, hasta los 5 años** | Que la normativa obliga a conservarlo y que se elimina solo al cumplir el plazo |
| Boletas y pagos | **No, hasta los 6 años** | Que lo exige el Código Tributario |
| Promociones y correos comerciales | **Sí, siempre y de inmediato** | Que ya está hecho |
| Su preinscripción, si nunca se matriculó | **Sí, siempre** | Que ya está eliminada |
| Documentos del expediente, si ya egresó | Sí, si no hay nada pendiente | Que se eliminaron |

**Nunca dejes un correo sin responder.** Lo que se sanciona es el silencio, no la negativa fundada.
Si no puedes hacer algo, respóndele explicando por qué.

---

## B. Se filtraron datos, se perdió un equipo o entraron a una cuenta

**Avisa al representante legal de inmediato.** No esperes a entender todo lo que pasó.

**Qué cuenta como brecha:** un expediente que quedó visible en internet, un correo con datos de alumnos
enviado a quien no era, un notebook o celular robado con acceso al sistema, una cuenta hackeada, un aviso
de Supabase/Google/Zoom, o un ex trabajador que todavía tiene acceso.

### Primeras 4 horas

1. **Anota la hora exacta** en que se detectó y quién lo detectó.
2. **Corta el acceso:** desactiva la cuenta comprometida, cambia las contraseñas.
3. Si hay un archivo expuesto, **quítalo**.
4. Si fue un correo mal enviado, **pídele por escrito al destinatario que lo borre** y guarda esa
   solicitud.
5. **No borres nada del sistema.** Los registros de auditoría son la evidencia de qué pasó.

### Primeras 24 horas

6. Determinen **qué datos** y **de cuántos alumnos**.
7. Pregunta clave: **¿hay certificados médicos, datos de pago o alumnos menores de edad involucrados?**
   En estas escuelas casi siempre la respuesta es sí.

### Después

8. **Avisar a la Agencia de Protección de Datos** sin dilaciones indebidas. No hay que esperar a tener el
   informe completo. La plantilla está en `21719-plan-respuesta-brechas.md`.
9. **Avisar a los alumnos afectados** — obligatorio si hay riesgo alto, y **también** si hay datos de
   salud, de pago o de menores. Si es menor, se avisa al apoderado.
10. *(Solo OTEC)* Si los datos eran de trabajadores que mandó una empresa, **avísale también a la
    empresa**. Eso no reemplaza avisarle a los trabajadores.
11. **Anótalo en `21719-registro-vulneraciones.md`**, aunque hayan decidido no notificar.

> **No avisar a propósito es infracción gravísima** (hasta 20.000 UTM). Siempre conviene avisar de más.

---

## C. Llega la Agencia de Protección de Datos a fiscalizar

**Este es el único caso en que conviene llamar a un abogado.**

1. **Una sola persona responde** (el representante legal). Todo por escrito.
2. Fíjate en **qué etapa es**: ¿piden información (preliminar) o ya es un **pliego de cargos** (formal)?
3. **Los antecedentes ya están reunidos** en la carpeta `.compliance/`: el registro de tratamientos, la
   política, la evaluación de impacto, el plan de brechas, el registro de vulneraciones y los contratos.
4. **Responde en plazo, cargo por cargo**, mostrando lo que ya se corrigió.
5. **Atenuantes a tu favor:** son empresa de menor tamaño y les aplica la gracia de 12 meses; además
   pueden mostrar que hicieron una auditoría propia y un plan de remediación con fechas.
6. **Nunca** ocultes ni destruyas documentos, ni dejes pasar un plazo.

---

## D. Cambia la secretaria encargada de datos

1. **Revoca su acceso al sistema el mismo día** en que deja el cargo.
2. Anota el cambio en el **Anexo A del RAT** de la sociedad que corresponda (fecha, quién sale, quién
   entra).
3. Entrégale este instructivo a la persona que entra.
4. **El correo del canal no cambia nunca** — está publicado en la política de privacidad. Solo cambia
   quién lo revisa.

---

## E. Se contrata un proveedor nuevo que verá datos de alumnos

Aplica a: un sistema nuevo, una empresa de cobranza, una agencia de marketing, un contador que reciba
padrones, un proveedor de cámaras que administre las grabaciones.

1. **Firmar el contrato de tratamiento (DPA)** antes de darle acceso. Modelo en `21719-dpa.md`.
2. Si el proveedor procesa **fuera de Chile**, incorporar además las **cláusulas modelo** y archivar la
   constancia (`21719-anexo-transferencias.md`).
3. **Agregar la actividad al RAT** antes de que empiece a operar, no después.

---

## F. Una empresa quiere capacitar a sus trabajadores *(solo OTEC)*

1. **Firmar el Modelo B** del DPA junto con el contrato de capacitación
   (`docs/otec/21719-dpa.md`).
2. **Entregarle el aviso a cada trabajador** al inicio del curso — el texto está en la sección 6 de
   `docs/otec/21719-consentimiento.md`. El titular es el trabajador, no la empresa.
3. **A la empresa se le informa solo asistencia y resultado.** Nunca el certificado médico ni documentos
   de identidad.
4. Si la empresa pide más datos de un trabajador, **decirle que los pida el propio trabajador**.

---

## G. Calendario de revisión

| Cuándo | Qué | Quién |
|---|---|---|
| **Antes del 1-dic-2026** | Completar el plan de acción del `RESUMEN.md` | Representante legal |
| Anual, o ante cualquier cambio | Revisar y actualizar el **RAT** de cada sociedad | Encargada de datos |
| Anual | Revisar la **EIPD** | Representante legal |
| Anual | Capacitar al equipo con este instructivo | Encargada de datos |
| Trimestral | Anotar en el registro de vulneraciones que se revisó, aunque no haya pasado nada | Encargada de datos |
| Al contratar o renovar un proveedor | DPA + cláusulas modelo | Representante legal |
| Cada cambio relevante del sistema | Re-correr la auditoría de cumplimiento | Desarrollador |

---

## H. Reglas cortas que evitan la mayoría de los problemas

- **Nunca** mandes un correo masivo a alumnos con las direcciones a la vista. Usa copia oculta.
- **Nunca** pidas el certificado médico en un curso que no lo exige.
- **Nunca** le mandes a un empleador el certificado médico de su trabajador.
- **Nunca** compartas una cuenta del sistema entre dos personas.
- **Nunca** te lleves la base de datos a un computador personal.
- **Siempre** revoca el acceso el mismo día en que alguien deja de trabajar.
- **Siempre** responde los correos del canal de datos, aunque sea para decir que no se puede.

---
*Guía operativa generada con compliance-cl. No constituye asesoría legal.*
