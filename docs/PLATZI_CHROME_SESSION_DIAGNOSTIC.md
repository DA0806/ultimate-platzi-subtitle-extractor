# Protocolo y Diagnóstico de Sesión y Acceso Real en Chrome: Platzi vs. UPSE

- **Documento:** `docs/PLATZI_CHROME_SESSION_DIAGNOSTIC.md`
- **Ubicación:** `worktrees/browser-extension/docs/PLATZI_CHROME_SESSION_DIAGNOSTIC.md`
- **Rama de trabajo:** `feat/browser-extension`
- **Fecha:** 10 de octubre de 2026 (validación manual real posterior a recarga)
- **Propósito:** Definir el procedimiento seguro de inspección manual en Google Chrome DevTools para determinar las diferencias exactas de respuesta del servidor de Platzi entre acceso autorizado y denegado en una misma clase premium, validando el adaptador de sesión de cabecera implementado y preservando el principio *fail-closed* en acceso a clases y exportación.

---

## 1. Resumen Ejecutivo y Alcance Autorizado

### 1.1. Autorización Humana Vigente
Conforme a la instrucción autorizada:
> *"Implementa las correcciones técnicas independientes y prepara un diagnóstico de sesión y acceso real para Chrome. Prioriza determinar qué respuestas emite Platzi cuando un usuario autenticado puede reproducir una clase premium frente a cuando no puede. No conviertas señales públicas de UI en permisos de seguridad. No habilites exportaciones sin autorización aplicable. Si necesitas pruebas con una cuenta real, prepara el procedimiento para realizarlas de forma segura y espera sus resultados antes de elegir el adaptador definitivo."*

### 1.2. Estado Actual de UPSE y Situación de los Adaptadores
1. **Correcciones técnicas y suite de pruebas determinista:**
   - Se eliminó el bypass de *Copiar TXT* en `src/components/ExportPanel.jsx`, unificando su lógica en `src/utils/downloader.js` (`copyMergedTxt`), condicionando la confirmación visual al cumplimiento de la promesa y capturando `NotAllowedError`.
   - **Manejo del Portapapeles en Chrome:** No se asume que la activación transitoria de usuario (*transient user activation*) sobreviva indefinidamente tras esperas asíncronas de red ni que el permiso `"clipboardWrite"` esté demostrado como innecesario en todos los entornos. Por principio de mínimos privilegios en Manifest V3 (`permissions: []`, sin `clipboardRead`), UPSE ejecuta un preflight estricto, transporta un contexto de sesión inmutable, aguarda la resolución de `navigator.clipboard.writeText()` y captura de forma determinista cualquier `NotAllowedError`.
   - Se protegieron todas las vías de exportación (`downloadVideoTxt`, `downloadMergedTxt`, `downloadZip` y `copyMergedTxt`) con un contexto de operación único (`createExportContext`), validación de membresía en el almacén de datos contra purgas y reemplazos, y vinculación estricta de identidad entre video y prueba.
   - Se implementó un control monotónico por clase (`bumpClassRevision`, `getClassRevision`, `isClassRevisionDenied`) ligado a cuenta y `sessionEpoch` en `src/utils/platziAccess.js`: las denegaciones confirmadas invalidan únicamente dicha clase y una revisión nunca se recicla por TTL, impidiendo que extracciones en vuelo rezagadas revivan contenido obsoleto.
   - Se desambiguaron los errores 401 (`PLATZI_UNAUTHORIZED`) y 403 (`PLATZI_FORBIDDEN`) en `src/utils/platziClient.js` y `src/hooks/useSubtitleExtractor.js`: una denegación de recurso individual no destruye la sesión global ni incrementa el `sessionEpoch`. Se corrigió `rejectLoginRedirect` para que lance `PLATZI_UNAUTHORIZED` (401) sin invalidar la sesión global.
   - Se protegió `AuthorizationService.recheck()` para que solo respuestas autoritativas de la operación vigente puedan invalidar la sesión global; las respuestas tardías sin época no pueden cerrar una sesión nueva. También se fijó la revisión antes de comprobaciones asíncronas de clase.
   - Se sanitizaron los registros de depuración en consola en `useSubtitleExtractor.js` (emitiendo únicamente `{ code, status, classSlug }`, sin URLs firmadas completas ni cuerpos de error).
   - Se implementó la acotación de expiración por mínimo (`getSessionValidityDeadline`) garantizando que el TTL de observación local no extienda expiraciones de servidor reales.
   - Se implementó un control estricto de concurrencia y ordenamiento monótono de peticiones en el adaptador de sesión, evitando que peticiones demoradas sobrescriban estados más recientes o logouts.
   - La suite cuenta con **111 pruebas automatizadas pasando al 100%** (`node --test tests/*.test.js`). La recarga manual de la extensión en Chrome ya produjo un diagnóstico real; las pruebas completas de interacción Chrome, portapapeles y acceso de clase con cuenta real siguen pendientes.

2. **Estado de Adaptadores: Sesión Nativa Implementada vs. Acceso/Exportación Fail-Closed:**
   - **Adaptador de Sesión de Cabecera (`PlatziSessionAdapter`):** Implementado en `src/utils/platziSessionAdapter.js` y conectado a `defaultAuthorizationService.adapter.checkSession()`. Emplea el endpoint observado por el usuario en Chrome DevTools (`GET https://api.platzi.com/api/v1/components/header/v2/user/`) con validación de esquema raíz estricto (`isAuthenticated`, `userId`), in-memory account binding, frescura local de 30s, y opciones de red estrictas (`redirect: 'error'`, `cache: 'no-store'`). En la recarga manual real con código y manifest `1.0.8`, emitió `HTTP 404`, respuesta `HTML`, autenticación `UNKNOWN` y motivo `HTTP_404`; esto valida el reporte y la versión cargada, no la autenticación ni el acceso a clase.
   - **Adaptadores de Acceso a Clase y Exportación (`checkClassAccess`, `checkExportPermission`):** Permanecen estrictamente en **`UNKNOWN` (Fail-Closed, default denial)**. No se identificó ni verificó un contrato de servidor aplicable que otorgue autoridad sobre reproducción de video o exportación de subtítulos protegidos. El adaptador definitivo de clase completa continúa pendiente.

### 1.3. Evidencia nueva de sesión (cuatro contextos)

El usuario observó el mismo endpoint de sesión en cuatro contextos, sin compartir cuerpos completos, cabeceras ni identificadores:

