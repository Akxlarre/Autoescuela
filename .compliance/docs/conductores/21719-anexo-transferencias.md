# Anexo 9 — Transferencia Internacional de Datos

> **Expediente de Cumplimiento Ley 21.719** · Sociedad Comercial Chillán Capacita Limitada
> **Clasificación:** contrato con terceros. Se firma o se incorpora por referencia con cada proveedor
> extranjero. Este recuadro no forma parte del texto que se firma.

**Versión:** 1.0 · **Fecha:** 2026-08-16

> Ampara el envío de datos personales fuera de Chile. Se firma o se incorpora por referencia con **cada
> proveedor extranjero**. Mecanismo: **Cláusulas Contractuales Modelo** aprobadas por el Ministerio de
> Economía (Resolución RAEX202503748, Diario Oficial 19-12-2025).

---

## 1. Partes

- **Exportador de datos:** Sociedad Comercial Chillán Capacita Limitada, RUT 77.940.120-0, domicilio en
  Carrera 74, comuna de Chillán, Provincia de Diguillín, Región de Ñuble (Chile).
- **Importadores de datos:** los proveedores individualizados en la sección 3.

## 2. Mecanismo de transferencia

Las partes adoptan las **Cláusulas Contractuales Modelo** del Ministerio de Economía, Fomento y
Turismo, aprobadas por **Resolución Exenta RAEX202503748**, publicada en el Diario Oficial el
**19 de diciembre de 2025**, como garantía adecuada conforme a la Ley 21.719.

El texto oficial de dichas cláusulas debe **anexarse íntegro** a este documento, o **incorporarse por
referencia expresa** en el contrato con cada proveedor. El Exportador mantiene una copia íntegra
archivada junto a este expediente y la pone a disposición de cualquier importador que la solicite.

> **Importante:** el DPA estándar que ofrece cada proveedor **no basta por sí solo**. La transferencia
> debe estar respaldada por estas cláusulas modelo, o por otro mecanismo válido: decisión de adecuación
> del país de destino, normas corporativas vinculantes, o consentimiento expreso del titular para la
> transferencia específica.

## 3. Inventario de transferencias

| # | Importador | País de destino | Qué recibe | Finalidad | Rol | Mecanismo | Estado |
|---|---|---|---|---|---|---|---|
| 1 | **Supabase Inc.** | Estados Unidos `[CONFIRMAR la región concreta del proyecto en el panel de Supabase — puede ser EE.UU. o Sudamérica; si el proyecto está en São Paulo, el destino es Brasil]` | La totalidad de la base de datos: identificación de alumnos y trabajadores, expedientes con **certificado médico (si el alumno lo sube) y cédula**, académicos, pagos, registros de auditoría, direcciones IP de consentimiento | Infraestructura de base de datos, almacenamiento de archivos y autenticación | Encargado | Cláusulas modelo | ❌ **Pendiente de incorporar** |
| 2 | **Google LLC (Gmail)** | Estados Unidos | Todo lo que un titular envíe al canal de datos para ejercer sus derechos, **incluida la imagen de su cédula de identidad**, más la correspondencia general | Alojamiento de la casilla `conductorchillan@gmail.com`, que es el canal de ejercicio de derechos publicado en la política | Encargado | Cláusulas modelo | ❌ **Pendiente de incorporar** |
| 2-bis | **Proveedor de hosting del dominio `autoescuelachillan.cl`** `[COMPLETAR: razón social con la que factura a la escuela]`. Opera el servidor `rs7-va.serverhostgroup.com` sobre infraestructura de **OVH SAS** | **Estados Unidos** — Warrenton, Virginia (verificado 17-08-2026 por la IP pública del servidor, `40.160.21.52`) | Nombre y correo de alumnos e instructores, y el contenido de los correos salientes, incluidos los certificados adjuntos | Alojamiento del sitio público y **servidor de correo saliente** (SMTP autenticado sobre TLS) | Encargado | Cláusulas modelo | ❌ **Pendiente de incorporar** — y requiere además contrato de tratamiento (Anexo 8) |
| 3 | **Zoom Video Communications, Inc.** | Estados Unidos | Nombre, correo y registro de conexión | Clases en línea | Encargado | Cláusulas modelo | ❌ **Pendiente de incorporar** `[CONFIRMAR que efectivamente se usa Zoom y bajo qué plan]` |

## 4. Compromisos del importador

Cada importador se obliga a: tratar los datos **solo según las instrucciones** del exportador; aplicar
medidas de seguridad equivalentes a las exigidas por la ley chilena; **no transferir a terceros** sin
garantías equivalentes; **notificar sin dilación** cualquier vulneración de seguridad al exportador; y
colaborar ante las solicitudes de los titulares y de la Agencia de Protección de Datos Personales.

## 5. Declaración en la política de privacidad

Estas transferencias están declaradas en la sección 4 de la **Política de Privacidad** del Exportador
("Con quién compartimos los datos"), como exige el deber de información del Art. 14 ter.

## 6. Qué hacer, en concreto

1. **Confirmar la región** en que está alojada la infraestructura contratada, en el panel de
   administración del proveedor. Es el dato que define el país de destino. Si es una región
   sudamericana, corregir la fila 1 **y también** los Anexos 1, 2 y 3, que hoy declaran Estados Unidos.
2. Con cada proveedor: revisar si ya ofrece un adendum de tratamiento de datos y **anexarle las cláusulas
   modelo chilenas**. Con proveedores grandes como Supabase, Google y Zoom, esto normalmente se hace
   aceptando su adendum en línea y **archivando la constancia**, más la incorporación por referencia de
   las cláusulas modelo.
3. **Archivar la evidencia** de cada aceptación junto a este expediente. Ante una fiscalización, lo que
   se pide es el documento, no la afirmación de que existe.
4. Repetir el paso al **contratar cualquier proveedor nuevo** y al renovar los existentes.

---
*Documento preparado internamente sobre la base del texto vigente de la Ley 21.719. No constituye asesoría legal.*
