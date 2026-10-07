# Guía de la extensión UPSE 1.0.7

Esta guía describe la extensión Manifest V3 de Ultimate Platzi Subtitle Extractor (UPSE), su instalación local y sus dos modos de acceso. La entrega está preparada para revisión; todavía no significa que la extensión haya sido publicada o aprobada por Chrome Web Store.

## Qué hace la extensión

UPSE abre un espacio de trabajo en una pestaña del navegador. Recibe una URL de curso o clase de Platzi, solicita el HTML y las pistas VTT listadas por el metadata del reproductor de la clase actual, permite seleccionar clases e idiomas y genera archivos TXT o ZIP localmente.

La extensión 1.0.7 conserva el flujo introducido en 1.0.4: las peticiones a `https://platzi.com` y `https://static.platzi.com` usan las credenciales nativas del perfil mediante `fetch` con `credentials: include`. Antes de encontrar o descargar VTT, UPSE exige que el HTML de la clase actual contenga un evento SSR `material-view`/`page-view` con `class_id`, `class_position`, `course_id`, `class_name` y `class_is_free: true`, vinculado a la URL canónica y al título de esa página. El parser solo lee el stream textual Next Flight del índice `1`, respeta los encabezados `id:record` y consume los frames `T` por longitud UTF-8 hexadecimal; no interpreta texto de esos frames como JSON. Luego solo acepta las pistas en `materialInfo.video.movin.subtitles` del registro de reproductor de esa misma clase; no toma URLs `.vtt` de comentarios, texto o metadata no vinculada. Las clases con `class_is_free: false` o metadata desconocida se bloquean. La extensión no usa `chrome.cookies`, no copia encabezados Cookie, no guarda valores de cookies y no tiene un servidor propio. Esta guardia confirma únicamente la marca de clase gratuita que entrega Platzi; no valida suscripciones ni derechos de cuentas de pago.

El modo web local conserva un flujo separado para desarrollo: Vite puede recibir una cookie introducida manualmente y reenviarla a través de sus proxies locales. Ese flujo no describe el comportamiento de la extensión empaquetada.

## Compilar y empaquetar

Requisitos: Node.js compatible con Vite 8 (`^20.19.0` o `>=22.12.0`) y npm.

```bash
npm install
npm run lint
npm run build:extension
```

`build:extension` ejecuta el build de Vite y crea `dist/upse-extension.zip`. El ZIP contiene el `manifest.json`, el service worker, la aplicación estática, los iconos y los assets con rutas relativas. El paquete no incluye un servidor Node ni necesita `npm run dev` para el flujo de extensión.

## Instalar localmente en Chrome o Edge

1. Descomprime `dist/upse-extension.zip` en una carpeta de trabajo. También puedes usar directamente la carpeta `dist/` recién generada.
2. Abre `chrome://extensions` en Google Chrome o `edge://extensions` en Microsoft Edge.
3. Activa **Modo de desarrollador**.
4. Selecciona **Cargar descomprimida** (Chrome) o **Cargar extensión sin empaquetar** (Edge) y elige la carpeta que contiene el `manifest.json` en su raíz.
5. Fija UPSE desde el menú de extensiones y pulsa su icono. El service worker abre la consola en una pestaña completa.

Usa el mismo perfil del navegador en el que abriste Platzi. La extensión no puede trasladar una sesión desde otro perfil y no solicita que copies cookies.

## Flujo de uso

1. Abre `https://platzi.com` en el mismo perfil e inicia sesión si el contenido requiere autenticación.
2. Abre UPSE desde el icono de la extensión.
3. Completa el setup de bienvenida, funciones y acceso por navegador. La extracción solo continúa para clases que Platzi marque explícitamente como gratuitas; no depende de que UPSE lea una cookie.
4. Pega una URL de curso o clase, por ejemplo `https://platzi.com/cursos/react/`, y pulsa **Analizar URL**.
5. Selecciona clases e idioma. UPSE conserva el resultado en memoria durante la sesión.
6. Pulsa **Iniciar extracción**. Cada solicitud puede terminar como `Listo`, `Sin video` o `Error`.
7. Copia el TXT o descarga un TXT unificado o ZIP. Los archivos exportados se crean mediante la descarga del navegador y quedan bajo el control del usuario.

Un `401` o `403` de Platzi indica que la respuesta no autorizó esa solicitud; no debe interpretarse automáticamente como una sesión inválida, porque también pueden existir restricciones del contenido, cambios del sitio o controles de tráfico. Si la metadata de la clase es no gratuita o desconocida, UPSE bloquea antes de buscar o descargar VTT y muestra que no puede verificar el acceso de una cuenta de pago. UPSE no intenta evadir MFA, DRM, paywalls, límites ni controles de acceso.

