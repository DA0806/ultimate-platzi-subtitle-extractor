# Política de privacidad de UPSE

**Fecha de vigencia:** 6 de octubre de 2026  
**Producto:** Ultimate Platzi Subtitle Extractor (UPSE) 1.0.7, extensión local para navegadores Chromium
**Contacto:** <https://github.com/DA0806/ultimate-platzi-subtitle-extractor/issues>

Esta política describe el comportamiento de la extensión UPSE 1.0.7. Es una declaración del flujo implementado en este repositorio y no constituye asesoría legal ni una garantía de aprobación de Chrome Web Store.

## Alcance

Esta política se refiere a la extensión cargada en Chrome, Edge u otro navegador basado en Chromium. El repositorio también contiene un modo web local para desarrollo que funciona de forma distinta: ese modo puede aceptar una cookie de Platzi introducida manualmente y guardarla en `platzi_session` para usar los proxies de Vite. Esa cookie manual no forma parte del flujo de la extensión empaquetada y se describe por separado en la guía del proyecto.

## Qué procesa la extensión

Cuando el usuario introduce una URL de curso o clase, la extensión procesa en memoria:

- la URL solicitada;
- el HTML que Platzi devuelve para esa URL;
- la metadata SSR de la clase (`class_id`, `class_position`, `course_id`, `class_name` y `class_is_free`) para confirmar que la página actual está marcada como gratuita;
- las URLs VTT de subtítulos que Platzi entrega en el metadata del reproductor de la clase actual;
- el contenido VTT descargado desde `static.platzi.com`;
- el texto limpio, la selección de clases, estados de extracción y datos necesarios para crear TXT o ZIP.

Las solicitudes a Platzi salen desde el navegador del usuario. Platzi recibe la URL y los headers ordinarios de la petición, y devuelve el HTML o VTT al navegador. El navegador administra sus cookies y puede enviarlas a Platzi cuando `credentials: include` lo permite. UPSE no utiliza la API `chrome.cookies`, no lee valores de cookies, no construye encabezados `Cookie`, no copia tokens y no transmite credenciales a un servidor de UPSE.

La extensión conserva preferencias propias, tema, idioma y el estado de finalización del setup en el almacenamiento local de la extensión. El contenido del curso y los subtítulos se mantienen en memoria mientras trabaja la página. Los archivos TXT y ZIP se generan mediante el navegador y quedan en la ubicación de descargas que controla el usuario; UPSE no los sube a un servidor.

## Categorías de datos y finalidad

| Categoría | Datos involucrados | Finalidad | Tratamiento en UPSE |
| --- | --- | --- | --- |
| Contenido de sitios web | URLs de Platzi, HTML y VTT solicitados | Encontrar clases, subtítulos e idiomas | Procesamiento local en memoria; Platzi recibe las peticiones |
| Actividad de navegación | Solo las URLs que el usuario pega o que se extraen del HTML solicitado | Realizar la extracción elegida | No usa la API de historial ni recopila el historial general |
| Información de autenticación | Credenciales gestionadas por el navegador al solicitar Platzi | Permitir que Platzi aplique la sesión y permisos del perfil | Declaración conservadora por el uso de `credentials: include`; UPSE no lee, recolecta ni persiste los valores |
| Preferencias | Tema, idioma y setup | Recordar la configuración de la extensión | Almacenamiento local de la extensión |
| Archivos exportados | TXT o ZIP elegidos por el usuario | Entregar el resultado solicitado | Creación y descarga local; no se envían a UPSE |

UPSE solo busca o descarga VTT cuando la clase actual está marcada explícitamente como gratuita por Platzi. Una clase marcada como no gratuita o con metadata desconocida se bloquea antes de solicitar VTT. UPSE no solicita pagos, no vende datos, no tiene cuentas propias, no tiene telemetría ni analytics propios y no mantiene un backend para almacenar contenido o credenciales. No se implementa login contra Platzi con correo y contraseña; una sesión de pago no se valida desde UPSE.

## Recursos de terceros

La hoja de estilos puede solicitar fuentes desde Google Fonts (`fonts.googleapis.com` y `fonts.gstatic.com`). El tutorial opcional puede solicitar un video desde Cloudinary. Son recursos web de la interfaz, no código ejecutable remoto ni un canal para enviar los subtítulos extraídos. Esos proveedores pueden recibir metadatos ordinarios de la solicitud, como IP, navegador y URL de referencia, y los tratan conforme a sus propias políticas; UPSE no controla sus registros.

La extensión no descarga JavaScript remoto, no ejecuta código remoto y no usa un servidor intermediario propio. Las únicas solicitudes operativas de extracción están restringidas por el manifest a `https://platzi.com`, `https://www.platzi.com` y `https://static.platzi.com`.

## Retención, limpieza y desinstalación

- La memoria de extracción se pierde al recargar o cerrar la pestaña de UPSE.
- Las preferencias permanecen en el almacenamiento local de la extensión hasta que el usuario pulsa **Borrar datos de UPSE**, limpia los datos del sitio o desinstala la extensión.
- La limpieza interna elimina solo las claves propias `platzi_session` y `platzi_settings`, incluyendo restos heredados de versiones con autenticación manual. No elimina cookies de Platzi, no cierra la sesión del usuario, no borra el historial y no elimina archivos exportados.
- Los TXT y ZIP descargados se conservan según la configuración de descargas del navegador. El usuario debe eliminarlos desde su sistema si ya no los necesita.
- Al desinstalar la extensión, el navegador gestiona la eliminación del almacenamiento de la extensión. La sesión de Platzi y los archivos descargados pertenecen al navegador y al sistema del usuario y no son eliminados por UPSE.

## Seguridad y uso autorizado

El usuario debe mantener su navegador y su cuenta protegidos, usar la extensión solo con contenido al que tenga derecho de acceso y respetar los términos de Platzi, los derechos de autor y las medidas de seguridad del sitio. UPSE no intenta evadir MFA, DRM, paywalls, límites de solicitudes ni controles de autorización. Un error `401` o `403` se muestra como resultado de Platzi y no se transforma en una validación de suscripción. La guardia de clase gratuita no certifica derechos de exportación ni el acceso de una cuenta de pago.

## Compromiso con las políticas de Chrome Web Store

UPSE se mantendrá conforme a la [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data/), incluidos los principios de Limited Use. Si cambia el propósito, los hosts o el tratamiento de datos, se actualizarán el producto, la ficha y esta política antes de una nueva publicación.

## Cambios y contacto

Si el flujo de datos cambia, esta política deberá actualizarse junto con la versión correspondiente de la extensión. Para preguntas o reportar un problema, usa <https://github.com/DA0806/ultimate-platzi-subtitle-extractor/issues>. No incluyas cookies, tokens ni contenido privado en un reporte.
