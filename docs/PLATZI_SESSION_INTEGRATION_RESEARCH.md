# Investigación Técnica, Evidencia Empírica y Diagnóstico de Integración: Sesión Platzi, Autorización y Exportaciones en UPSE

- **Documento:** `docs/PLATZI_SESSION_INTEGRATION_RESEARCH.md`
- **Ubicación en repositorio:** `worktrees/browser-extension/docs/PLATZI_SESSION_INTEGRATION_RESEARCH.md`
- **Fecha de actualización:** 10 de octubre de 2026 (validación manual real posterior a recarga)
- **Rama de trabajo:** `feat/browser-extension` (`worktrees/browser-extension`)
- **Carácter:** Documentación de Estado Actual e Histórico de Integración; el adaptador de cabecera de sesión nativo (`PlatziSessionAdapter`) está implementado, cubierto por la suite determinista de esta revisión y observado en una recarga manual real de Chrome. La respuesta observada no confirmó autenticación ni acceso de clase.

---

## 1. Resumen Ejecutivo y Estado Actual

### 1.1. Inspección del Entorno y Suite de Pruebas
- **Worktree activo:** `worktrees/browser-extension` en la rama `feat/browser-extension`.
- **Estado de pruebas actual:** La suite en `tests/*.test.js` cuenta exactamente con **111 pruebas automatizadas pasando al 100%** (`node --test tests/*.test.js`). La recarga manual de la extensión en Chrome ya produjo un diagnóstico real; las pruebas completas de interacción Chrome, portapapeles y acceso de clase con cuenta real siguen pendientes.
- **Estado de entrega:** Cambios técnicos publicados en la rama `feat/browser-extension`; la evidencia manual de Chrome se documenta por separado y no selecciona un adaptador definitivo.

### 1.2. Delimitación Epistemológica de Contextos
Para mantener rigor técnico y trazabilidad, este documento distingue formalmente cuatro categorías de evidencia:

1. **`userliveChrome` (Observación humana en vivo en Chrome DevTools):**
   - Evidencia empírica directa capturada por el usuario en las herramientas de red de Chrome mientras navega con credenciales activas.
   - Endpoint: `GET https://api.platzi.com/api/v1/components/header/v2/user/`.
   - Esquema confirmado: JSON en raíz `{ isAuthenticated: boolean, userId: number, userType: string, plan: string, isB2B: boolean }`.
2. **`agentstaticHTTP` (Consultas estáticas en entorno de desarrollo):**
   - Solicitudes no interactivas (`curl.exe`, fetch estático sin cookies de sesión).
   - Observación: `curl.exe -sI https://platzi.com` emitió `HTTP 403` con cabecera `Server: cloudflare`.
   - Límite: Muestra únicamente el comportamiento del perímetro ante clientes de consola; no refleja el comportamiento del navegador del usuario.
3. **`unitmocks` (Pruebas unitarias sintéticas):**
   - La suite en Node.js valida contratos de esquema, ordenamiento monótono de peticiones, acotación por mínimo de expiración (`getSessionValidityDeadline`), aislamiento de errores 401/403, e invalidación por rotación de época/cuenta, incluyendo regresiones de respuestas tardías y diagnóstico sanitizado.
4. **`liveextensionobserved` (Extensión real en Chrome Manifest V3):**
   - La extensión empaquetada cargada como desempaquetada desde `dist/` en `chrome://extensions`.
   - La observación previa de UPSE registró `404` cuya respuesta apareció vacía en DevTools para el GET simple. En la nueva recarga manual de Chrome con código y manifest `1.0.8`, el adaptador registró `HTTP 404`, respuesta clasificada como `HTML`, autenticación `UNKNOWN` y motivo `HTTP_404`. Son dos observaciones distintas en contextos de observación diferentes; no se infiere que el servidor haya cambiado ni que la observación anterior fuera errónea. Ninguna confirma autenticación de sesión ni acceso de clase.

### 1.2.1. Comparación observada del endpoint de sesión

Se conservaron únicamente estados agregados de cuatro contextos observados por el usuario:

- El frontend oficial de Platzi con sesión emitió `200` y una raíz JSON con `isAuthenticated` y campos de estado.
- Un `fetch` GET simple desde la pestaña oficial emitió `404`; el cuerpo no fue confirmado.
- El `fetch` GET simple de UPSE registró `404` cuya respuesta apareció vacía en DevTools en la observación anterior.
- La extensión UPSE recargada con código y manifest `1.0.8` registró `404` con respuesta clasificada como `HTML`, autenticación `UNKNOWN` y motivo `HTTP_404`.