| Contexto | Resultado sanitizado | Qué permite concluir |
| :--- | :--- | :--- |
| Frontend oficial de Platzi, con sesión | `200`, JSON raíz con `isAuthenticated` y campos de estado | El frontend oficial recibió una respuesta de sesión válida en ese contexto. |
| Consola de la página oficial, `fetch` GET simple | `404`, cuerpo no confirmado | El endpoint no es reproducible con esa solicitud simple; no demuestra por sí solo la causa del rechazo. |
| UPSE en la página de extensión, `fetch` GET simple anterior | `404`, respuesta apareció vacía en DevTools | La extensión no obtuvo una respuesta de sesión válida en esa prueba. Cookie presence no equivale a autenticación suficiente. |
| UPSE recargada en Chrome con código/manifest `1.0.8` | `404`, respuesta `HTML`, autenticación `UNKNOWN`, motivo `HTTP_404` | Confirma que la nueva UI cargó el código y manifest esperados y que el reporte whitelistado puede copiarse; no confirma autenticación, acceso a clase ni exportación. |

La evidencia no demuestra que la ausencia de una cabecera concreta sea la única causa, ni que el comportamiento sea exclusivo de la extensión. No se ha elegido un adaptador definitivo de acceso premium; el procedimiento manual debe comparar las respuestas autoritativas de la clase antes de ampliar permisos o exportación.

### 1.4. Comparación sanitizada de señales observadas

| Contexto | `Cookie` | `Origin` | `api-authorization` | Resultado |
| :--- | :--- | :--- | :--- | :--- |
| Frontend oficial de Platzi | No visible en el reporte | Visible | Visible | `200` con raíz JSON de sesión |
| Fetch simple de UPSE/extensión anterior | Visible | No visible | No visible | `404`, respuesta apareció vacía en DevTools |
| UPSE/extensión recargada `1.0.8` | No reportado | No reportado | No reportado | `404`, respuesta `HTML`, `UNKNOWN/HTTP_404` |

“No visible” significa que el usuario no reportó esa cabecera en la observación; no significa que se haya demostrado su ausencia en la red. Cookie presence tampoco demuestra que la solicitud sea autenticada o que otorgue acceso a una clase.

### 1.5. Hipótesis H1–H6 y verificación segura

| Hipótesis | Evidencia actual | Faltante | Verificación segura | Estado |
| :--- | :--- | :--- | :--- | :--- |
| H1. La API exige credenciales específicas de aplicación además de cookies | Frontend oficial reportó `Origin` y `api-authorization`; UPSE reportó una cookie visible sin esas cabeceras | Si alguna señal es requisito, cuál y para qué operación | Comparar solicitudes normales en Network sin copiar valores ni fabricar cabeceras | No demostrado |
| H2. El origen o contexto del navegador cambia el resultado | El frontend oficial, la página y la extensión son contextos distintos; el GET simple web también emitió `404` | Diferencia causal entre `https://platzi.com`, `https://api.platzi.com` y `chrome-extension:` | Recheck desde pestaña de extensión y comparación equivalente en web | No demostrado |
| H3. El `404` proviene de un gateway, CDN o protección de perímetro | Fetch simple oficial emitió `404`; UPSE emitió `404` cuya respuesta apareció vacía en DevTools | Evidencia del gateway y de la capa que produce el estado | Comparar metadatos sanitizados de respuestas normales, sin replay ni evasión | No demostrado |
| H4. Las cookies son distintas o insuficientes para la operación | Cookie visible en UPSE; no se observaron valores ni reglas de envío | Atributos y políticas efectivas del perfil, sin extraer secretos | Inspección agregada de estado y respuesta, nunca valores de cookies | No demostrado |
| H5. El endpoint interno no está diseñado para terceros | Es una ruta interna del frontend y no se identificó contrato OAuth/API de consumidor | Si Platzi ofrece un flujo documentado para identidad, clase o exportación de terceros | Consultar documentación o interfaz oficial aprobada, sin reutilizar credenciales internas | No demostrado |
| H6. Existe un defecto propio de UPSE | No hay evidencia nueva de defecto; el cliente ya valida endpoint, esquema, MIME, época y concurrencia | El runtime de extensión no pudo probarse en Edge; las pruebas locales no sustituyen E2E | Ejecutar una sola verificación desde runtime inspeccionable y contrastar el diagnóstico | No demostrado |

---

## 2. Objetivo Prioritario del Diagnóstico

Determinar las **diferencias estructurales en las respuestas HTTP del servidor de Platzi** ante una **MISMA clase premium**, contrastando:
- Cuando el usuario está autenticado y su suscripción **permite reproducir la clase completa**.
- Cuando el usuario está autenticado pero su cuenta **no tiene acceso a esa clase** (restringido a vista previa o denegado).

### ¿Por qué NO inferir permisos de señales superficiales?
1. **Nombre del plan comercial (Basic, Expert, Business, etc.):** No garantiza acceso a clases específicas de programas avanzados, rutas empresariales o contenidos sujetos a condiciones particulares. Los permisos reales los evalúa el servidor por clase.
2. **Elementos visuales de la UI (candados, banners "Hazte Premium"):** Son componentes visuales de frontend que pueden desincronizarse o estar presentes en prerenderizados estáticos. No son una autoridad de seguridad.
3. **Flag analítico `class_is_free`:** Es un metadato analítico público extraído de eventos SSR de Next.js; no representa una autorización autoritativa emitida a nivel cuenta.
4. **Disponibilidad de video o respuesta HTTP 200 en archivos VTT:** La accesibilidad pública de un recurso estático en CDN no constituye autorización jurídica ni técnica para exportar contenido protegido fuera de la plataforma.

---

## 3. Matriz Comparativa de Observación

Para aislar variables, se debe observar la **misma clase objetivo** en tres estados de autenticación, además de dos clases de control. **Importante:** La clase objetivo debe ser una clase intermedia o avanzada con acceso restringido real, **nunca la primera clase de bienvenida o introductoria del curso** (las cuales suelen ser públicas):

| Identificador | Contexto de Usuario | Clase Observada | Propósito del Diagnóstico |
| :--- | :--- | :--- | :--- |
| **Estado 1** | **Anónimo** (Ventana de incógnito sin login) | **Clase Objetivo Premium Restringida** | Registrar la respuesta base pública sin credenciales ni sesión. |
| **Estado 2** | **Cuenta Gratuita Legítima** (Autenticado sin suscripción activa) | **Misma Clase Objetivo Premium** | **Clave:** Identificar si el servidor emite una respuesta estructurada de rechazo, vista previa o ausencia de entitlement para esa clase. |
| **Estado 3** | **Cuenta con Suscripción** (Autenticado con acceso completo) | **Misma Clase Objetivo Premium** | **Clave:** Identificar la respuesta del servidor que habilita la reproducción completa y cómo se estructura el entitlement. |
| **Control A** | Cuenta Gratuita o Anónimo | **Clase Gratuita Conocida** (ej. primera clase de curso introductorio) | Validar cómo responde el servidor ante contenido explícitamente público/abierto. |
| **Control B** | Cuenta con Suscripción | **Clase de Catálogo Excluido** (ej. curso no incluido en su plan o especialización cerrada) | Verificar si una cuenta con suscripción activa recibe un 403 o respuesta estructurada de denegación en contenidos fuera de su catálogo. |

