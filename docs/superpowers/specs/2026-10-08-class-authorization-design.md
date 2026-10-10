# Especificación de Diseño: Autorización de Clases, Separación de Capacidades y Ciclo de Vida MV3

**Identificador:** `SPEC-2026-10-08-CLASS-AUTH-MV3`  
**Fecha:** 8 de octubre de 2026 (Actualizada con investigación técnica y contractual)  
**Rama/Worktree:** [`feat/browser-extension`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension)  
**HEAD Base:** `0c605e7` (*"fix: respect class access before subtitle requests (1.0.7)"*)  
**Estado:** `PROPOSED` (Documento de diseño técnico bajo revisión previa por Superpowers; **READ-ONLY**, sin cambios de código ni tests ejecutables).

---

## 1. Alcance y No-Alcance

### 1.1. Alcance (In Scope)
1. **Separación Estricta de Metadata:** Desacoplar la metadata pública de identidad de curso/clase/canonical de la metadata protegida del reproductor (`movin.subtitles`, URLs VTT). La identidad se resuelve sin tocar ni evaluar streams protegidos.
2. **Separación de Capacidades (`canView` vs `canExport`):** Establecer dos facultades independientes en el modelo de dominio. Tener sesión activa o pagar una suscripción en Platzi puede habilitar `canView`, pero **nunca** confiere automáticamente `canExport`.
3. **Adaptador de Autorización Productivo:** Definir una interfaz de autorización unificada con soporte teórico para clases públicas y de suscripción mediante permisos reales (sin APIs ficticias). La ruta de clases protegidas/premium permanece **temporalmente bloqueada** en producción hasta obtener especificación o contrato oficial de Platzi.
4. **Ciclo de Vida y Resiliencia en Manifest V3:** Modelar el comportamiento ante la suspensión, hibernación y reactivación del Service Worker de MV3, rotación de sesiones en el navegador, concurrencia de workers (límite 2) y purga obligatoria de memoria/proofs ante 401/403 o antes de exportar.
5. **Defensa en Profundidad Preservada:** Mantener las reglas invariantes de UPSE:
   * Solo HTTPS hacia hosts permitidos (`platzi.com`, `www.platzi.com`, `static.platzi.com`).
   * Cero lectura o almacenamiento de cookies/tokens (`chrome.cookies` denegado, `permissions: []`).
   * Vinculación estructural de URLs canónicas y títulos `<h1>`.
   * Límite de concurrencia a 2 hilos, intervalo de 400ms (`REQUEST_GAP_MS`) y backoff exponencial en 401/403/429.

### 1.2. No-Alcance (Out of Scope)
1. **Prohibición de Bypass o Elusión de DRM/Paywall:** UPSE no implementa, ni diseñará, métodos para eludir restricciones técnicas, descifrar flujos Widevine/FairPlay, interceptar tokens de streaming o evadir controles de acceso comerciales.
2. **Sin Flujos de Credenciales en la Extensión:** No se añadirán formularios de usuario/contraseña, ni lectura de `document.cookie`, ni extracción de `sessionid` mediante F12 o `chrome.cookies`.
3. **Sin Infraestructura de Servidor/Backend:** UPSE se mantiene 100% estático y cliente local. No se incorporarán proxies remotos, bases de datos externas ni almacenamiento en la nube.
4. **Sin Dependencias Nuevas:** Toda la arquitectura se formula reutilizando JavaScript estándar (ES2022+), JSDoc, Zustand, `JSZip` y componentes existentes.

---

## 2. Hallazgos de Investigación Independiente: Evidencia vs. Inferencia

Con el fin de fundamentar la arquitectura en hechos comprobables y evitar conjeturas de diseño, se realizó una investigación de la documentación y términos públicos de Platzi:

### 2.1. Fuentes Consultadas
* **Centro de Ayuda:** [`https://platzi.com/ayuda/`](https://platzi.com/ayuda/)
* **Platzi para Empresas:** [`https://platzi.com/business/`](https://platzi.com/business/)
* **Términos de Servicio:** [`https://platzi.com/terminos/`](https://platzi.com/terminos/)

### 2.2. Distinción entre Evidencia e Inferencia
1. **Evidencia:**
   * La documentación pública para usuarios y estudiantes no define APIs públicas de OAuth2, SSO, session token exchange ni especificaciones de entitlements por clase.
   * `https://platzi.com/business/` documenta herramientas de gestión organizacional, asignación de rutas corporativas y analítica de equipos, pero **no demuestra ni ofrece una API de acceso o sesión para cuentas personales**.
   * Los Términos de Servicio establecen la prohibición de reproducción, distribución y copia de contenidos sin autorización expresa.
2. **Inferencia (Límites de la evidencia):**
   * El hecho de que no se haya localizado documentación pública oficial sobre endpoints de autorización o exportación **NO prueba la inexistencia** de APIs internas o acuerdos institucionales privados; únicamente constata que no existe una especificación contractual pública disponible para terceros.
   * En ausencia de dicha especificación pública, cualquier asunción de que un endpoint interno o cookie representa un derecho de exportación es inválida.

### 2.3. Bloqueador Temporal Explícito y Contrato Pendiente
Queda establecido un **bloqueo temporal estricto** para cualquier procesamiento de contenido restringido o premium. Para que UPSE pueda habilitar la extracción de clases de pago en el futuro, es indispensable celebrar y formalizar un **contrato o especificación técnica oficial con Platzi** que otorgue:
1. **Licencia expresa para copias TXT/ZIP:** Autorización legal explícita para generar y persistir copias locales de subtítulos para fines de accesibilidad/estudio.
2. **Autorización de integración y uso de marca:** Consentimiento para operar como cliente de extensión vinculado al ecosistema Platzi.
3. **Flujo oficial de sesión/identidad:** Un mecanismo estándar (ej. OAuth2 / PKCE) que evite completamente el raspado o manipulación indirecta de cookies de sesión.
4. **Entitlement canónico de curso y clase:** Un esquema verificable para consultar si un usuario posee acceso legítimo a una clase específica (`courseSlug`/`classSlug`).
5. **Permiso de exportación granular:** Distinción verificable entre el permiso de visualización (`canView`) y el permiso de exportación (`canExport`), con marcas de expiración y capacidad de revocación inmediata.
6. **Guías anti-scraping y límites de tasa:** Parámetros oficiales acordados de concurrencia y rate-limiting para salvaguardar la infraestructura de Platzi.

---

## 3. Arquitectura de Autorización y Contratos JSDoc

```
                    ┌──────────────────────────────────────────────┐
                    │               Entrada de URL                 │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Módulo 1: Identity & Canonical Resolver (Independiente y Previo)                       │
│ - Determina canonicalUrl, courseSlug, classSlug, courseId, classId, classPosition      │
│ - Resuelve identidad pública fuente-vinculada. El SSR posterior solo corrobora identidad y permanece independiente de streams y VTTs.      │
│ - INVARIANTE: Ninguna metadata protegida/player/subtitle puede construir identidad.    │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Módulo 2: Decision Engine (Triple Permiso: Authenticated, canView, canExport)          │
│                                                                                        │
│   ¿Existe proveedor oficial verificado de autorización (OAuth / API Platzi futura)?    │
│   ├── SÍ  ──► Evalúa permisos según el proveedor. Si otorga acceso legítimo a clase    │
│   │           premium/suscrita, autoriza SIN que la heurística class_is_free lo vete.  │
│   │                                                                                    │
│   └── NO  ──► [BLOQUEADOR TEMPORAL]: no existe fuente oficial verificable.              │
│               Denegado cerrado: authenticated/canView/canExport = false.                │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
                         ┌─────────────────┴─────────────────┐
                         │                                   │
      [Los 3 permisos satisfechos]                  [Cualquiera denegado]
                         │                                   │
                         ▼                                   ▼
┌─────────────────────────────────────────┐         ┌─────────────────────────────────┐
│ Módulo 3: Protected Material Resolution │         │ DENEGAR / BLOQUEO DOCUMENTADO   │
│ - Extrae materialInfo y URLs VTT        │         │ - status: 'unauthorized'        │
│ - Emite AccessProof temporal            │         │ - Purga buffers y aborta lote   │
└────────────────────┬────────────────────┘         └─────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Módulo 4: Revalidación al Exportar (Pre-Flight de TXT/ZIP)                             │
│ - Verifica que el proof no esté caduco ni la sesión invalidada                         │
│ - Si el worker suspendió o hubo error 401 -> Revocar y denegar exportación             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1. Correcciones Conceptuales Clave: `class_is_free` e Identidad

1. **`class_is_free` como Defensa Previa Local Temporal:**
   * La comprobación de `class_is_free: true` es **exclusivamente una defensa previa local temporal** implementada por UPSE para fallar cerrado en ausencia de un proveedor de autorización verificado.
   * **No otorga permisos por sí sola:** Jamás permite acceso en escenarios anónimos, gratuitos o de suscripción. Los tres permisos indispensables solo provienen de un adaptador oficial explícito:
     1. `authenticated`: sesión válida ligada a una cuenta estable.
     2. `canView`: facultad de visualización confirmada por la fuente oficial.
     3. `canExport`: permiso de exportación confirmado por la fuente oficial.
   * **No veta fuentes futuras verificadas:** Si en el futuro se integra un proveedor de autorización contractual o una API oficial de Platzi que acredite que una cuenta posee acceso legítimo a una clase (incluidas clases privadas donde `class_is_free` sea `false`), **dicho proveedor tiene precedencia y autoriza la clase sin ser vetado por la heurística `class_is_free`**.

2. **Validación de Identidad Estrictamente Independiente:**
   * La identidad canónica (`courseId`, `classId`, `canonicalUrl`, `courseSlug`, `classSlug`) se determina e inspecciona **de forma independiente antes de extraer material protegido**. El adaptador oficial se consulta con esa identidad y nunca se crea desde `sessionContext`, `user` o booleans de UI.
   * **Invariante arquitectónica:** Ningún dato derivado de metadata protegida, streams de video, objetos `movin.subtitles` o pistas VTT puede utilizarse para construir, inferir o validar la identidad o los permisos de una clase. La identidad precede obligatoriamente a la autorización, y la autorización precede obligatoriamente a la resolución del material protegido.

### 3.2. Definiciones de Tipos JSDoc

```javascript
/**
 * @typedef {'anonymous' | 'authenticated_free' | 'authenticated_subscriber' | 'session_invalid'} AccountSessionStatus
 */

/**
 * @typedef {'free_public' | 'subscriber_only' | 'unknown_restricted'} ContentEntitlementTier
 */

/**
 * Metadata pública de identidad de una clase o curso, sin datos protegidos del reproductor.
 * @typedef {Object} ClassIdentityMetadata
 * @property {number} courseId - Identificador numérico del curso en Platzi.
 * @property {string} courseSlug - Slug normalizado del curso.
 * @property {number} classId - Identificador numérico de la clase.
 * @property {string} classSlug - Slug normalizado de la clase.
 * @property {number} classPosition - Índice ordinal de la clase en el temario (1-based).
 * @property {string} canonicalUrl - URL canónica normalizada (https://platzi.com/cursos/.../).
 * @property {string} title - Título de la clase obtenido del H1 y verificado en SSR.
 * @property {boolean} isFreePublic - Valor booleano estricto de class_is_free en SSR.
 */

/**
 * Evaluación separada de capacidades de acceso.
 * @typedef {Object} CapabilityDecision
 * @property {boolean} canView - Indica si el usuario tiene derecho de visualización en plataforma.
 * @property {boolean} canExport - Indica si UPSE aplica su política local de extracción de subtítulos.
 * @property {ContentEntitlementTier} entitlementTier - Nivel de acceso del contenido.
 * @property {'official_adapter' | 'none'} exportGrantSource - Origen del criterio de exportación.
 * @property {string|null} restrictionReason - Causa del bloqueo si canExport es falso.
 */

/**
 * Prueba de autorización efímera vinculada a un worker y URL específica.
 * @typedef {Object} AuthorizedAccessProof
 * @property {string} proofId - UUID v4 generado en memoria para esta prueba.
 * @property {number} classId - ID de clase verificado.
 * @property {string} canonicalUrl - URL canónica enlazada estructuralmente.
 * @property {string[]} authorizedVttUrls - Lista blanca de URLs VTT permitidas para esta clase.
 * @property {number} issuedAt - Timestamp (ms) de emisión.
 * @property {number} expiresAt - Timestamp (ms) de caducidad (máx. 10 minutos).
 * @property {string} sessionFingerprint - Huella efímera de la sesión del navegador.
 */

/**
 * Adaptador de Autorización. El adaptador productivo por defecto es UNKNOWN;
 * nunca se construye desde sessionContext, user, props o consentimiento local.
 * @interface IAuthorizationAdapter
 */
/**
 * @function
 * @name IAuthorizationAdapter#resolveClassIdentity
 * @param {string} classUrl - URL HTTPS de clase ya validada.
 * @param {AccountSessionStatus} sessionStatus - Sesión verificada.
 * @returns {Promise<{status: 'verified', source: 'public_catalog'|'official_adapter', identity: ClassIdentityMetadata}>}
 * Identidad fuente-vinculada con courseId/classId positivos y canonicalUrl.
 */
/**
 * @function
 * @name IAuthorizationAdapter#checkSession
 * @returns {Promise<AccountSessionStatus>}
 */
/**
 * @function
 * @name IAuthorizationAdapter#checkClassAccess
 * @param {ClassIdentityMetadata} identity - Identidad pública resuelta.
 * @param {AccountSessionStatus} sessionStatus - Sesión verificada.
 * @returns {Promise<CapabilityDecision>}
 */
/**
 * @function
 * @name IAuthorizationAdapter#checkExportPermission
 * @param {ClassIdentityMetadata} identity - Identidad pública resuelta.
 * @param {AccountSessionStatus} sessionStatus - Sesión verificada.
 * @param {CapabilityDecision} access - Resultado canView verificado.
 * @returns {Promise<CapabilityDecision>}
 */
/**
 * @function
 * @name IAuthorizationAdapter#issueAccessProof
 * @param {ClassIdentityMetadata} identity - Metadata verificada.
 * @param {CapabilityDecision} capabilities - Decisión que debe tener canExport === true.
 * @param {string[]} vttUrls - URLs candidatas de VTT extraídas de la metadata protegida.
 * @returns {AuthorizedAccessProof}
 */
/**
 * @function
 * @name AuthorizationService#recheck
 * @param {ClassIdentityMetadata} identity - Identidad que se vuelve a consultar.
 * @returns {Promise<CapabilityDecision>} Decisión fresca de los tres permisos.
 */
```

---

## 4. Archivos Actuales a Modificar y Mapa de Callers

| Archivo | Rol Actual | Modificación Requerida | Callers Impactados |
| :--- | :--- | :--- | :--- |
| [`src/utils/platziAccess.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/src/utils/platziAccess.js) | Inspecciona SSR y material protegido. | `AuthorizationService.authorizeClassUrl` resuelve primero identidad pública; después de los tres permisos, `inspectClassIdentityDocument` solo corrobora SSR y `extractProtectedMaterial` procesa material protegido. | `useSubtitleExtractor.js`, `languageDetector.js`, `platziClient.js` |
| [`src/utils/platziClient.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/src/utils/platziClient.js) | Realiza `fetch` directo o proxy y llama `assertFreeAccessProofForUrl`. | Unificar validación bajo `assertAuthorizedExportProof(proof, vttUrl)`. Manejar códigos 401/403/429 disparando eventos de revocación inmediata. Clarificar que `credentials: include` no garantiza autenticación válida. | `useCourseParser.js`, `useSubtitleExtractor.js`, `languageDetector.js` |
| [`src/utils/courseParser.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/src/utils/courseParser.js) | Extrae temario y títulos mediante DOM. | Integrar `inspectClassIdentity` para catalogar el estado `isFreePublic` por clase sin acceder a streams ni forzar errores durante el parseo general. | `useCourseParser.js` |
| [`src/hooks/useSubtitleExtractor.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/src/hooks/useSubtitleExtractor.js) | Bucle concurrente de extracción (concurrencia 2). | Revalidar `canExport` antes de VTT y antes de consolidar `extractedContent`. Manejar invalidación atómica de lote si el worker suspende o la sesión caduca. | `App.jsx`, `CourseDetail.jsx` |
| [`src/utils/downloader.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/src/utils/downloader.js) | Genera TXT y ZIP directamente desde el store. | Añadir barrera previa de exportación: verificar que cada video en la selección cuente con proof vigente no revocado antes de llamar a `saveAs`. | `ExportSection.jsx` |
| [`src/store/authStore.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/src/store/authStore.js) | Sanitiza token y cookie en modo extensión. | Añadir contador de versión de sesión (`sessionEpoch`) y método `invalidateSession()` para invalidar todas las proofs en memoria activas. | `useAuth.js`, `useSubtitleExtractor.js`, `platziClient.js` |
| [`src/store/subtitleStore.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/src/store/subtitleStore.js) | Almacena videos y contenidos extraídos. | Añadir acción `purgeExtractedContent()` que borre textos extraídos de memoria cuando se detecte cambio de cuenta o sesión inválida. | `useSubtitleExtractor.js`, `ExportSection.jsx` |

---

## 5. Caminos URL -> TXT / ZIP y Manejo de Estados

### 5.1. Flujo Paso a Paso
1. **Catalogación del Temario:** `courseParser.js` puede leer el catálogo público y listar enlaces. Esa lectura no autoriza material protegido.
2. **Identidad y evaluación antes del HTTP de clase:** Se valida HTTPS y host exacto, se ejecuta `checkSession`, y el adaptador explícito debe resolver una identidad pública fuente-vinculada (`courseId`, `classId`, `canonicalUrl`) mediante `resolveClassIdentity(classUrl, session)`. Si no existe esa fuente o algún ID no está verificado, el estado es `UNKNOWN_CLASS_IDENTITY` y no se solicita HTML de clase. Después se ejecutan por separado `checkClassAccess` y `checkExportPermission`; los tres resultados deben ser `verified` y ligarse a identidad, cuenta, época y expiración.
3. **Fase de Extracción de Subtítulos:** Solo tras la decisión verificada se solicita el HTML de clase. `inspectClassIdentityDocument` corrobora posteriormente `canonicalUrl`, `classId` y `courseId` del SSR; cualquier discrepancia rechaza la respuesta. Solo entonces se extraen VTT y se genera `AuthorizedAccessProof`. Cada intento, incluido un retry tras 429, repite el gate completo antes del HTTP sensible.
4. **Fase de Exportación (Descarga TXT / ZIP):** Antes de generar contenido y justo antes de cada `saveAs`, `downloader.js` revalida mediante `AuthorizationService.recheck` y la época/cuenta actuales. Para ZIP también se revalida después de `generateAsync`; una revocación durante la compresión cancela el guardado.

### 5.2. Estados del Sistema
* `READY_FOR_EXPORT`: Clase autorizada y VTT procesado en memoria.
* `DENIED_NON_FREE`: Clase privada bloqueada por política de seguridad; sin solicitud a VTT.
* `DENIED_SESSION_EXPIRED`: Petición interceptada por HTTP 401; proofs invalidadas.
* `DENIED_RATE_LIMITED`: Petición detenida por HTTP 429 / WAF; extracción suspendida con backoff.
* `UNKNOWN_METADATA`: HTML SSR corrupto o Next Flight ininteligible; falla cerrado por defecto.

---

## 6. Resiliencia en MV3, Invalidación de Sesión y Manejo de Red

### 6.1. Ciclo de Vida del Service Worker MV3 y Pérdida de Estado
* De acuerdo con la documentación oficial de Google sobre extensiones:  
  [Chrome Extensions Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle),  
  los Service Workers en Manifest V3 son **efímeros por diseño** y se terminan (suspenden) cuando quedan inactivos (habitualmente tras 30 segundos sin eventos) o ante presión de recursos del navegador.
* **Impacto en Arquitectura:** Al suspenderse el Service Worker, **todas las variables globales y el estado en memoria se destruyen por completo**.
* **Mitigación Adoptada:**
  * UPSE opera en una pestaña completa dedicada (`index.html`), cuyo contexto de ejecución (DOM Window / Heap) permanece activo mientras la pestaña esté abierta.
  * El Service Worker de fondo (`background.js`) no almacena estado de sesión ni proofs.
  * Todas las pruebas de acceso (`AuthorizedAccessProof`) residen exclusivamente en la memoria de la pestaña activa y cuentan con un tiempo de vida acotado (`TTL = 600,000 ms`).

### 6.2. `fetch` con `credentials: 'include'` no Demuestra Autenticación
* El uso de `credentials: 'include'` en solicitudes `fetch` instruye al navegador a adjuntar las cookies correspondientes al dominio destino si existen en el almacén de cookies del perfil.
* **Principio de Seguridad:** El hecho de que una petición use `credentials: 'include'` **NO prueba en absoluto que el usuario esté autenticado**. El navegador envía cookies tanto si la sesión es válida como si ha expirado, si pertenece a un usuario anónimo con cookies de tracking o si el servidor devuelve un estado de invitado.
* Por lo tanto, UPSE no infiere autenticación por la presencia de `credentials: 'include'`; cualquier decisión de autorización debe basarse en respuestas explícitas de la plataforma y en la verificación estructural de los datos.

### 6.3. Invalidación de Sesión y Carreras de Concurrencia
* Al detectarse un error `401 Unauthorized` o `403 Forbidden` en cualquier llamada de red:
  1. Se invoca de inmediato `useAuthStore.getState().invalidateSession()`, lo que incrementa el `sessionEpoch`.
  2. Todas las pruebas de acceso previas quedan invalidadas de forma inmediata.
  3. Se ejecuta `useSubtitleStore.getState().purgeExtractedContent()` para purgar los textos extraídos en memoria.
* En el bucle de concurrencia (máximo 2 workers), un cerrojo en memoria (`mutex`) asegura que si un worker detecta una señal de parada o invalidación, el otro worker aborte inmediatamente su operación en curso antes de consolidar datos.

---

## 7. Matriz de los 15 Casos de Autorización y Ciclo de Vida

| # | Escenario de Autorización / Ciclo de Vida | Estado Actual (HEAD `0c605e7`) | Objetivo Verificable (Diseño Propuesto) | Tipo de Test | Bloqueo Externo |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | Clase pública gratuita (`class_is_free: true`), usuario sin sesión. | Identidad pública catalogable; material y exportación bloqueados. | El adaptador predeterminado devuelve `UNKNOWN`; `class_is_free` no otorga permisos. | Unit / Mocked (Node test) | Bloqueado hasta contrato/adaptador oficial. |
| **2** | Clase pública gratuita (`class_is_free: true`), usuario con sesión del navegador. | Identidad pública catalogable; material y exportación bloqueados. | `credentials: include`, `user` y consentimiento local no prueban `authenticated`, `canView` ni `canExport`. | Unit / Mocked (Node test) | Bloqueado hasta contrato/adaptador oficial. |
| **3** | Clase no gratuita (`class_is_free: false`), usuario anónimo en navegador. | Lanza `PLATZI_ACCESS_UNVERIFIED`. Bloquea antes de pedir VTT. | `canView: false`, `canExport: false`. Registra `DENIED_NON_FREE` sin lanzar excepciones no controladas. | Unit / Mocked (Node test) | Ninguno (Comportamiento esperado). |
| **4** | Clase no gratuita (`class_is_free: false`), cuenta registrada sin suscripción de pago. | Lanza `PLATZI_ACCESS_UNVERIFIED`. Bloquea descarga de VTT. | `canView: false`, `canExport: false`. Mensaje claro en UI indicando que la clase no es de libre acceso. | Unit / Mocked | Ninguno. |
| **5** | Clase no gratuita (`class_is_free: false`), cuenta con suscripción Platzi activa (Expert/Plus), sin permiso explícito de exportación. | El adaptador productivo permanece `UNKNOWN`; bloquea antes del HTML de clase. | Solo un mock de test puede devolver `canView: true` y `canExport: false`; producción bloquea hasta contrato oficial. | Contract Pending / Mocked | **Bloqueo Externo #1:** No existe fuente pública verificable de entitlement por clase. |
| **6** | Clase no gratuita (`class_is_free: false`), cuenta con suscripción y permiso explícito verificado de exportación (`canExport = true`). | No soportado (falla cerrado en `class_is_free`). | Adaptador evalúa token/proof de permiso de exportación concedido contractualmente por Platzi; si es válido, permite descarga. | Contract Pending | **Bloqueo Externo #2:** Ausencia de endpoint oficial, OAuth scope o licencia de Platzi para conceder exportación a terceros. |
| **7** | Clase sin video (lectura, quiz, discusión de texto). | Detecta 0 VTTs. Marca `status: 'no-video'`. Exporta archivo `.info.txt`. | Identidad confirmada; materialInfo sin stream de video. Marca `status: 'no-video'` sin error. | Unit / Mocked | Ninguno. |
| **8** | Curso mixto (ej. clases 1 y 2 gratis, clases 3 a 20 privadas). | Clases 1 y 2 terminan en `ready`; al llegar a la clase 3 lanza error y detiene lote. | Procesa clases gratuitas a `ready`; marca privadas como `blocked/skipped` sin abortar el progreso de las gratuitas. Permite exportar ZIP parcial. | Unit / Mocked | Ninguno. |
| **9** | Metadata SSR corrupta o truncada (Next Flight malformado). | Falla en `JSON.parse` o no encuentra records. Retorna `UNKNOWN` y bloquea. | Falla cerrado con código `UNKNOWN_METADATA`. Documenta error sin colapsar el worker. | Unit / Mocked (Node test) | Ninguno. |
| **10** | Inyección en trama `T` o intento de spoofing de `class_is_free`. | El parser de UTF-8 consume bytes de trama `T` e ignora JSON falso embebido. | Validación estructural estricta: ignora componentes falsos y rechaza metadata no coincidente con canonical URL. | Unit / Mocked (Node test) | Ninguno. |
| **11** | Suspensión/hibernación del Service Worker de MV3 durante lote largo. | La extensión corre en pestaña completa (`index.html`); el tab sigue vivo aunque el SW descargue. | Se reconoce la pérdida de estado en SW según lifecycle de Chrome; proofs ligadas al heap de la pestaña activa. Si el tab recarga, se purgan proofs. | Unit / Mocked | Ninguno. |
| **12** | Cambio de cuenta en Platzi en otra pestaña del navegador durante la extracción. | Las siguientes peticiones se enviarán con las nuevas cookies por el navegador. Puede haber inconsistencia. | Al detectar discrepancia de identidad o respuesta anómala, se incrementa `sessionEpoch` e invalida proofs previas. | Unit / Mocked | **Bloqueo Externo #3:** La extensión no tiene permiso `cookies` para suscribirse a eventos de cambio de sesión. |
| **13** | Expiración de sesión (401 repentino a mitad del lote). | `platziClient` lanza error; `useSubtitleExtractor` reporta error genérico. | Evento 401 dispara invalidación atómica inmediata de todas las proofs del lote y purga textos del store. | Unit / Mocked | Ninguno. |
| **14** | Condición de carrera entre workers concurrentes ante error de red. | Ambas promesas compiten; `stopRequested` puede retrasarse un ciclo de red. | Mutex en memoria asegura que la primera señal de parada cancele el slot del segundo worker inmediatamente. | Unit / Mocked | Ninguno. |
| **15** | Bloqueo por Cloudflare / WAF (código 403 / 429 / pantalla de desafío). | Detecta patrones ("just a moment", "verify you are human") y detiene extracción. | Detención inmediata con backoff exponencial. Notificación clara de bloqueo anti-bot al usuario. | Unit / Mocked | **Bloqueo Externo #4:** Desafíos interactivos de Turnstile requieren resolución manual en la pestaña de Platzi. |

---

## 8. Packaging, Manifest V3 y Background Service Worker

1. **Manifest V3 (`public/manifest.json`):**
   * Se preserva inalterado en versión 1.0.7:
     * `permissions: []`
     * `host_permissions: ["https://platzi.com/*", "https://www.platzi.com/*", "https://static.platzi.com/*"]`
   * No se añadirá el permiso `cookies` ni `storage` privilegiado. El cumplimiento con las directivas de Chrome Web Store ("Single Purpose", "Minimum Permissions") es un requisito estricto de este diseño.
2. **Background (`src/background.js`):**
   * Mantiene su rol exclusivo de apertura y enfoque de la pestaña de trabajo (`index.html`).
   * No contendrá lógica de negocio, almacenamiento de credenciales ni intermediación de autorización de red. Toda la evaluación se ejecuta en el contexto del documento de la pestaña (`extension window`).

---

## 9. Plan de Validación y Criterios de Aceptación

Para que una implementación posterior de este diseño sea aceptada, deberá cumplir con:
1. **Pruebas Unitarias Aisladas (Node Test Runner):**
   * 100% de cobertura en la separación de `inspectClassIdentity` y `extractProtectedMaterial`.
   * Pruebas de simulación de fallo cerrado: cualquier payload no verificado o con `canExport: false` debe impedir llamadas a `fetch(vttUrl)`.
   * Pruebas de expiración y revocación de `AuthorizedAccessProof`.
2. **Pruebas de Contrato (Mocked Contract Tests):**
   * Simulación del ciclo completo de un curso con clases mixtas verificando que las clases públicas se descarguen y las protegidas se marquen como no exportables sin interrumpir el flujo.
3. **Validación de Empaquetado:**
   * `rtk npm run lint` limpio con 0 advertencias.
   * `rtk npm run build:extension` exitoso generando `dist/upse-extension.zip`.
4. **Verificación de Cero Fuga de Credenciales:**
   * Comprobación automatizada de que el estado de `localStorage` (`platzi_session`) jamás contiene cadenas de cookies ni tokens de sesión.

---

## 10. Matriz de Riesgos y Mitigaciones

| Riesgo Técnico / Operativo | Probabilidad | Impacto | Estrategia de Mitigación |
| :--- | :---: | :---: | :--- |
| **Cambio de formato SSR en Platzi:** Platzi modifica el stream Next Flight o elimina los eventos `material-view`. | Media | Alto | El parser falla cerrado (`UNKNOWN_METADATA`). Se aísla el parser en `platziAccess.js` con selectores alternativos y pruebas de regresión. |
| **Rechazo en Chrome Web Store:** Sospecha de elusión de paywalls en revisión de tienda. | Baja | Crítico | Se mantiene la documentación `CHROME_WEB_STORE_PRIVACY.md`, la separación de `canView`/`canExport` y el bloqueo explícito de clases privadas, demostrando respeto a los términos del sitio. |
| **Sobrecarga de peticiones (Rate Limit):** Extracción rápida de muchos cursos genera baneo temporal por IP. | Media | Medio | Concurrencia limitada a 2 hilos, espacio mínimo de 400ms entre solicitudes y respeto al header `Retry-After`. |

---

## 11. Solicitud Formal a Platzi (Ticket / Consulta Técnica)

Para desbloquear de forma productiva y legítima el soporte de cuentas con suscripción en clases privadas (Casos #5 y #6), se formula la siguiente propuesta de solicitud formal dirigida al equipo de ingeniería o soporte para desarrolladores de Platzi:

```text
Asunto: Consulta técnica y solicitud de especificación de API para herramienta de accesibilidad y estudio (Ultimate Platzi Subtitle Extractor)

Estimado equipo de Ingeniería y Producto de Platzi,

Nos ponemos en contacto como desarrolladores del proyecto de código abierto Ultimate Platzi Subtitle Extractor (UPSE), una extensión de navegador para Chromium concebida como herramienta de accesibilidad, apoyo al aprendizaje y estudio offline de transcripciones de cursos.

En su versión actual (1.0.7), UPSE implementa una estricta política de "falla cerrada": el adaptador productivo UNKNOWN bloquea material y exportación para clases gratuitas o privadas hasta que exista una fuente oficial verificable. `class_is_free` en HTML SSR no concede permisos.

Con el objetivo de extender esta funcionalidad a estudiantes que cuentan con una suscripción activa (Platzi Expert / Plus) de manera 100% legítima, segura y en total conformidad con sus Términos de Servicio, solicitamos amablemente su orientación en los siguientes puntos:

1. Licencia Expresa para Copias de Estudio:
¿Es posible acordar una licencia o autorización formal para permitir a estudiantes activos generar copias en texto (TXT/ZIP) de los subtítulos de cursos suscritos exclusivamente para su estudio personal y accesibilidad?

2. Flujo Oficial de Identidad y Sesión (OAuth2 / SSO):
¿Existe o se planea un endpoint oficial de autenticación (ej. OAuth2 / PKCE) para que herramientas de estudio verifiquen la identidad y suscripción del estudiante sin requerir el acceso o lectura de cookies de sesión sensibles (sessionid)?

3. Entitlement Canónico y Permiso Granular de Exportación:
¿Cuenta Platzi con un esquema para consultar entitlements por curso/clase canónicos que distinga formalmente la facultad de reproducción interactiva (canView) de la autorización de descarga de transcripciones (canExport), incluyendo marcas de caducidad y revocación?

4. Parámetros de Tasa de Peticiones (Rate Limiting) y Marca:
Actualmente nuestra herramienta limita la concurrencia a un máximo de 2 hilos con intervalos de al menos 400 ms entre llamadas y backoff ante 429. ¿Qué parámetros oficiales de rate-limiting recomiendan para no impactar su infraestructura, y cuáles son las directrices para el uso adecuado de marcas y referencias a la plataforma?

Agradecemos enormemente su atención y quedamos a su entera disposición para proveer detalles adicionales de nuestra arquitectura o colaborar en un estándar de integración transparente.

Atentamente,
Equipo de Desarrollo - Ultimate Platzi Subtitle Extractor
Repositorio: https://github.com/DA0806/ultimate-platzi-subtitle-extractor
```