Esto registra respuestas distintas entre contextos y métodos de observación; no prueba un cambio del servidor, que una cabecera ausente sea la causa única ni que el resultado sea exclusivo de la extensión. No se reportan URL completas con query, cabeceras, cookies, cuerpos ni IDs. Hasta observar una respuesta autoritativa de acceso a la clase premium, el estado de clase y exportación sigue siendo `UNKNOWN`.

---

## 2. Evidencia Empírica del Frontend de Platzi y Fuentes Oficiales

### 2.1. Fuentes Primarias Verificadas y Enlaces Oficiales

1. **Platzi - Términos y Condiciones de Uso:**
   - **URL Oficial:** [`https://platzi.com/terminos/`](https://platzi.com/terminos/) (Octubre 2026).
   - **Términos contrastados:** Secciones 2, 3 y 5 describen el tratamiento de materiales audiovisuales y textuales. La fuente consultada no aporta un contrato técnico de autorización para exportar subtítulos desde UPSE.
   - **Límite evidencial:** No se identificó ni verificó autorización aplicable para exportación masiva o almacenamiento de subtítulos de video fuera de la plataforma; por ese límite de evidencia, las compuertas de exportación de UPSE se mantienen *fail-closed*.
2. **Google Chrome Extensions Manifest V3 - Declaración de Permisos:**
   - **URL Oficial:** [`https://developer.chrome.com/docs/extensions/develop/manifest/permissions`](https://developer.chrome.com/docs/extensions/develop/manifest/permissions)
   - Host permissions: `"https://api.platzi.com/*"` en `public/manifest.json` otorga privilegio de red para peticiones cross-origin iniciadas desde páginas de la extensión.
   - Principio de mínimos privilegios: UPSE no solicita el permiso `"cookies"`. La adjunción efectiva de cookies en una petición de extensión depende de las políticas del navegador y del perfil; su presencia no se asume ni se interpreta como permiso de clase.
   - Permiso `"clipboardWrite"` no se requiere para contextos de activación de usuario inmediata en páginas de extensión; UPSE llama de forma inmediata y captura excepciones (`NotAllowedError`). Esto no prueba que la activación transitoria sobreviva a esperas asíncronas ni que todos los perfiles concedan el mismo resultado.
3. **Peticiones Cross-Origin en Extensiones MV3:**
   - **URL Oficial:** [`https://developer.chrome.com/docs/extensions/develop/concepts/network-requests`](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
   - Las páginas de extensión (popups, opciones, pestañas dedicadas) ejecutan peticiones cross-origin mediante `fetch()`. Cuando un origen HTTPS está listado en `host_permissions`, las restricciones CORS estándar no bloquean la respuesta, permitiendo inspeccionar status y cuerpo JSON de la API.
4. **Chrome Storage and Cookies:**
   - **URL Oficial:** [`https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies`](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies)
   - Se consultó para separar la presencia observable de cookies de cualquier conclusión sobre autenticación efectiva. No se solicitó el permiso `cookies` ni se extrajeron valores.
5. **Página pública de Platzi:**
   - **URL de referencia:** [`https://platzi.com/`](https://platzi.com/)
   - Se usó como referencia de navegación pública y no como autoridad de permisos de clase o exportación.
6. **Página pública de Platzi Business:**
   - **URL de referencia:** [`https://platzi.com/empresas/`](https://platzi.com/empresas/)
   - Se revisó como material público de producto; no se trató como documentación de API, OAuth o delegación de permisos.

### 2.2.1. Búsqueda acotada de flujo soportado

Se revisaron las fuentes primarias anteriores y las rutas observadas en el flujo oficial, sin reintentar solicitudes con cabeceras inventadas, sin replay de peticiones y sin manipular respuestas. La búsqueda de autenticación de sesión, incluyendo posibles flujos OAuth, API o delegación documentados, no identificó un flujo aplicable entre las fuentes consultadas. La evidencia de acceso a clase y la autorización de exportación se evalúan por separado y continúan requiriendo pruebas autoritativas independientes. La búsqueda queda acotada a estas fuentes y no afirma la inexistencia absoluta de otros flujos internos.

---

## 3. Capacidades de Integración de Sesión e Identidad

| Capacidad | Evidencia Base | Estado Actual en UPSE | Límite Técnico |
| :--- | :--- | :--- | :--- |
| **A. Identidad de Sesión** | `userliveChrome`: `GET /api/v1/components/header/v2/user/` responde raíz con `isAuthenticated` y `userId`; la extensión recargada emitió `404` HTML con autenticación `UNKNOWN`. | **Implementado** (`PlatziSessionAdapter`). Normaliza `accountId` en memoria, valida esquema estricto, protege concurrencia monótona y emite estado `verified` o `unauthenticated`. | La respuesta 404 de la extensión no confirma adjunción efectiva de cookies ni autenticación de sesión. |
| **B. Metadatos Públicos de Catálogo** | SSR HTML contiene `<title>`, `canonicalUrl` y eventos analíticos con `course_id`, `class_id`. | **Implementado** (`resolvePublicClassIdentity`). Consulta con `credentials: 'omit'` y extrae identidad pública de clase sin exigir sesión activa. | No otorga permiso de reproducción ni revela URLs de video protegidas. |
| **C. Recursos Diagnósticos (`links-files`)** | `userliveChrome`: `GET /materials/v1/{classId}/course/{courseId}/links-files/` responde 200 en Empresarial y 403 en Free para clases privadas. | **Implementado como sonda diagnóstica** (`checkResourceDiagnostics`). Registra recurso disponible o denegado sin leer cuerpo de respuesta. | **No prueba completitud semántica ni otorga reproducción (`canView`) ni exportación (`canExportSubtitles`).** |
| **D. Acceso de Video y Exportación** | Términos de uso reservan derechos. No se identificó ni verificó contrato público ni autorización aplicable para descarga de transcripciones. | **Fail-Closed estricto** (`UNKNOWN` -> `DENY`). `checkClassAccess` y `checkExportPermission` mantienen denegación por defecto. | Bloqueado por seguridad; sin emisión de pruebas sintéticas de exportación no autorizadas. |
| **E. Diagnóstico UI y portapapeles** | Estados sanitizados y `navigator.clipboard.writeText()` solo tras validación de la operación, con éxito/error explícitos. | **Implementado y probado** en callback unitario con promesas diferidas, con mensajes ES/EN y reduced motion heredado. | Requiere validación manual en Chrome para activación transitoria y permisos efectivos. |
| **F. Evidencia real de Chrome** | Frontend oficial `200`; fetch simple oficial `404` con cuerpo no confirmado; observación UPSE anterior `404` cuya respuesta apareció vacía en DevTools; recarga UPSE `1.0.8` `404` clasificado como HTML, `UNKNOWN/HTTP_404`. | **Diagnóstico manual observado**: código y manifest coinciden en `1.0.8` y el reporte whitelistado pudo copiarse. Siguen pendientes las pruebas completas de interacción Chrome y la respuesta autoritativa de clase. | El `404` HTML no identifica gateway, CDN, Cloudflare, cabecera o contexto requerido; no se selecciona adaptador premium ni se amplían permisos. |

---

## 4. Arquitectura de Sesión y Flujo de Control

```mermaid
flowchart TD
    subgraph UI ["Capa de Interfaz (Extension Page)"]
        Badge["SessionBadge / AuthPanel"]
        Hook["useAuth() / recheckSession()"]
        Store["useAuthStore (sessionEpoch, user, sessionStatus)"]
        Badge --> Hook
        Hook --> Store
    end

    subgraph Adapter ["PlatziSessionAdapter (Singleton Global)"]
        ReqQueue["Monotonic Ordering (requestId >= latestCompleted)"]
        EpochGuard["Epoch Guard (startEpoch === currentEpoch)"]
        FetchCall["fetch(SESSION_USER_ENDPOINT, credentials: include)"]
        SchemaVal["Root Schema Validation (isAuthenticated, userId)"]
        RotationCheck["Account Rotation (A -> B: single invalidate)"]

        Hook --> Adapter
        Adapter --> ReqQueue
        ReqQueue --> EpochGuard
        EpochGuard --> FetchCall
        FetchCall --> SchemaVal
        SchemaVal --> RotationCheck
        RotationCheck -->|Update Safe User / Status| Store
    end

    subgraph Sinks ["Compuertas de Exportación (Fail-Closed)"]
        AuthSvc["AuthorizationService (Default)"]
        ClassGate["checkClassAccess -> UNKNOWN (canView: false)"]
        ExportGate["checkExportPermission -> UNKNOWN (canExport: false)"]
        Downloader["downloader.js (revalidateExportPreflight)"]

        AuthSvc --> ClassGate
        AuthSvc --> ExportGate
        Downloader --> AuthSvc
    end
```

---

## 5. Detalles de Implementación y Remediación de Hallazgos

### 5.1. Ordenamiento de Observaciones Concurrente (Hallazgo 1)
- **Problema previo:** Dos peticiones concurrentes podían cruzarse; una respuesta demorada (error o no autenticado) podía sobrescribir una observación exitosa más reciente, o un logout en vuelo podía ser revertido.
- **Solución implementada:**
  - `PlatziSessionAdapter` administra contadores monótonos `requestIdCounter` y `latestCompletedRequestId`.
  - Si una petición finaliza con `requestId < latestCompletedRequestId`, se descarta como `STALE_REQUEST` sin alterar el estado de la tienda ni la cuenta en memoria.
  - Si la época de sesión cambió (`sessionEpoch !== operationEpoch`), se descarta como `SESSION_EPOCH_MISMATCH`.
  - En rotación legítima de cuenta ($A \to B$), el adaptador invalida la sesión anterior una sola vez (`invalidateSession()`), adopta la nueva época producida y establece la sesión autenticada con los metadatos de la nueva cuenta.
  - La función `recheckSession` en `src/hooks/useAuth.js` delega la disposición al adaptador y no escribe estados incondicionalmente tras los awaits.

### 5.2. Acotación por Mínimo de Expiración en `getSessionValidityDeadline` (Hallazgo 2)
- **Problema previo:** Si una sesión contenía tanto `validUntil` (+30s) como una expiración real conocida `expiresAt` (+5s), la función retornaba `validUntil`, extendiendo indebidamente la validez.
- **Solución implementada:**
  ```javascript
  export const getSessionValidityDeadline = (session) => {
    if (!session) return 0;
    const candidates = [];
    if (Number.isFinite(session.validUntil)) candidates.push(session.validUntil);
    if (Number.isFinite(session.expiresAt)) candidates.push(session.expiresAt);
    if (Number.isFinite(session.sessionExpiresAt)) candidates.push(session.sessionExpiresAt);
    return candidates.length > 0 ? Math.min(...candidates) : 0;
  };
  ```
  La validez queda acotada de forma determinista por el valor más restrictivo. Valores `null`, `undefined` o no finitos son ignorados.

### 5.3. Opciones Estrictas de Red en Adaptador (Hallazgo 3)
- Endpoint exacto: `https://api.platzi.com/api/v1/components/header/v2/user/`.
- Configuración de `fetch()`:
  - `credentials: 'include'`: Adjunta cookies de sesión nativas del navegador.
  - `redirect: 'error'`: Impide el seguimiento silencioso de redirecciones con credenciales.
  - `cache: 'no-store'`: Evita respuestas intermedias obsoletas en caché de navegador.
  - `headers: { 'Accept': 'application/json' }`.
- Validación defensiva de respuesta:
  - Inspección de `response.url`: Exige origen `https://api.platzi.com`, ruta exacta `/api/v1/components/header/v2/user/`, y rechaza cualquier query string (`?redirect=...`) o fragmento hash (`#...`).
  - Verificación estricta de MIME: Si la cabecera `Content-Type` está ausente o no contiene `application/json`, la respuesta se rechaza como `NON_JSON_CONTENT_TYPE`.
   - En errores de red o redirección denegada, retorna `unknown` con motivo sanitizado sin exponer cuerpos de error ni cabeceras. `NETWORK_ERROR` solo describe que `fetch()` no produjo una respuesta observable; no identifica si la causa fue red, CORS, permisos del navegador, cookies, contexto de extensión u otra condición no observable.

### 5.4. Sonda Diagnóstica de Recursos (`checkResourceDiagnostics`) (Hallazgo 4)
- Exige identidad numérica positiva de clase y curso (`classId > 0`, `courseId > 0`).
- Exige sesión verificada, época coincidente y frescura vigente (`deadline > Date.now()`).
- Guarda antes y después del await de red: Si la época cambia o la frescura expira durante la petición, el resultado es estrictamente `unknown`, nunca `available`.
- No lee el cuerpo de la respuesta (`no body read`).
- No retorna ni registra `accountId` ni identificadores de usuario.
- Reporta exclusivamente observación de recursos adjuntos (`resourceType: 'links-files'`), sin otorgar permisos de video ni exportación.

### 5.5. Eliminación de Parser Sintético en Producción (Hallazgo 6)
- Se eliminó el simulador de DOM basado en regex de `src/utils/platziAccess.js`.
- En runtime de extensión, `globalThis.DOMParser` es nativo en páginas de extensión.
- Si `DOMParser` no está disponible en el entorno, `parseHtmlToDocument` retorna `null` y `resolvePublicClassIdentity` emite `{ status: 'unknown', reason: 'DOMPARSER_UNAVAILABLE' }`.
- Los fixtures sintéticos para pruebas de Node residen exclusivamente en los archivos de prueba (`tests/sessionIntegration.test.js`).

---

## 6. Verificación de Seguridad y Empaquetado

### 6.1. Auditoría del Empaquetado ZIP (`dist/upse-extension.zip`)
La prueba automatizada en `tests/sessionIntegration.test.js` inspecciona el archivo ZIP en memoria utilizando `jszip`:
- `manifest.json`:
  - `manifest_version: 3`.
  - `host_permissions`: exactamente `["https://platzi.com/*", "https://www.platzi.com/*", "https://static.platzi.com/*", "https://api.platzi.com/*"]`.
  - `permissions`: arreglo vacío `[]`. No contiene `"cookies"`, `"webRequest"`, ni `"clipboardRead"`.
  - `content_scripts`: no definido (ausencia total de scripts de contenido inyectados).
- Código JavaScript y HTML empaquetado:
  - Sin referencias remotas en etiquetas `<script src="...">` en `index.html` (únicamente scripts locales relativos).
  - Sin llamadas a `eval()` ni invocaciones dinámicas de `new Function()`.
  - Sin funciones de reseteo exportadas para producción (`resetSessionAdapterState`).
  - El escaneo estático automatizado sobre patrones conocidos de credenciales literales (Bearer tokens hardcodeados, client secrets, claves privadas) arrojó cero coincidencias. Esta comprobación delimita el análisis estático ejecutado sobre los artefactos compilados; no se afirma que el listado de archivos del ZIP demuestre por sí solo la seguridad interna sin dicho escaneo.

### 6.2. Procedimiento de Recarga para Verificación Humana
Para evaluar la extensión en Chrome:
1. Ejecutar compilación y empaquetado:
   ```bash
   npm run build && npm run build:extension
   ```
2. En Google Chrome, navegar a `chrome://extensions`.
3. Activar el **Modo de desarrollador**.
4. Hacer clic en **«Cargar extensión sin empaquetar»** y seleccionar la carpeta **`dist`** generada (NO la carpeta de código fuente `public`).
5. Si la extensión ya estaba cargada, pulsar el botón de recarga (ícono circular) en la tarjeta de UPSE correspondiente a la carpeta `dist`.

### 6.3. Limitación Factual de Ejecución Automatizada en Entorno Local
Durante la revisión técnica independiente (Codex), se intentó una verificación automatizada con Playwright 1.60 y el ejecutable local en caché de Chromium 1243 ubicado en `C:\Users\Diego\AppData\Local\ms-playwright\chromium-1243\chrome-win64\chrome.exe` con un perfil temporal nuevo (`launchPersistentContext`). Dicho intento falló antes de iniciar el navegador con el error `spawn UNKNOWN` (la ruta configurada por Playwright para Chromium 1223 estaba desactualizada, y al suministrar explícitamente el binario 1243 existente también se produjo el fallo de spawn). En este intento no se reutilizó ningún perfil personal ni Edge, no se involucraron credenciales ni se obtuvo evidencia de DOM, runtime de extensión o endpoints en vivo; se trató de un intento puramente técnico. Después, la observación manual real en Chrome confirmó la recarga `1.0.8` y el diagnóstico `HTTP_404` clasificado como `HTML`; no confirmó clicks duplicados, spinner, a11y, cancelación, E2E completo, autenticación ni acceso a clase. El adaptador de clase definitiva continúa pendiente sin otorgar derechos de reproducción completos.