---

## 4. Procedimiento Seguro de Inspección Manual en Chrome DevTools

### 4.1. Reglas Estrictas de Seguridad y Privacidad
- **Navegación normal únicamente:** Utilice navegación ordinaria en el navegador. No realice repetición de peticiones (*request replay*), inyección de cabeceras, interceptación mediante proxies de ataque ni manipulación de respuestas.
- **PROHIBIDO exportar:**
  - Archivos HAR completos.
  - Cookies de sesión (`__cf_bm`, `sessionid`, etc.).
  - Cabeceras `Authorization` o tokens JWT/Bearer.
  - Cuerpos de respuesta completos con información personal (nombre, email, datos de pago).
  - URLs firmadas completas de streaming multimedia o subtítulos privados.
  - Capturas de pantalla con información personal identificable.
- **Información que el usuario debe reportar (Sanitizada):**
  - Pathname del endpoint (**ejemplo hipotético:** `/api/v1/material-access/`), sin cadenas de consulta (*query parameters*) que contengan tokens. No se debe reportar ese path como observado si no apareció realmente.
  - Método HTTP (GET / POST) y código de estado (200, 401, 403, etc.).
  - Tipo de contenido clasificado (`json` / `otro`), sin exponer cabeceras crudas.
  - Si hubo redirección (y si fue a `/login` o interna).
  - **Esquema y valores de estado observados:** Nombres de claves y valores booleanos o enum específicos (ej. `can_view: true/false`, `preview_mode: true/false`), omitiendo siempre datos privados o identificadores de usuario.
  - Si existen campos que vinculen de forma estable la cuenta con la clase.

### 4.2. Paso a Paso en DevTools

#### Paso 1: Preparación y Aislamiento de Red
1. Abra Google Chrome en su perfil habitual.
2. Abra las Herramientas de Desarrollador (**F12** o **Ctrl+Shift+I**).
3. Vaya a la pestaña **Network** (Red).
4. Configure los siguientes filtros:
   - Active la casilla **Preserve log** (para no perder peticiones durante navegaciones).
   - En la barra de filtros, seleccione **Fetch/XHR**.
5. **Limpieza estricta entre estados:** Antes de navegar o cambiar de cuenta, pulse el botón **Clear (🚫)** para vaciar el registro de red y realice una recarga normal con **F5**.

#### Paso 2: Observación de Peticiones Fetch/XHR
1. Navegue a la clase seleccionada.
2. En la lista de peticiones de red, identifique aquellas dirigidas a `platzi.com/api/...` o rutas de datos Next.js (`_next/data/...` o endpoints de Server Actions / React Server Components). Las rutas concretas de la plantilla son hipotéticas hasta que el usuario las observe.
3. Para cada petición relevante, haga clic y examine las pestañas **Headers** (Encabezados) y **Response** (Respuesta):
   - **Path:** Extraiga únicamente la ruta base (ejemplo hipotético: `/api/v1/material-access/`).
   - **Status:** Registre el código numérico (ej. `200`, `403`).
   - **Esquema y valores booleanos/enum:** Si la respuesta es JSON, observe las claves de acceso y sus valores booleanos o enum. **No copie el JSON entero si contiene datos personales o URLs completas.**
   - **Identidad de Cuenta:** Indique si la respuesta incluye algún campo que represente la cuenta (ej. `user_id`, `account_hash`) reportando **únicamente si el campo existe**, sin registrar su valor.

#### Paso 3: Inspección del Reproductor Multimedia (Pestañas Elements y Console)
Para verificar la entrega de contenido y pistas de texto sin acceder a datos sensibles:
1. En la pestaña **Console** (Consola), ejecute de forma pasiva los siguientes comandos de inspección:
   ```javascript
   // 1. Contar elementos de video en el DOM
   console.log("Videos:", document.querySelectorAll("video").length);

   // 2. Contar elementos track y registrar únicamente categorías (kinds), sin labels
   console.log("Tracks:", Array.from(document.querySelectorAll("track")).map(t => ({ kind: t.kind })));

   // 3. Inspeccionar iframes: únicamente categoría de origen
   console.log("Iframes:", Array.from(document.querySelectorAll("iframe")).map(i => {
     try {
       const host = new URL(i.src).hostname.toLowerCase();
       return host.includes("platzi.com") ? "platzi-origin" : "third-party-origin";
     } catch {
       return "unknown-category";
     }
   }));
   ```
2. Registre los resultados numéricos y categorías observadas.

---

## 5. Metodología de Correlación y Transición de Sesión

### 5.1. Transición entre Cuentas y Limpieza de Red
1. **Estado Inicial:** Inicie en ventana de incógnito (**Estado 1: Anónimo**). Limpie el registro de red (**🚫**), recargue con **F5** y registre las respuestas de la clase objetivo.
2. **Inicio de Sesión Gratuito:** En una pestaña, inicie sesión con su cuenta gratuita y acceda a la clase (**Estado 2: Gratuito**). Limpie la red (**🚫**), recargue (**F5**) y registre las respuestas.
3. **Inicio de Sesión Premium:** Inicie sesión con su cuenta con suscripción y acceda a la misma clase (**Estado 3: Premium**). Limpie la red (**🚫**), recargue (**F5**) y registre las respuestas.
4. **Cierre de Sesión:** Cierre sesión normalmente en Platzi, limpie la red (**🚫**) y recargue la pestaña de la clase. Registre si el servidor devuelve un 401, redirige a `/login` o degrada a vista previa anónima.

### 5.2. Consideraciones de Caché
- Next.js y los navegadores modernos emplean memorización en cliente (Client-side Router Cache) y caché HTTP.
- Para evitar falsos positivos producidos por una sesión anterior:
  - Limpie siempre el registro de red (**🚫**) y realice una recarga estándar (`F5`) al cambiar de sesión o cuenta.
  - No es necesario borrar el perfil de Chrome ni desactivar la seguridad del navegador.

