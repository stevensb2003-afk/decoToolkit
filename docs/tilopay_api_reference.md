# Referencia de API Tilopay

Esta guía contiene la estructura técnica de la API de Tilopay para referencia futura en solución de problemas o expansión del sistema.

---

## 1. Autenticación (Tokens de Seguridad)
Utilizado para obtener el token que autoriza el resto de las llamadas.

- **Endpoint Estándar**: `POST /api/v1/login`
- **Payload**:
  - `apiuser`: Nombre de usuario de la API.
  - `password`: Contraseña de la API.

---

## 2. Generación de Cobros y Links (Process Payment)
Genera la redirección al formulario de pago o links compartibles.

- **Endpoints**: 
  - `POST /api/v1/processPayment` (Redirección directa)
  - `POST /api/v1/createLinkPayment` (Links compartibles)
- **Campos Obligatorios**:
  - `key`: Llave del comercio.
  - `amount`: Monto (ej. "100.00").
  - `currency`: Moneda ISO (USD, CRC).
  - `orderNumber`: ID alfanumérico de orden del sistema local.
  - `capture`: `1` para captura inmediata.
  - `subscription`: `0` o `1`.
  - `redirect`: URL de retorno (recibe respuesta vía GET).
  - `platform`: Nombre de la aplicación (ej. "DecoToolkit").
  - `token_version`: "v2".
  - `returnData`: Información extra (codificada en Base64).
- **Facturación (Requeridos)**:
  - `billToFirstName`, `billToLastName`
  - `billToEmail`, `billToTelephone`
  - `billToAddress`, `billToCity`, `billToState`, `billToZipPostCode`, `billToCountry`.

---

## 3. Consultas y Conciliación
Para verificar de servidor a servidor el estado real de un pago.

- **Consulta Específica**: `POST /api/v1/consult`
  - **Campos**: `key`, `orderNumber`.
- **Consulta por Rango**: `POST /api/v1/consultTransactions`
  - **Campos**: `key`, `startDate`, `endDate`, `onlyAproved`, `environment`.

---

## 4. Webhooks y Notificaciones
Tilopay envía notificaciones POST a estas URLs (especialmente útil en suscripciones).

- `webhook_subscribe`: Tras suscripción exitosa.
- `webhook_payment`: Tras cargo exitoso.
- `webhook_rejected`: Tras cargo fallido.

---

## Regla de Oro
Todas las peticiones (excepto Login) deben incluir:
- **Header**: `Authorization: bearer [token]`
- **Header**: `Content-Type: application/json`
- **Accept**: `application/json`
