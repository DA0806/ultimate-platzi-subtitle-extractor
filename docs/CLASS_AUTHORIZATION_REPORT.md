# Reporte de Auditoría: Arquitectura de Autorización, Separación de Capacidades y Ciclo de Vida MV3

**Identificador:** `REP-2026-10-09-CLASS-AUTH-MV3`  
**Producto:** Ultimate Platzi Subtitle Extractor (UPSE) 1.0.7  
**Rama:** `feat/browser-extension`  
**Worktree:** `worktrees/browser-extension`  
**Base HEAD:** `0c605e7` (*"fix: respect class access before subtitle requests (1.0.7)"*)  
**Fecha:** 10 de octubre de 2026  
**Estado:** `IMPLEMENTACIÓN CORREGIDA` (adaptador productivo `UNKNOWN` y deny-by-default; la matriz distingue bloqueado, mock de pruebas y contrato pendiente)

---

## 1. Resumen Ejecutivo

Este informe documenta la reestructuración completa de la arquitectura de autorización y control de acceso de UPSE en su versión 1.0.7. La actualización sustituye modelos heurísticos previos por una arquitectura formal de **separación de capacidades**, **verificación independiente de identidad** y **gestión efímera de pruebas de acceso en memoria**, orientada a respetar las políticas de extensiones de Chrome (Manifest V3) y los términos de las plataformas de contenidos. La conformidad final y cualquier autorización de Platzi requieren revisión jurídica y/o confirmación contractual externa.

### Principales Logros Técnicos
1. **Modelo de Triple Permiso (`CapabilityDecision`):** Se desacoplan formalmente `authenticated`, `canView` y `canExportSubtitles`. Una operación sensible de extracción requiere que las tres condiciones sean devueltas como verificadas por el adaptador y estén ligadas a identidad, cuenta, época y expiración. Cualquier estado indefinido o desconocido (`UNKNOWN`) falla cerrado (`DENY`).
2. **Adaptador productivo cerrado:** `AuthorizationService` usa un adaptador `UNKNOWN` por defecto. `class_is_free`, `user`, `sessionStatus` y el consentimiento local no son autoridad.
3. **Resolución Independiente de Identidad:** Antes del primer HTTP de una clase se valida la URL, se comprueba la sesión y un adaptador explícito debe resolver una identidad pública fuente-vinculada (`courseId`, `classId`, `canonicalUrl`) mediante `resolveClassIdentity(classUrl, session)`. Si no hay resolver o IDs verificados, el gateway devuelve `UNKNOWN_CLASS_IDENTITY` sin solicitar HTML de clase. El SSR posterior solo corrobora esa identidad; ningún stream ni pista VTT puede construirla.
4. **Pruebas de Acceso Efímeras (`AuthorizedAccessProof`):** Autorizaciones temporales (TTL de 10 min) en memoria volátil vinculadas a una época de sesión (`sessionEpoch`) y a la lista blanca exacta de URLs VTT.
5. **Invalidación Atómica y Purga Inmediata:** Ante respuestas HTTP 401/403, se incrementa el `sessionEpoch`, se revocan todas las pruebas en memoria y se purga el contenido de subtítulos extraídos (`purgeExtractedContent`).
6. **Protección Contra Condiciones de Carrera:** El extractor concurrente valida épocas de trabajo (`jobEpoch`) impidiendo que promesas rezagadas sobrescriban el estado tras una cancelación o cambio de sesión.
7. **Eliminación Total de Vías de Cookies Manuales:** Se suprimieron todos los mecanismos de inyección de cookies manuales (`Cookie`, `x-platzi-cookie`), formularios de login simulado y almacenamiento persistente de credenciales.
8. **Preflight en Exportaciones:** Antes de generar y descargar TXT o ZIP (`downloader.js`), se valida la prueba; para ZIP se repite el gate completo después de `generateAsync` y justo antes de `saveAs`, de modo que una revocación durante la compresión cancela el guardado.

---

## 2. Fuentes Consultadas y Límite de Evidencia

