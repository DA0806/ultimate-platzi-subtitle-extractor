# Política de Privacidad de UPSE

**Fecha de vigencia:** 10 de octubre de 2026
**Producto:** Ultimate Platzi Subtitle Extractor (UPSE) 1.0.7, extensión local para navegadores Chromium
**Contacto:** <https://github.com/DA0806/ultimate-platzi-subtitle-extractor/issues>

Esta política describe el tratamiento de datos y los principios de seguridad de la extensión UPSE 1.0.7. Constituye una declaración factual del código implementado en este repositorio y no representa asesoría legal ni garantía de aprobación en la Chrome Web Store.

---

## 1. Fundamentos y Fuentes Oficiales Consultadas

El diseño y las políticas de privacidad de UPSE 1.0.7 se basan en la documentación técnica y términos públicos oficiales siguientes:

1. **Platzi - Términos de Servicio:**
   [`https://platzi.com/terminos/`](https://platzi.com/terminos/) — Establecen la propiedad sobre el contenido formativo y la prohibición de reproducción o distribución no autorizada.
2. **Platzi - Centro de Ayuda:**
   [`https://platzi.com/ayuda/`](https://platzi.com/ayuda/) — Documentación para estudiantes y usuarios de la plataforma sobre cursos y accesos.
3. **Platzi - Soluciones para Empresas:**
   [`https://platzi.com/business/`](https://platzi.com/business/) — Información de gestión organizacional que confirma la ausencia de APIs públicas abiertas de sesión personal para terceros.
4. **Google Chrome Extensions - Ciclo de Vida en Manifest V3:**
   [`https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle`](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — Especificación del ciclo de vida efímero de los Service Workers, el aislamiento de memoria y la persistencia restringida.
5. **Google Chrome Web Store - User Data Policy:**
   [`https://developer.chrome.com/docs/webstore/program-policies/user-data/`](https://developer.chrome.com/docs/webstore/program-policies/user-data/) — Principios de Propósito Único (Single Purpose), Mínimos Permisos (Minimum Permissions) y Uso Limitado (Limited Use).

---

## 2. Alcance y Principio de Cero Recolección de Credenciales

Esta política aplica tanto a la extensión cargada en el navegador como a la ejecución en entorno local. En UPSE 1.0.7:
- **No se recopilan, almacenan ni transmiten contraseñas, tokens ni cookies.**
- Se eliminaron completamente todas las opciones heredadas de captura manual de cookies (`Cookie`, `x-platzi-cookie`), formularios de inicio de sesión simulados y almacenes persistentes de sesión.
- UPSE **no solicita ni utiliza la API `chrome.cookies`**, no lee `document.cookie`, no usa permisos de pestañas (`tabs`) y no inspecciona el tráfico de red mediante `webRequest`.
- El manifiesto (`manifest.json`) declara estrictamente `permissions: []`.

---

## 3. Tratamiento de Datos en Memoria y Ciclo de Vida MV3

Cuando el usuario ingresa una URL de curso o clase de Platzi, UPSE procesa exclusivamente en memoria volátil:
1. **Identidad Canónica (`ClassIdentityMetadata`):** Resolución de URLs, slugs, identificadores numéricos y títulos `<h1>` mediante el HTML devuelto por Platzi, desacoplada por completo de cualquier stream protegido o reproductor multimedia.
2. **Evaluación de Capacidades (`CapabilityDecision`):** Verificación de triple permiso (`authenticated`, `canView`, `canExportSubtitles`) mediante un adaptador oficial construido explícitamente. `class_is_free`, `user`, `sessionStatus` y el consentimiento local nunca sustituyen esa fuente. En ausencia de ella, el sistema falla cerrado por defecto (`DENY`).
3. **Pruebas de Acceso Efímeras (`AuthorizedAccessProof`):** Objetos de autorización creados en el heap de la pestaña de la extensión con un tiempo de vida (TTL) máximo de 10 minutos, enlazados estructuralmente a la URL canónica y a la lista blanca de pistas VTT.
4. **Subtítulos y Formatos de Exportación:** Solo una decisión oficial vigente puede habilitar la descarga de VTTs desde `static.platzi.com` y su transformación local a TXT o ZIP; el adaptador predeterminado permanece en `UNKNOWN`.

### Suspensión del Service Worker y Purga de Seguridad
Conforme a la especificación de Manifest V3, el Service Worker de fondo no retiene estado de autorización ni pruebas de acceso. Todas las pruebas residen exclusivamente en la memoria de la ventana activa.
- Si la ventana o pestaña se cierra o recarga, **todas las pruebas y contenidos extraídos se destruyen de inmediato**.
- Ante cualquier respuesta HTTP `401 Unauthorized` o `403 Forbidden` devuelta por Platzi, UPSE incrementa automáticamente su contador de época (`sessionEpoch`), revoca todas las pruebas en memoria y ejecuta `purgeExtractedContent()`, eliminando de inmediato los textos extraídos para evitar cualquier retención o mezcla de datos entre diferentes sesiones.

---

## 4. Categorías de Datos y Finalidad

| Categoría | Datos Involucrados | Finalidad | Tratamiento en UPSE |
| :--- | :--- | :--- | :--- |
| **Contenido de sitios web** | URLs de Platzi, HTML SSR y pistas VTT | Catalogar temarios y extraer subtítulos solicitados por el usuario | Procesamiento exclusivo en memoria local del navegador. No se envía a ningún servidor de UPSE. |
| **Historial web** | Solo la URL introducida por el usuario | Cargar la estructura de la clase o curso elegido | No se utiliza la API de historial ni se recopila navegación externa. |
| **Información de autenticación** | Sesión del navegador transmitida por `credentials: 'include'` | Permitir que el servidor de Platzi resuelva la petición con el perfil del usuario | Declaración conservadora para Chrome Web Store. UPSE no lee, no intercepta y no persiste cookies ni tokens. |
| **Preferencias locales** | Tema visual, idioma de UI y estado del tutorial | Recordar la configuración de visualización de la interfaz | Almacenamiento local mediante `chrome.storage.local` / `localStorage` (`platzi_settings`). Cero datos personales. |
| **Archivos exportados** | Archivos TXT y ZIP generados | Entregar al usuario las transcripciones solicitadas | Generación local y descarga en el sistema de archivos del usuario. |

---

## 5. Recursos Externos de Terceros

- **Fuentes tipográficas:** La hoja de estilos puede referenciar fuentes desde Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`).
- **Video explicativo opcional:** El tutorial puede cargar un video descriptivo alojado en Cloudinary.
- **Restricción de hosts:** Las peticiones funcionales de extracción están estrictamente acotadas por el manifiesto a `https://platzi.com/*`, `https://www.platzi.com/*` y `https://static.platzi.com/*`.
- UPSE no contiene código JavaScript remoto ni descarga scripts ejecutables externos.

---

## 6. Retención, Limpieza y Derechos del Usuario

- **Memoria volátil:** El contenido de subtítulos extraídos y las pruebas de acceso se purgan automáticamente al cerrar la pestaña, al cambiar de cuenta o al detectar errores de autorización (401/403).
- **Borrado voluntario:** El botón **Borrar datos de UPSE** en los Ajustes elimina las preferencias locales almacenadas (`platzi_settings`). No altera las cookies de Platzi en el navegador ni los archivos previamente descargados por el usuario.
- **Desinstalación:** Al desinstalar la extensión desde el navegador, se eliminan todos los datos locales asociados a la extensión.

---

## 7. Declaración de Cumplimiento de Chrome Web Store

UPSE 1.0.7 se diseñó siguiendo las políticas de uso limitado (Limited Use); esta declaración describe el código local y no sustituye una revisión o aprobación externa:
1. **No comercialización:** Los datos no se venden ni se transfieren a terceros bajo ningún concepto.
2. **Propósito único estricto:** Los datos se utilizan única y exclusivamente para proveer la funcionalidad de extracción de subtítulos de libre acceso iniciada por el usuario.
3. **Sin evaluación crediticia ni publicidad:** UPSE no recopila datos para perfiles comerciales, evaluación crediticia, publicidad ni telemetría.
