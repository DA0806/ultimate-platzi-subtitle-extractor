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
| H1. La API exige credenciales de aplicación adicionales a las cookies | Frontend oficial reportó `Origin` y `api-authorization`; UPSE reportó una cookie visible sin esas cabeceras | Si esas señales son requisito, cuál y para qué operación | Comparar solicitudes normales en Network sin copiar valores ni fabricar cabeceras | No demostrado |
| H2. El `404` proviene de un gateway deliberado por faltar autenticación o contexto | Fetch simple oficial emitió `404`; cuerpo no confirmado; UPSE emitió `404` cuya respuesta apareció vacía en DevTools | Evidencia del gateway y del contexto que produce el estado | Comparar respuesta y redirección de los flujos oficiales, sin replay ni manipulación | No demostrado |
| H3. El endpoint no admite solicitudes desde extensiones de terceros | UPSE emitió `404`, pero el fetch simple oficial también emitió `404` | Diferencia causal entre origen de extensión y origen web | Recheck desde pestaña nueva de extensión y comparación equivalente en web | No demostrado; el 404 web debilita atribución exclusiva |
| H4. Las cookies son distintas o insuficientes para la operación | Cookie visible en UPSE; no se observaron valores ni reglas de envío | Atributos y políticas efectivas del perfil, sin extraer secretos | Inspección agregada de estado y respuesta, nunca valores de cookies | No demostrado |
| H5. El navegador diferencia las cabeceras de la solicitud | `Origin`/`api-authorization` fueron reportadas solo en el frontend oficial | Si la diferencia es requerida por el backend o incidental | Comparar presencia agregada de cabeceras en solicitudes normales | No demostrado |
| H6. La extensión usa la API correcta, pero el backend impide la integración | Endpoint y opciones GET nativas coinciden; respuesta UPSE sigue en `404` | Respuesta autoritativa que confirme o descarte este flujo | Build reciente, pestaña nueva, recheck y reporte whitelistado | No demostrado; el 404 web también debilita exclusividad |

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