El diseño usa documentación pública de políticas y ciclo de vida, pero **no se encontró una fuente pública verificable que defina una sesión de extensión, identidad de clase o entitlement `canView`/`canExport` por clase**. Una fuente privada o futura puede existir; no se inventa un endpoint ni se considera contactado a ningún tercero. Por ello, el adaptador productivo permanece `UNKNOWN` y bloquea. La integración futura debe entregar explícitamente `resolveClassIdentity(classUrl, session)`, `checkSession`, `checkClassAccess` y `checkExportPermission` con respuestas vinculadas a identidad, cuenta, época y expiración.

El diseño y los límites operativos se fundamentan en documentación pública oficial:

| Fuente | URL | Relevancia y Conclusiones Técnicas |
| :--- | :--- | :--- |
| **Platzi - Términos de Servicio** | [`https://platzi.com/terminos/`](https://platzi.com/terminos/) | Establece la titularidad de los contenidos y la prohibición de copia o distribución no autorizada. Justifica el requisito de que una suscripción de visualización no otorga tácitamente derechos de exportación masiva. |
| **Platzi - Centro de Ayuda** | [`https://platzi.com/ayuda/`](https://platzi.com/ayuda/) | Guía de acceso a cursos para estudiantes. Constata la ausencia de documentación pública sobre APIs de sesión de usuario para extensiones de terceros. |
| **Platzi - Business** | [`https://platzi.com/business/`](https://platzi.com/business/) | Documenta analítica corporativa y gestión de equipos; confirma la ausencia de endpoints públicos de OAuth2 personal. |
| **Google Chrome - MV3 Service Worker Lifecycle** | [`https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle`](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) | Los Service Workers de MV3 se suspenden por inactividad destruyendo el estado global en memoria. Requiere que el estado de trabajo resida en la ventana activa de la pestaña (`index.html`) con pruebas efímeras. |
| **Google Chrome Web Store - User Data Policy** | [`https://developer.chrome.com/docs/webstore/program-policies/user-data/`](https://developer.chrome.com/docs/webstore/program-policies/user-data/) | Impone los principios de Propósito Único y Mínimos Permisos. Prohíbe solicitar permisos innecesarios como `cookies` o `tabs` si la tarea puede realizarse con credenciales nativas del navegador. |

---

## 3. Arquitectura del Sistema de Autorización

El Service Worker actual solo abre la interfaz. No autoriza, no guarda pruebas y no detecta cambios silenciosos de cuenta. Cada operación sensible vuelve a consultar el adaptador desde la página de la extensión; si no existe una identidad de cuenta estable o una respuesta vigente, permanece en `UNKNOWN` y se deniega. Los cambios silenciosos solo pueden detectarse cuando una futura fuente devuelve una identidad estable; no se finge autodetección.

### 3.1. Flujo de Datos y Separación de Fases

```text
[ Entrada URL ]
       │
       ▼
[ Módulo 1: Identity & Canonical Resolver ]
  - Resuelve ClassIdentityMetadata fuente-vinculada (courseId, classId, canonicalUrl) desde catálogo público/adapter explícito
  - Independiente de reproductores, streams o VTTs; si no hay fuente, UNKNOWN_CLASS_IDENTITY.
       │
       ▼
[ Módulo 2: Motor de Decisión (CapabilityDecision) ]
  - Evalúa desde el adapter: `checkSession`, `checkClassAccess` y `checkExportPermission`:
      1. authenticated
      2. canView
      3. canExportSubtitles
  - Si falta algún permiso o es UNKNOWN -> DENY (Falla cerrado)
       │
       ▼
[ Módulo 3: Resolución de Material Protegido ]
  - Emite AuthorizedAccessProof efímero (UUID, classId, canonicalUrl, authorizedVttUrls, TTL 10m, sessionEpoch)
  - Consulta VTTs autorizados mediante platziClient.getVtt(url, proof)
       │
       ▼
[ Módulo 4: Pre-flight en Exportación (TXT / ZIP) ]
  - Valida que todos los videos seleccionados mantengan un proof vigente con sessionEpoch actual
  - ZIP repite el gate después de `generateAsync` y antes de `saveAs`; si hubo error 401/403 o cambio de época -> operación cancelada y contenido purgado
```

### 3.2. Contratos y Tipos de Dominio

- **`ClassIdentityMetadata`:** Estructura inmutable entregada por un resolver público fuente-vinculado que representa la identidad antes de evaluar permisos; el DOM/SSR solo la corrobora después.
- **`CapabilityDecision`:** Estructura de decisión que contiene `authenticated`, `canView`, `canExportSubtitles`, `entitlementTier`, `exportGrantSource` y `restrictionReason`.
- **`AuthorizedAccessProof`:** Credencial volátil en memoria requerida para cualquier petición a `getVtt(url, proof)` y para la descarga de archivos en `downloader.js`.

---

## 4. Matriz: Implementado vs. Mocks vs. Contrato Pendiente vs. Real

| # | Escenario de Autorización / Ciclo de Vida | Comportamiento Implementado en Código | Estado del Soporte | Cobertura de Pruebas |
| :---: | :--- | :--- | :---: | :---: |
| **1** | Clase pública gratuita (`class_is_free: true`), usuario sin sesión activa. | Permite catalogar e identificar clase; bloquea material y exportación. | **Bloqueado por defecto** | Unit test (`authorizationService.test.js`) |
| **2** | Clase pública gratuita (`class_is_free: true`), usuario con sesión de navegador. | `credentials: include` no se considera autoridad; bloquea material y exportación. | **Bloqueado por defecto** | Unit test (`authorizationService.test.js`) |
| **3** | Clase no gratuita (`class_is_free: false`), usuario anónimo en navegador. | `canView: false`, `canExport: false`. Falla cerrado preventivamente sin solicitar streams ni VTTs. Estado marcado como `blocked`. | **Implementado** | Unit test (`authorizationCases.test.js`) |
| **4** | Clase no gratuita (`class_is_free: false`), cuenta registrada gratuita. | `canView: false`, `canExport: false`. Se deniega preventivamente. Notificación clara de contenido no accesible. | **Implementado** | Unit test (`authorizationCases.test.js`) |
| **5** | Clase privada (`class_is_free: false`), usuario suscriptor Platzi (Expert/Plus) sin permiso de exportación. | Solo un mock de test puede devolver `canView: true` y `canExport: false`; producción permanece UNKNOWN y bloquea la extracción hasta un contrato oficial. | **Pendiente de Contrato** | Simulado en mock adapter de pruebas unitarias. Bloqueado en producción. |
| **6** | Clase privada (`class_is_free: false`), usuario suscriptor con permiso explícito verificado de exportación. | Una futura fuente oficial debe otorgar los 3 permisos (`authenticated`, `canView`, `canExportSubtitles`) ligados a la identidad resuelta. Descarga permitida mediante proof solo con ese adapter explícito. | **Pendiente de Contrato** | Simulado en mock adapter de pruebas unitarias. Deshabilitado en producción. |
| **7** | Clase sin video (lectura, quiz, discusión de texto). | La identidad puede catalogarse, pero material/exportación requieren autoridad oficial; por defecto se bloquean. | **Bloqueado por defecto** | Unit test (`authorizationCases.test.js`) |
| **8** | Curso mixto (clases públicas intercaladas con clases privadas). | Todas las clases quedan bloqueadas hasta que una fuente oficial evalúe cada identidad por separado. | **Bloqueado por defecto** | Unit test (`authorizationCases.test.js`) |
| **9** | Metadata SSR corrupta o respuesta HTML truncada. | Parser falla cerrado con código `PLATZI_ACCESS_UNVERIFIED` / `UNKNOWN_METADATA`. Previene desbordamientos o llamadas indebidas. | **Implementado** | Unit test (`authorizationCases.test.js`) |
| **10** | Inyección maliciosa en tramas SSR o intento de spoofing de `class_is_free`. | El parser de secuencias rechaza objetos manipulados y valida la coincidencia exacta de la URL canónica y el encabezado `<h1>`. | **Implementado** | Unit test (`authorizationCases.test.js`) |
| **11** | Suspensión/reinicio del Service Worker de MV3. | El estado volátil y proofs residen en la pestaña abierta (`index.html`). Al reiniciar o recargar, el estado se limpia limpiamente (fail-closed). | **Implementado** | Unit test de ciclo de vida |
| **12** | Cambio de cuenta en Platzi en otra pestaña del navegador. | Al detectar discrepancia de sesión o recibir 401/403, se incrementa `sessionEpoch`, invalidando proofs y purgando textos extraídos. | **Implementado** | Unit test (`authLifecycle.test.js`) |
| **13** | Expiración de sesión (HTTP 401 durante el lote). | Invalida inmediatamente `sessionEpoch`, revoca proofs activas, detiene el lote y purga el contenido de subtítulos extraídos de memoria. | **Implementado** | Unit test (`authLifecycle.test.js`) |
| **14** | Condición de carrera entre workers concurrentes. | Mutex en memoria y validación de `jobEpoch` descartan escrituras tardías de workers en vuelo cuando se solicita parada o invalidación. | **Implementado** | Unit test (`authLifecycle.test.js`) |
| **15** | Desafío WAF / Límite de tasa (HTTP 429). | Detecta patrones antibot y respeta el encabezado `Retry-After` con retroceso exponencial. Pausa el lote sin corrupción de datos. | **Implementado** | Unit test (`platziClient.test.js`) |

> [!CAUTION]
> **Declaración explícita sobre contenido premium:**  
> La integración con clases protegidas de pago **NO está activa ni soportada en producción**. El adaptador productivo opera en modo cerrado (`UNKNOWN` -> `DENY`) porque no existe una fuente pública verificable para sesión/entitlement por clase. Una fuente privada o futura puede existir, pero no se inventa endpoint ni se declara contacto con terceros. Los flujos de autorización para suscriptores existen exclusivamente en adaptadores simulados (mocks) dentro de la suite de pruebas unitarias locales.

Los adaptadores de prueba se construyen directamente en los tests mediante `AuthorizationService`; no se seleccionan desde props, `sessionContext`, `user`, almacenamiento ni configuración de la extensión empaquetada.

---

## 5. Solicitud Formal a Platzi (Propuesta de Comunicación Oficial)

Para consultar si existe una integración autorizable y qué requisitos contractuales o técnicos aplicarían a los escenarios #5 y #6, se propone la siguiente comunicación formal dirigida a Ingeniería y Alianzas de Platzi:

```text
Asunto: Consulta técnica y solicitud de especificación de API para herramienta de accesibilidad y estudio (Ultimate Platzi Subtitle Extractor)

Estimado equipo de Ingeniería, Producto y Alianzas de Platzi,

Nos ponemos en contacto como desarrolladores del proyecto de código abierto Ultimate Platzi Subtitle Extractor (UPSE), una extensión de navegador para Chromium concebida como herramienta de apoyo al aprendizaje, accesibilidad y estudio offline de transcripciones de cursos.

En su versión actual (1.0.7), UPSE implementa una estricta política de "falla cerrada": el adaptador productivo UNKNOWN bloquea material y exportación para clases gratuitas o privadas hasta que exista una fuente oficial verificable. `class_is_free` en HTML SSR no concede permisos.

La versión actual permanece bloqueada para material y exportación porque no existe una fuente oficial verificable. Con el objetivo de habilitar cualquier escenario de manera 100% legítima, segura y en total conformidad con sus Términos de Servicio, solicitamos amablemente su orientación en los siguientes puntos:

1. Licencia Expresa para Copias de Estudio y Accesibilidad:
¿Es posible convenir una autorización o licencia formal para permitir a estudiantes activos generar copias en texto (TXT/ZIP) de los subtítulos de cursos a los que tienen acceso legítimo, exclusivamente para su estudio personal y necesidades de accesibilidad?

2. Flujo Oficial de Identidad y Sesión (OAuth2 / PKCE):
¿Existe o se proyecta un endpoint oficial de autenticación (ej. OAuth2 con flujo PKCE para aplicaciones de navegador) mediante el cual una extensión pueda autenticar al usuario y comprobar su suscripción sin requerir la manipulación ni lectura de cookies de sesión sensibles (sessionid)?

3. Entitlement Canónico y Permiso Granular de Exportación:
¿Cuenta Platzi con un modelo para consultar entitlements por curso/clase canónicos que distinga formalmente la facultad de reproducción interactiva (canView) de la autorización de descarga de transcripciones (canExport), incluyendo marcas de caducidad y mecanismos de revocación?

4. Parámetros de Tasa de Peticiones (Rate Limiting) y Directrices de Marca:
Nuestra herramienta restringe la concurrencia a un máximo de 2 hilos con intervalos de al menos 400 ms entre peticiones y retroceso ante respuestas 429. ¿Qué parámetros oficiales de rate-limiting recomiendan para salvaguardar su infraestructura, y cuáles son las directrices para el uso adecuado de marcas y referencias a la plataforma?

Agradecemos su tiempo y consideración, y quedamos a su entera disposición para compartir documentación detallada de nuestra arquitectura o colaborar en un estándar de integración abierto.

Atentamente,
Equipo de Desarrollo - Ultimate Platzi Subtitle Extractor
Repositorio: https://github.com/DA0806/ultimate-platzi-subtitle-extractor
```

---

## 6. Resultados de Validación y Verificación

La validación final se ejecutó el 10 de octubre de 2026 en el worktree `worktrees/browser-extension`, rama `feat/browser-extension`, sobre HEAD inicial `0c605e7`. No se hizo fetch, merge, commit, stage ni push.

1. **Lint:** `rtk npm run lint` — salida 0, sin errores ni advertencias.
2. **Suite Node:** `rtk node --test tests/*.test.js` — **54 passed, 0 failed, 0 skipped, 0 cancelled**.

   | Archivo | Tests | Passed | Failed | Skipped | Cancelled |
   | :--- | ---: | ---: | ---: | ---: | ---: |
   | `tests/zipGate.test.js` | 1 | 1 | 0 | 0 | 0 |
   | `tests/retryGate.test.js` | 2 | 2 | 0 | 0 | 0 |
   | `tests/platziClient.test.js` | 11 | 11 | 0 | 0 | 0 |
   | `tests/platziAccess.test.js` | 11 | 11 | 0 | 0 | 0 |
   | `tests/onboardingSettings.test.js` | 2 | 2 | 0 | 0 | 0 |
   | `tests/authStore.test.js` | 1 | 1 | 0 | 0 | 0 |
   | `tests/authorizationService.test.js` | 5 | 5 | 0 | 0 | 0 |
   | `tests/authorizationCases.test.js` | 16 | 16 | 0 | 0 | 0 |
   | `tests/authLifecycle.test.js` | 4 | 4 | 0 | 0 | 0 |
   | `tests/appStorage.test.js` | 1 | 1 | 0 | 0 | 0 |
   | **Total** | **54** | **54** | **0** | **0** | **0** |

3. **Build web:** `rtk npm run build` — salida 0; Vite produjo `dist/index.html`, `dist/background.js` y los bundles de assets. Vite mostró únicamente un aviso informativo de tiempos de plugins.
4. **Empaquetado MV3:** `rtk npm run build:extension` — salida 0; generó `dist/upse-extension.zip` de 166,482 bytes.
5. **Manifest y contenido del ZIP:** 10 entradas; `manifest_version: 3`; background `background.js` como module service worker; `permissions: []`; hosts exactos `https://platzi.com/*`, `https://www.platzi.com/*`, `https://static.platzi.com/*`; sin `cookies`, `storage` privilegiado, tests, docs, source maps o fixtures en el bundle. `index.html` referencia el JS/CSS presentes; el background solo abre/focaliza `index.html`.
6. **Escaneo de secretos:** se revisaron los 37 archivos modificados/nuevos por categorías de claves privadas, prefijos de credenciales, JWT y nombres sensibles sin imprimir valores; hubo 0 coincidencias fuertes y 0 nombres de archivo sensibles. El ZIP tuvo 0 coincidencias fuertes en sus 7 entradas textuales revisadas.
7. **Whitespace:** `rtk git diff --check` — sin errores.
8. **Smoke UI local:** el servidor Vite inició correctamente y se detuvo después del intento. Playwright no pudo iniciar porque no existe el ejecutable Chromium local; no se instaló ningún navegador. Por tanto, no se reclama E2E visual. La evidencia estática y de Node confirma que el adaptador productivo UNKNOWN bloquea la extracción de clase antes de HTTP, el panel de exportación solo aparece con contenido exportable y los handlers de TXT/ZIP muestran el error de revalidación. No se usaron formularios manuales, login, cookies reales ni sesiones premium.

La fuente oficial de sesión/entitlement por clase sigue pendiente; el adaptador productivo permanece `UNKNOWN -> DENY`. La detección de cambios silenciosos de cuenta solo podrá existir cuando una fuente futura devuelva una identidad de cuenta estable; no se finge autodetección.