### 5.3. Regla Fail-Closed
Si en cualquiera de los estados:
- No se observa una respuesta estructurada del servidor que vincule la sesión del usuario con el acceso a la clase.
- Las respuestas dependen exclusivamente de la presencia de cookies no interpretables sin acceso a APIs privadas.
- O la plataforma solo entrega transcripciones dentro de un `iframe` de terceros inaccesible sin eludir el sandbox del navegador.

Entonces el estado se clasifica formalmente como **`UNKNOWN`** y UPSE mantendrá cerradas las compuertas de extracción, sin asumir permisos que no hayan sido demostrados.

---

## 6. Plantilla en Blanco Sanitizada para el Reporte del Usuario

> **Instrucciones para el usuario:** Copie la siguiente plantilla en un mensaje de respuesta, complete los campos con las observaciones registradas en DevTools (omitiendo contraseñas, cookies, tokens y nombres personales) y envíela para orientar el diseño del adaptador de clase completa.

```markdown
# Reporte Diagnóstico Sanitizado: Respuestas de Sesión y Acceso en Platzi

## 1. Identificación de la Clase Objetivo
- **Clase Objetivo (Misma clase premium para los 3 estados - DEBE ser clase avanzada/restringida, no la bienvenida):** [ej. /cursos/pensamiento-logico/algoritmos/]
- **Control Gratuito (Primera clase pública de un curso abierto):** [ej. /cursos/javascript/intro/]
- **Control Catálogo Excluido (Clase fuera del plan de suscripción):** [ej. /cursos/programa-especializado/modulo-cerrado/]

---

## 2. Comparación de la Misma Clase Premium en los Tres Estados

### Estado 1: Anónimo (Sin sesión)
- **Endpoint principal observado:** [ruta real observada]
- **Método HTTP:** [GET / POST]
- **Código de Estado HTTP:** [ej. 200 / 401 / 403 / Redirección]
- **Redirección:** [No / Sí -> Destino: ej. /login/]
- **Tipo de respuesta clasificado:** [json / otro]
- **Esquema y valores booleanos/enum observados (sin valores privados de cuenta):**
  - { has_access: false, preview_mode: true, ... }
- **¿Indica vista previa o reproducción completa?:** [Vista previa / Ninguna / Completa]
- **DOM Multimedia:**
  - Cantidad de elementos `<video>`: [0 / 1 / >1]
  - Cantidad de elementos `<track>`: [0 / 1 / >1]
  - Categorías de `<track>` observadas (kinds únicamente): [captions / subtitles / ninguno]
  - Categoría de iframes: [ninguno / platzi-origin / third-party-origin]

### Estado 2: Cuenta Gratuita Legítima (Autenticado sin suscripción a esta clase)
- **Endpoint principal observado:** [ruta real observada]
- **Método HTTP:** [GET / POST]
- **Código de Estado HTTP:** [ej. 200 / 403]
- **Redirección:** [No / Sí]
- **Tipo de respuesta clasificado:** [json / otro]
- **Esquema y valores booleanos/enum observados:**
  - { has_access: false, is_subscriber: false, preview_mode: true, ... }
- **Diferencia clave con Estado 1:** [ej. ¿El servidor emite un flag específico de entitlement denegado o responde idéntico?]
- **¿Existe un campo de identificación de cuenta presente en la respuesta?:** [Sí (nombre del campo: ...) / No / Desconocido]
- **DOM Multimedia:**
  - Cantidad de elementos `<video>`: [0 / 1]
  - Cantidad de elementos `<track>` (kinds únicamente): [0 / 1]
  - Categoría de iframes: [ninguno / platzi-origin / third-party-origin]

### Estado 3: Cuenta con Suscripción (Autenticado con acceso a esta clase)
- **Endpoint principal observado:** [ruta real observada]
- **Método HTTP:** [GET / POST]
- **Código de Estado HTTP:** [ej. 200]
- **Redirección:** [No / Sí]
- **Tipo de respuesta clasificado:** [json / otro]
- **Esquema y valores booleanos/enum observados:**
  - { has_access: true, is_subscriber: true, preview_mode: false, ... }
- **Diferencia clave con Estado 2:** [ej. ¿Qué campo booleano o enum específico cambia de false a true?]
- **¿Existe campo explícito que distinga reproducción completa vs vista previa?:** [Sí (nombre y valor: ...) / No]
- **DOM Multimedia:**
  - Cantidad de elementos `<video>`: [0 / 1]
  - Categorías de `<track>` observadas (kinds únicamente): [captions / subtitles / ninguno]
  - Categoría de iframes: [ninguno / platzi-origin / third-party-origin]

---

## 3. Observaciones de los Controles

### Control Gratuito (Clase pública abierta):
- **Respuesta en Cuenta Gratuita:** [ej. 200 con reproducción permitida]
- **¿El esquema de respuesta es idéntico al Estado 3 de la clase premium?:** [Sí / No (diferencias: ...)]

### Control Catálogo Excluido (Clase fuera de plan):
- **Respuesta en Cuenta con Suscripción:** [ej. 403 / 200 con access: false]
- **Código o clave de denegación emitida:** [ej. error: SUBSCRIPTION_UPGRADE_REQUIRED]

---

## 4. Conclusiones y Confiabilidad
- **¿Existe un campo de servidor confiable que dependa de la cuenta para validar el acceso?:** [Sí / No / Dudoso]
- **¿Se identificó alguna respuesta o contrato aplicable que mencione permisos de exportación de subtítulos?:** [No / Sí]
```

---

## 7. Próximos Pasos tras la Recepción del Diagnóstico

1. **Revisión del reporte de extensión:** Contrastar las observaciones de la sonda segura en la extensión con la implementación de `PlatziSessionAdapter`.
2. **Definición de Adaptadores:**
   - **Adaptador de Sesión:** El adaptador de cabecera nativo implementado (`PlatziSessionAdapter`) se valida empíricamente con la confirmación de la extensión en vivo.
   - **Adaptador de Acceso por Clase:** Si se identifica un endpoint de servidor que certifique el acceso legítimo a la clase completa, se diseñará un adaptador específico para dicha signatura. En su defecto, `checkClassAccess` permanecerá en `UNKNOWN`.
3. **Cero exportaciones no autorizadas:** La capacidad de exportación (`canExportSubtitles` / `canExport`) permanecerá deshabilitada a menos que se identifique y verifique autorización aplicable emitida para ese fin.

---

## 8. Protocolo de Verificación Humana en Vivo con Manifest V3 (`host_permissions: https://api.platzi.com/*`)

