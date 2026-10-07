# Guía preparada para la privacidad de Chrome Web Store

**Producto:** UPSE 1.0.7
**Fecha de preparación:** 6 de octubre de 2026  
**Estado:** texto de apoyo para revisión; no es un formulario enviado y la extensión no se ha publicado desde este trabajo.

Esta guía reúne las declaraciones que corresponden al código actual. Antes de enviar una ficha, revisa las etiquetas que muestre el Chrome Web Store Developer Dashboard y confirma que la política pública esté disponible en la URL indicada.

## Single purpose

**Propósito único propuesto:** permitir que una persona extraiga subtítulos de las clases que Platzi marca explícitamente como gratuitas y que solicita en la extensión, y los descargue como TXT o ZIP para su lectura.

La extensión no ofrece cuentas propias, pagos, publicidad, telemetría ni un servicio de backend. No agrega funciones de historial general, automatización de navegación, evasión de controles o recuperación de cookies. Las clases marcadas como no gratuitas o con metadata desconocida se bloquean; UPSE no valida cuentas de pago.

## Hosts y permisos

| Permiso o host | Motivo limitado y visible para el usuario |
| --- | --- |
| `https://platzi.com/*` | Solicitar el HTML de cursos y clases que el usuario introduce o que el parser necesita para esa extracción. |
| `https://www.platzi.com/*` | Admitir la variante `www` de las páginas de Platzi solicitadas. |
| `https://static.platzi.com/*` | Descargar las pistas VTT listadas por el metadata del reproductor de la clase actual marcada como gratuita. |
| `permissions: []` | La extensión no solicita `cookies`, `history`, `tabs`, almacenamiento de Chrome ni otros permisos privilegiados. |

Las peticiones de extracción usan `fetch` con `credentials: include`, por lo que el navegador puede enviar a Platzi las credenciales que el propio perfil administra. UPSE no lee sus valores, no los copia a un header `Cookie` y no los transmite a un servidor de UPSE. La declaración de **Authentication information: Sí** se mantiene de forma conservadora porque la petición puede usar la sesión del perfil; no significa que UPSE lea o almacene tokens.

## Remote code

**Código remoto: No.** Vite empaqueta JavaScript y CSS dentro de `dist/`; no se descarga ni ejecuta JavaScript remoto. Google Fonts (`fonts.googleapis.com`/`fonts.gstatic.com`) es una referencia de fuentes en CSS. El video opcional de tutorial se sirve desde Cloudinary como recurso multimedia. Ninguno de esos recursos es un canal para cargar código ejecutable de la extensión.

## Categorías de datos del formulario

La tabla siguiente es la declaración preparada. Las categorías y controles definitivos deben confirmarse en el dashboard al crear la ficha.

| Categoría | Declaración | Justificación factual |
| --- | --- | --- |
| Website content | **Sí** | UPSE solicita y procesa en memoria HTML de Platzi y VTT de subtítulos para crear la lista de clases y el texto exportable. |
| Web history | **Sí, limitado** | Se procesan solo las URLs que el usuario pega y las URLs VTT derivadas de la página solicitada. No se usa la API de historial ni se recopila el historial general. |
| Authentication information | **Sí, declaración conservadora** | `credentials: include` permite que el navegador envíe la sesión a Platzi. UPSE no lee, recolecta, persiste ni envía los valores de esas cookies a sus servidores. |
| Personal communications | **No** | No hay correo, chat, mensajes ni formularios de comunicación. |
| Personal information | **No como finalidad** | UPSE no solicita ni extrae perfiles, nombres, comentarios o credenciales como una función propia. Una respuesta HTML de Platzi puede contener datos incidentales que se procesan temporalmente para encontrar la estructura de la clase. |
| Financial and payment information | **No** | La extensión no cobra, no solicita pagos y no procesa tarjetas o información financiera. |
| Health and fitness, location, or sensitive categories | **No** | No hay funciones ni solicitudes para esas categorías. |
| User activity and analytics | **No collection** | El estado de extracción y las preferencias son locales; no hay analytics, telemetría ni reportes de uso propios. |

La clasificación conservadora de autenticación no debe describirse como validación de cuenta o suscripción. El resultado depende de las respuestas de Platzi; UPSE exige `class_is_free:true` para la clase actual y bloquea valores falsos o desconocidos. No realiza una autorización independiente ni evalúa flags de suscripción.

Las peticiones a Platzi, Google Fonts y Cloudinary pueden incluir metadatos ordinarios de red, como IP, navegador y URL de referencia, que cada proveedor trata conforme a sus propias políticas. UPSE no controla esos registros ni los usa para analítica propia.

## Disclosure y política pública

**URL de política propuesta para la ficha:** [UPSE Privacy Policy](https://github.com/DA0806/ultimate-platzi-subtitle-extractor/blob/feat/browser-extension/docs/PRIVACY_POLICY.md)

La política explica el procesamiento local y las peticiones a Platzi. También explica que el navegador administra las cookies, que UPSE no usa `chrome.cookies`, que los archivos exportados quedan bajo control del usuario y que las referencias a fuentes/video son recursos ordinarios de la interfaz.

El FAQ de Chrome Web Store debe revisarse especialmente en:

- **Q2**, sobre recolectar, transmitir o usar datos: las solicitudes se limitan a la extracción que el usuario inicia; la URL y la petición van a Platzi, y Platzi devuelve HTML o VTT al navegador. No existe un backend de UPSE que reciba ese contenido.
- **Q3**, sobre disclosure de datos procesados localmente: el hecho de que HTML, VTT, preferencias y resultados se procesen localmente no elimina la necesidad de describir el tratamiento en la política y en el formulario.
- **Q4**, sobre cookies y autenticación: la declaración conservadora de autenticación informa que el navegador puede enviar credenciales a Platzi; UPSE no lee ni almacena sus valores.

## Certificaciones de Limited Use

Si el formulario muestra estas certificaciones, el texto factual preparado para este producto es:

1. **No vendemos datos de usuario a terceros.** UPSE no tiene ventas de datos ni un backend de almacenamiento.
2. **No usamos ni transferimos datos de usuario para fines ajenos al propósito único descrito.** El HTML, VTT y las URLs se usan para la extracción iniciada por el usuario; las peticiones se dirigen a Platzi para obtener el contenido solicitado.
3. **No usamos ni transferimos datos de usuario para determinar solvencia crediticia ni para préstamos.** UPSE no tiene funciones financieras, de crédito o de evaluación de personas.

Estas son declaraciones preparadas para revisión del propietario de la extensión, no una certificación automática ni una garantía de aprobación por Google. El compromiso es mantener la extensión conforme a la [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data/), incluidos sus requisitos de Limited Use.

## Fuentes oficiales para la revisión

- [Chrome Web Store User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Chrome Web Store privacy practices dashboard](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data/)
- [Chrome Extensions network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