## Ajustes y limpieza

El engranaje permite cambiar idioma y tema, abrir Platzi y borrar los datos propios de UPSE. **Borrar datos de UPSE** requiere confirmación y solo elimina preferencias de la aplicación y restos de autenticación local heredados (`platzi_session` y `platzi_settings`).

La acción no borra cookies del navegador, no cierra la sesión de Platzi, no modifica el historial y no elimina archivos TXT o ZIP que ya descargaste. Desinstalar la extensión elimina su almacenamiento de extensión según el navegador; los archivos exportados y la sesión de Platzi siguen siendo responsabilidad del usuario.

## Privacidad y documentación para la tienda

Lee la [Política de privacidad](PRIVACY_POLICY.md) para el alcance del procesamiento y la [guía de privacidad de Chrome Web Store](CHROME_WEB_STORE_PRIVACY.md) para las declaraciones preparadas del formulario. El enlace de contacto es <https://github.com/DA0806/ultimate-platzi-subtitle-extractor/issues>.

La extensión procesa URLs, HTML y VTT para extraer subtítulos, y mantiene preferencias localmente. Platzi recibe las peticiones y devuelve HTML o VTT al navegador; el navegador gestiona las cookies de Platzi y UPSE no recolecta ni persiste sus valores en la extensión. La hoja de estilos referencia Google Fonts y el tutorial puede solicitar un video de Cloudinary; esos proveedores pueden tratar metadatos ordinarios conforme a sus propias políticas.

## Evidencia y límites de validación

- Se recibió una comprobación manual del usuario en Edge: con su sesión iniciada, la extensión instalada pudo extraer correctamente un curso real de Platzi.
- También se recibió una comprobación manual en Chrome sin sesión con contenido público: se reportó extracción de hasta 12 clases en dos cursos públicos de GitHub y una primera transcripción pública. Eso no demuestra acceso al curso completo, no demuestra bypass de controles y no demuestra autorización para contenido premium.
- Las pruebas automatizadas locales cubren el modo nativo sin la API `chrome.cookies`, las credenciales `include`, los límites de URL, la migración de almacenamiento heredado, el manifest, lint y el build del ZIP.
- La comprobación automatizada del paquete cargó el service worker y la interfaz en un perfil temporal de Edge, sin errores propios; Chrome 154 está instalado, pero su canal automatizado no expuso la extensión aunque conservó los flags de carga. Las comprobaciones manuales de extracción del usuario corresponden a entregas anteriores y no prueban esta versión 1.0.7 en Chrome.
- Una comprobación técnica anónima en un perfil Edge temporal observó `class_is_free:true` para la clase 1 (`class_id:70337`) y `class_is_free:false` para la clase 2 (`class_id:70442`) y la clase 3 del [curso público de JavaScript](https://platzi.com/cursos/javascript/). La clase 1 mostró reproductor; las clases 2/3 mostraron “Desbloquea tu primera clase gratis”. En las tres apareció `drm_protected:false`, por lo que ese campo no se usa como autorización. El HTML también incluyó `mv_gate_reason:"not_logged"` en ambos tipos de clase, por lo que tampoco es una señal suficiente.
- En esa misma respuesta SSR, el registro de reproductor de la clase actual expuso `materialInfo.id`, `materialInfo.title` y `materialInfo.video.movin.subtitles`. La comprobación aislada obtuvo tres URLs VTT para `70337`; el parser solo las acepta cuando `id` y título coinciden con el `page-view` y la URL canónica actuales. Un texto incrustado o un objeto de otra clase no se considera prueba.
- La misma comprobación recibió `403` en `/api/v5/users/credentials/` y `/plans/v1/table-price/` sin sesión. Se bloquearon solicitudes `.m3u8`, `.vtt`, video y audio antes de leerlas. No se copió ningún perfil ni cookie y no se ejecutó un reproductor.
- El campo `class_is_free:false` no fue probado con una cuenta de pago; por eso UPSE lo bloquea de forma conservadora aunque la cuenta pudiera tener derechos. No se afirma que una sesión de pago quede validada ni que UPSE pueda distinguir suscripciones.
- Sigue pendiente una prueba automatizada autenticada en un perfil limpio con una cuenta autorizada. No se copian credenciales del perfil del usuario para realizarla.