### 8.1. Carga y Recarga en Chrome desde la Carpeta `dist` Desempaquetada
> **Delimitación Fundamental:** El hecho de que una sesión esté activa y navegable en una pestaña regular de `https://platzi.com` en Chrome **NO demuestra por sí solo** que la extensión (`chrome-extension://...`) reciba o adjunte automáticamente cookies de sesión cross-origin bajo Manifest V3. La prueba debe ejecutarse dentro de la propia extensión cargada desde el directorio de construcción del worktree.

1. Ejecute la compilación del proyecto para asegurar que los artefactos empaquetados en el worktree estén actualizados:
   ```bash
   npm run build && npm run build:extension
   ```
2. Abra `chrome://extensions` en Google Chrome y active el **Modo de desarrollador** (en la esquina superior derecha).
3. Si la extensión no está cargada: haga clic en **«Cargar extensión sin empaquetar»** y seleccione la ruta absoluta de la carpeta `dist`:
   ```text
   D:\Proyectos\Visual Studio Projects\ultimate-platzi-subtitle-extractor\worktrees\browser-extension\dist
   ```
   *(NO seleccione la carpeta `public` ni la raíz del repositorio, ya que carecen de los módulos empaquetados de Vite).*
4. Si la extensión ya estaba cargada: localice la tarjeta de UPSE que apunta a dicha carpeta `dist` y pulse el botón de recarga (ícono circular con flecha).
5. Cierre cualquier pestaña o popup antiguo de UPSE y abra una pestaña nueva de la extensión para evitar código previamente cargado.
6. Antes de recheck, compruebe en la línea de versión que **código** y **manifest** reporten `1.0.8`. Una discrepancia identifica una pestaña o build desactualizado; no se debe inferir que `getManifest()` por sí solo recargó el código.

### 8.2. Verificación mediante la Interfaz Normal de UPSE
1. Inicie sesión en Platzi en una pestaña normal de Chrome utilizando su cuenta (Free o Suscriptor).
2. Abra la extensión UPSE (haciendo clic en su ícono de acción o abriendo su pestaña dedicada).
3. Abra el panel de ajustes de sesión y haga clic en **«Volver a verificar»** (`Recheck`).
4. Compruebe la etiqueta de estado de sesión y el diagnóstico visible:
   - **Sesión activa detectada (Platzi Empresarial)** o **(Platzi Free)**: Indica que ese contexto recibió HTTP 200 con esquema válido en la raíz; la etiqueta no otorga permisos de clase o exportación.
   - **Sin sesión en Platzi**: Confirma que el servidor respondió HTTP 200 con `{ isAuthenticated: false }`.
   - **Sesión: Estado desconocido**: Si el servidor respondió 403, hubo un error de red o apareció un desafío perimetral, el estado permanece seguro en *fail-closed* sin destruir credenciales. `NETWORK_ERROR` no permite atribuir la causa a CORS, permisos del navegador, cookies o al origen: solo indica que no hubo una respuesta observable.
5. Verifique transiciones:
   - Cambie de cuenta (ej. de cuenta A a cuenta B) o cierre sesión en la web de Platzi, y presione nuevamente **«Volver a verificar»**.
   - Confirme que el estado refleje la transición de forma sanitizada sin requerir reinicio del navegador.
6. Use **Copiar diagnóstico** únicamente para compartir el reporte whitelistado; no copie Network, cookies, cabeceras, cuerpos ni URLs completas.

### 8.3. Reporte Sanitizado Mínimo Requerido
Reporte únicamente los siguientes datos agregados (sin identificadores personales ni secretos):
- **Código de Estado HTTP:** [200 / 403 / Error de red]
- **Presencia y tipo de `isAuthenticated`:** [boolean: true / false]
- **Presencia y validez de `userId`:** [safe positive integer: sí / no]
- **Tipo de respuesta clasificado:** [json / otro]
- **Motivo sanitizado:** [OK / HTTP_404 / HTTP_403 / HTTP_401 / HTTP_429 / TIMEOUT / NETWORK_ERROR / EXTENSION_ONLY_AUTH / ninguno]. `NETWORK_ERROR` no distingue por sí solo red, CORS, permisos del navegador, cookies ni contexto de extensión.
- **PROHIBIDO REPORTAR:** `userId` numérico real, `accountId`, nombre, email, plan comercial exacto si es personal, cookies ni cabeceras secretas.

### 8.4. Sonda Segura Opcional desde la Consola de la Extensión
Si prefiere verificar manualmente desde las DevTools de la extensión (`Inspect popup` o consola de la pestaña de la extensión), ejecute esta sonda mínima que verifica el origen de extensión (`chrome-extension://`), exige estrictamente `r.status === 200`, `r.url` exacto, respuesta clasificada como `json`, y emite **únicamente** valores booleanos o nulos bajo una lista blanca fija de motivos, sin imprimir identificadores de usuario, cookies ni cuerpos completos:

```javascript
(async () => {
  if (!location.origin.startsWith('chrome-extension://')) {
    console.log({ status: 'unknown', reason: 'ORIGIN_NOT_EXTENSION', isExtension: false });
    return;
  }
  const endpoint = 'https://api.platzi.com/api/v1/components/header/v2/user/';
  try {
    const r = await fetch(endpoint, {
      method: 'GET',
      credentials: 'include',
      redirect: 'error',
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });
    const contentType = r.headers.get('content-type') || '';
    const isJson = contentType.toLowerCase().includes('application/json');
    const responseClassification = isJson ? 'json' : 'other';
    const isExactUrl = r.url === endpoint;

    // Requiere estrictamente HTTP 200, Content-Type JSON y URL exacta (rechaza 201 u otros códigos)
    if (r.status !== 200 || !isJson || !isExactUrl) {
      console.log({
        status: r.status,
        responseType: responseClassification,
        reason: !isExactUrl ? 'REDIRECT_INVALID' : (!isJson ? 'NON_JSON_CONTENT_TYPE' : (r.status === 403 ? 'HTTP_403' : (r.status === 401 ? 'HTTP_401' : (r.status === 404 ? 'HTTP_404' : (r.status === 429 ? 'HTTP_429' : 'HTTP_OTHER'))))),
        authValue: null,
        hasValidUserId: false,
      });
      return;
    }

    const d = await r.json();
    console.log({
      status: 200,
      responseType: 'json',
      reason: 'OK',
      authValue: typeof d?.isAuthenticated === 'boolean' ? d.isAuthenticated : null,
      hasValidUserId: Number.isSafeInteger(d?.userId) && d.userId > 0,
      userTypePresent: typeof d?.userType === 'string',
      planPresent: typeof d?.plan === 'string',
      isB2BPresent: typeof d?.isB2B === 'boolean',
    });
  } catch (err) {
    console.log({
      status: 'error',
      responseType: 'network_failure',
      reason: err?.name === 'TypeError' ? 'NETWORK_OR_REDIRECT_ERROR' : 'FETCH_FAILED',
      authValue: null,
      hasValidUserId: false,
    });
  }
})();
```

### 8.5. Limitación Factual de Ejecución Automatizada en Entorno Local
Durante la revisión técnica independiente (Codex), se intentó una verificación en navegador automatizado utilizando Playwright 1.60 y el ejecutable en caché de Chromium 1243 ubicado en `C:\Users\Diego\AppData\Local\ms-playwright\chromium-1243\chrome-win64\chrome.exe` con un perfil temporal nuevo mediante `launchPersistentContext`. Este intento falló antes del inicio del navegador con el error `spawn UNKNOWN` (la ruta esperada de Playwright para Chromium 1223 estaba obsoleta, y al suministrar la ruta del binario 1243 existente también se produjo el fallo de spawn). En este intento no se reutilizó ningún perfil personal ni Edge, no se manejaron credenciales ni se obtuvo evidencia de DOM, runtime de extensión o endpoints en vivo; fue un intento técnico aislado. La observación manual posterior sí confirmó la recarga `1.0.8`, el reporte whitelistado copiable y la respuesta `HTTP_404` clasificada como `HTML`. No confirmó clicks duplicados, spinner, a11y, cancelación, E2E completo, autenticación ni acceso de clase; no se ha seleccionado un adaptador de clase definitiva ni otorgado derechos de acceso completos.

## Diagnóstico E2E mediante Chrome DevTools MCP conectado a Microsoft Edge

- **Fecha y zona horaria:** 10 de octubre de 2026, America/Guatemala.
- **Naturaleza de esta sección:** evidencia nueva obtenida con Chrome DevTools MCP conectado al Microsoft Edge existente. Las observaciones históricas de Chrome, las pruebas unitarias y esta inspección se mantienen separadas.
- **Herramientas usadas:** `list_pages`, `take_snapshot`, `list_network_requests`, `evaluate_script`, `navigate_page` y `click`. `evaluate_script` confirmó un agente de usuario Edge basado en Chromium (`Edg`). `get_network_request` se omitió deliberadamente porque su uso podía devolver cabeceras, cuerpos o secretos sin un selector seguro.

### Pestañas y solicitudes observadas

`list_pages` permitió ver una pestaña de Platzi y `edge://extensions`. La interfaz oficial de Platzi mostró una sesión activa; no se registraron nombre, correo ni otros datos personales. Tras una segunda búsqueda, `edge://extensions` mostró UPSE habilitada con `index.html` y versión `1.0.8`. La versión visible confirma la instalación cargada, pero no demuestra autenticación de la extensión.

`navigate_page` llevó a la clase de referencia y una recarga normal observó dos veces `GET /materials/v1/71787/course/11059/links-files/` con HTTP `200`. La ventana de Network estuvo limitada a hasta 300 solicitudes de tipo `document`, `xhr` y `fetch`; el cuerpo no se leyó ni almacenó. Este resultado indica que la página consultó recursos asociados con la clase; no es por sí mismo una prueba de identidad, reproducción completa ni exportación de subtítulos.

En esa ventana no apareció `GET /api/v1/components/header/v2/user/`. La clasificación correcta es **no observado**: no se obtuvo un nuevo `200`, `404` ni evidencia de inexistencia del endpoint. No se inspeccionaron MIME, `Origin`, cookies, cabeceras, redirecciones ni cuerpos, por lo que no se infiere su ausencia.

### Bloqueo específico de la pestaña de extensión

La vista de UPSE no pudo abrirse desde el MCP. Al intentar navegar a una URL `chrome-extension:` la herramienta devolvió exactamente: `Navigating to chrome-extension: URLs is not allowed without --categoryExtensions`. La categoría de extensiones no estaba habilitada. Como consecuencia, quedaron **BLOCKED** el inicio interactivo de UPSE, **Volver a verificar**, spinner, reintento, consola interna, nueva observación del endpoint de sesión, diagnóstico `UNKNOWN` y comprobación de las vías de exportación. La consola accesible de `edge://extensions` no equivale a la consola del runtime de UPSE.

La documentación oficial de Chrome DevTools MCP indica que las herramientas de extensiones están deshabilitadas por defecto y requieren `--categoryExtensions=true`, además de una conexión mediante pipe. En la configuración actual, `autoConnect`, `browserUrl` y `wsEndpoint` son incompatibles con habilitar esa categoría; por tanto, añadir el flag por sí solo no resuelve el acceso. No se cambió la configuración global, no se cerró Edge, no se reinstaló la extensión y no se inició un perfil alternativo: una nueva conexión o perfil no demostraría que conserva la sesión autenticada actual. La habilitación futura debe diseñarse y verificarse aparte, conservando el perfil real.

Referencia primaria de la capacidad: [`configuration.md` de Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/configuration.md) y [`tool-reference.md`](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md).

### Matriz A/B/C de evidencia

| Contexto | Endpoint | HTTP | Tipo | Interpretación |
| :--- | :--- | :---: | :--- | :--- |
| A. Frontend oficial de Platzi en Edge | `/materials/v1/71787/course/11059/links-files/` | `200` (dos veces) | No clasificado; cuerpo no leído | Consulta real de recursos de clase. No prueba autenticación ni exportación. |
| A. Frontend oficial de Platzi en Edge | `/api/v1/components/header/v2/user/` | No observado | No disponible | La ausencia del registro durante esta navegación no prueba que el endpoint no exista. |
| B. GET simple desde la página oficial, evidencia histórica | `/api/v1/components/header/v2/user/` | `404` | Cuerpo no confirmado | No se conoce aún qué diferencia del flujo oficial causó el resultado. |
| C. UPSE MV3 1.0.8, evidencia histórica | `/api/v1/components/header/v2/user/` | `404` | `HTML`, `UNKNOWN/HTTP_404` | Confirma el diagnóstico histórico de la recarga 1.0.8; no se repitió en el runtime Edge por la categoría bloqueada. |

### H1–H6 y opciones legítimas

| Hipótesis | Evidencia pro/contra | Estado y experimento mínimo seguro |
| :--- | :--- | :--- |
| H1. Credencial específica de API del frontend | El frontend histórico recibió `200`; no se copian ni inspeccionan valores de credenciales. | **No determinada.** Comparar solo presencia agregada de nombres de cabecera en una petición normal visible. |
| H2. Origin y contexto del navegador | El frontend web, la página y la extensión usan contextos distintos; el GET simple web también fue `404`. | **No determinada.** Comparar contextos con una petición normal, sin fabricar cabeceras. |
| H3. Gateway, CDN o protección de perímetro | GET simple histórico `404` y UPSE histórica `HTML`; no hay servidor, redirección o cuerpo seguro que identifique la capa. | **No determinada.** Inspeccionar metadatos sanitizados, sin replay ni evasión. |
| H4. Cookies insuficientes o no adjuntas | No hubo respuesta válida histórica desde UPSE; no se extrajeron cookies. | **No determinada.** Revisar solo presencia agregada en una petición normal, nunca valores. |
| H5. Endpoint interno no diseñado para terceros | No se identificó contrato OAuth/API de consumidor en las fuentes públicas consultadas. | **No determinada.** Confirmar únicamente mediante documentación o interfaz oficial aprobada. |
| H6. Defecto propio de UPSE | No hay evidencia nueva de defecto; el adaptador ya usa `credentials: include`, `redirect: error`, `cache: no-store` y validación estricta. | **No determinada.** Repetir el recheck cuando el runtime sea inspeccionable; las pruebas locales no sustituyen E2E. |

No se identificó en las fuentes públicas consultadas un OAuth/PKCE de consumidor ni una API documentada que conceda a UPSE identidad, acceso de clase y exportación. Las Business API documentadas usan claves de empresa y SSO empresarial, y no resuelven permisos de este cliente. Las señales de sesión visibles en navegador o UI no son autoridad de clase ni exportación. Las fuentes primarias consultadas fueron [`Platzi Docs`](https://platzi.com/docs/), [`Platzi API key`](https://platzi.com/docs/apikey/) y [`Términos de Platzi`](https://platzi.com/terminos/); se citan como documentación técnica y de producto, no como asesoramiento legal. Las opciones de copiar tokens, leer cookies o almacenamiento, imitar cabeceras, interceptar/reproducir solicitudes o usar URLs multimedia se descartan. No se amplían permisos MV3 y `UNKNOWN` mantiene la denegación por defecto.

| Opción D | MV3/Edge | API privada y mantenimiento | Permisos y seguridad | Identidad / clase / exportación |
| :--- | :--- | :--- | :--- | :--- |
| OAuth/PKCE de consumidor documentado | Compatible si Platzi lo ofrece | No identificado en documentación pública; menor dependencia privada si existiera | Sin secretos reutilizados; requiere contrato explícito | No disponible: faltan contrato e implementación autorizada. |
| Sesión existente mediante página/UI/DOM | Técnicamente accesible solo en contextos permitidos por Edge | Frágil ante cambios de UI; no es API estable | No requiere leer cookies, pero las señales son no autoritativas | Puede indicar contexto; no prueba identidad de servidor, clase ni exportación. |
| Endpoint interno `header/v2/user` | La solicitud MV3 ya es compatible en código | API privada; contrato y mantenimiento inciertos | No se amplían permisos; no se imitan cabeceras | Históricamente `404` en GET simple/UPSE; no resuelve clase/exportación. |
| Business API / SSO empresarial | No es un flujo consumer de UPSE | Documentado para organizaciones, no para este cliente | Requiere autorización y credenciales empresariales propias | No concede por sí solo identidad, clase ni exportación de la cuenta actual. |

### Resultado E2E

| Escenario | Estado | Evidencia sanitizada |
| :--- | :--- | :--- |
| MCP conectado y Edge confirmado | **PASS** | `list_pages` y agente de usuario `Edg`. |
| Sesión visible en Platzi | **PASS** | UI oficial mostró sesión activa; sin PII. |
| Clase de referencia y consulta de recursos | **PASS** | `links-files` HTTP 200 observado dos veces. |
| UPSE instalada y versión | **PASS** | `edge://extensions`: habilitada, `index.html`, 1.0.8; igualdad de hash del bundle **NOT TESTED/BLOCKED**. |
| Abrir runtime de UPSE | **BLOCKED** | Requiere pipe y categoría de extensiones; `--categoryExtensions=true` no basta con la conexión actual. |
| Recheck, spinner, retry, consola UPSE y nueva petición | **BLOCKED** | No hubo acceso al contexto `chrome-extension:`. |
| Autenticación UPSE, acceso por clase, exportación y seguridad de UNKNOWN | **BLOCKED** | Requieren runtime y respuesta autoritativa; permanecen fail-closed. |
| Tests locales | **PASS** | 111/111 sobre fixtures/mocks/local; lint y build exit 0. No sustituyen E2E de Edge. |

**Conclusión:** el MCP probó conectividad con el Edge real y observó una sesión visible de Platzi, recursos de la clase con HTTP 200 y UPSE 1.0.8 instalada. No confirmó una causa única del HTTP 404 ni una solución autorizada. La investigación queda limitada por la categoría de extensiones deshabilitada; no se modificó código, autenticación, versión o permisos.

## Fase inicial: MCP de extensiones mediante pipe (antes del inicio manual de sesión)

La prueba con el servidor separado `edge-extensions` confirmó una configuración de extensiones válida: `--categoryExtensions=true`, conexión mediante pipe, ejecutable de Microsoft Edge y perfil independiente. No se observaron `autoConnect`, `browserUrl` ni `wsEndpoint`. La instancia de pruebas inició correctamente; `list_pages`, una navegación de prueba y la evaluación segura del agente de usuario confirmaron Edge (`isEdge: true`). La conexión anterior mediante `autoConnect` queda como evidencia histórica del bloqueo y no describe esta instancia nueva.

Las herramientas `list_extensions`, `install_extension`, `reload_extension` y `trigger_extension_action` estuvieron disponibles. El intento de instalar desde el `dist` del worktree fue rechazado por las raíces permitidas del MCP antes de CDP. La fuente oficial de Chrome DevTools MCP documenta que `roots()` incluye siempre `os.tmpdir()` en `McpContext.ts` ([fuente](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/src/McpContext.ts)); el rechazo observado no permite inferir la causa exacta de la ausencia de otras raíces del cliente. Después de copiar el artefacto a una carpeta nueva bajo el temp del runtime, `install_extension` completó. `list_extensions` mostró UPSE `1.0.8` habilitada; `reload_extension` y `trigger_extension_action` pasaron, y se inspeccionó la página `chrome-extension:`. `list_pages` mostró el service worker activo, que no se inspeccionó internamente. La copia staged fue comprobada con un manifiesto SHA-256 de 11 archivos sin symlinks; la igualdad parcial de hashes del artefacto instalado se detalla a continuación.

La matriz anterior conserva el resultado del intento histórico mediante `autoConnect`; la continuación actual con `edge-extensions` demuestra que la inspección de `chrome-extension:` ya es posible mediante pipe.

La inspección de recursos propios de la página confirmó la igualdad de los artefactos instalados relevantes: `index.html` `8ffc440e3069186eae9eaf737d3da3096fecffb0c7338e93be83a21cce0658c4`, `manifest.json` `5975bfcd2d5254372527f0ba7cf32ef1fb2f24bda82970c8ac4323c4faa0f551` y `assets/index-v4LOepD8.js` `978aa018c7e82b02ec9ab585be3473e728f292a10d64412e218ac55fd9fb1eb2`. Estos valores coinciden con la copia staged del `dist`. No se leyeron recursos ni cabeceras con credenciales.

En esa fase el perfil de pruebas todavía no tenía sesión de Platzi. Se solicitó al usuario iniciar sesión manualmente en `https://platzi.com/`. No se le pidieron cookies, tokens ni credenciales, y no se leyeron ni almacenaron. En esa fase la prueba de **Volver a verificar**, Network, errores de consola, diagnóstico de aplicación y comparación del HTTP `404` aún no se había ejecutado; el resultado final tras el inicio manual se registra abajo. El acceso a clase y la exportación seguían protegidos y fail-closed.

El onboarding también confirmó la ruta de usuario con **Empezar**, **Siguiente** y **Entrar workspace**; el botón **Ajustes** abrió su vista, donde fueron visibles el código/manifest de versión 1.0.8 y **Volver a verificar**. En esa fase la inspección de UI todavía no ejecutó el recheck porque faltaba el inicio manual; el resultado final se registra abajo.

| Escenario | Estado | Evidencia nueva |
| :--- | :--- | :--- |
| MCP de extensiones, pipe y perfil independiente | **PASS** | Categoría habilitada; sin `autoConnect`, `browserUrl` ni `wsEndpoint`; Edge iniciado. |
| Herramientas de gestión de extensiones | **PASS** | Las cuatro operaciones requeridas estuvieron disponibles. |
| Instalar UPSE desde carpeta temporal permitida | **PASS** | UPSE `1.0.8` figura habilitada; recarga y acción abrieron la página; el service worker quedó listado activo sin inspección interna. |
| Inspeccionar `chrome-extension:` | **PASS** | Página de UPSE abierta y snapshot de onboarding obtenido. |
| Igualdad del bundle instalado | **PASS parcial** | Hashes confirmados para `index.html`, `manifest.json` y `assets/index-v4LOepD8.js`; no se infiere igualdad de recursos no inspeccionados. |
| Sesión legítima de Platzi | **FASE INICIAL** | En esa fase faltaba el inicio manual del usuario en el mismo perfil de pruebas; el resultado final se registra abajo. |
| Recheck y explicación del HTTP `404` | **FASE INICIAL** | En esa fase todavía no se ejecutó; el resultado final se registra abajo con observación directa. |

## Resultado final E2E con UPSE 1.0.9

Esta sección registra la prueba posterior al inicio manual de sesión en el mismo perfil independiente. La evidencia histórica de UPSE 1.0.8 y su `404` se conserva arriba sin reinterpretarla.

`edge-extensions` instaló y habilitó UPSE `1.0.9`; la UI mostró código y manifest `1.0.9`. El clic real en **Volver a verificar** mostró el estado `Verificando sesión…` y terminó con **Sesión activa detectada** y motivo `OK`. Network registró `GET https://api.platzi.com/api/v1/components/headerv2/user/` con HTTP `200` y respuesta `application/json`; no hubo redirección. La validación exacta de `response.url` la realizaron el adaptador y las pruebas locales; no se leyó `get_network_request` ni cabeceras desde el MCP. El esquema observado incluyó solo los tipos `isAuthenticated` booleano y `userId` numérico; no se leyó ni almacenó el valor de `userId`, cookies, tokens ni cabeceras sensibles.

Una sonda GET previa, ejecutada con el contexto 1.0.8 y las mismas opciones `credentials: include`, `redirect: error`, `cache: no-store` y `Accept: application/json`, sin cabeceras internas, observó HTTP `200` JSON, sin redirección y solo tipos de esquema (`isAuthenticated` booleano y `userId` numérico). Esta evidencia de la ruta correcta se mantiene separada de la autenticación UI 1.0.9 posterior.

Un segundo clic controlado generó una segunda solicitud única al mismo endpoint y volvió a recibir `200` JSON, sin duplicación de diagnóstico ni error de aplicación. La comparación A/B en el mismo perfil confirma la causa de la regresión: la UI 1.0.8 observó dos solicitudes a la ruta obsoleta `/api/v1/components/header/v2/user/` con `404`, mientras que la UI 1.0.9 observó dos solicitudes a `/api/v1/components/headerv2/user/` con `200`. La identidad de sesión queda confirmada por la respuesta autoritativa y la UI; clase, reproducción y exportación siguen sin autorización y permanecen `UNKNOWN`/fail-closed.

La consola de la instancia 1.0.9 registró una incidencia de historial y cero errores o advertencias; no hubo crash de aplicación.

| Caso | Estado | Evidencia real nueva |
| :--- | :--- | :--- |
| UPSE instalada, habilitada y versión sincronizada | **PASS** | `list_extensions` y UI: código/manifest `1.0.9`. |
| Recheck desde UI | **PASS** | Spinner visible; termina en **Sesión activa detectada**, motivo `OK`. |
| Endpoint oficial observado en la página | **PASS** | `/api/v1/components/headerv2/user/`; HTTP `200`, JSON y esquema sanitizado. |
| Validación exacta de respuesta | **PASS** | El adaptador y las pruebas locales validan `response.url` exacta y rechazan query/hash; no se leyó `get_network_request` ni cabeceras desde el MCP. |
| Recheck repetido | **PASS** | Segundo GET `200` único; sin duplicación de diagnóstico ni crash de aplicación. |
| Comparación de la regresión | **PASS** | Ruta obsoleta 1.0.8: `404`; ruta `headerv2` en 1.0.9: `200`, mismo perfil. |
| Permiso de clase y exportación | **NOT TESTED / UNKNOWN** | No hubo dataset autorizado para E2E; `UNKNOWN` permanece impuesto por código y pruebas locales, sin prueba server-side de clase/exportación. |
| Validación local | **PASS** | 112/112 tests; lint y build exit 0; manifest/package/version 1.0.9 sincronizados; diff check PASS. |
| Secretos y datos personales en diff | **PASS** | No aparecen valores de usuario, IDs de extensión, cookies ni tokens. |
