# Plan de Implementación: Autorización de Clases, Separación de Capacidades y Ciclo de Vida MV3

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar una arquitectura de autorización estricta en UPSE que desacople la identidad pública de la metadata protegida del reproductor, distinga explícitamente entre `canView` y `canExport`, valide los 3 permisos (`authenticated`, `canView`, `canExport`), bloquee de forma segura el acceso a clases privadas hasta contar con una especificación oficial de Platzi, y garantice resiliencia ante la suspensión del Service Worker de MV3 y cambios de sesión.

**Architecture:** La arquitectura separa la inspección pública del temario/clase (`ClassIdentityMetadata`) de la extracción del material protegido (`materialInfo.video.movin.subtitles`). Un `AuthorizationService` con adaptador explícito evalúa tres permisos independientes y obligatorios (`authenticated`, `canView`, `canExport`); cualquier estado `unknown` o ausente deniega. Antes del primer HTTP de una clase protegida, `authorizeClassUrl` valida URL, comprueba sesión, llama a `resolveClassIdentity(classUrl, session)` y exige una identidad pública fuente-vinculada (`courseId`, `classId`, `canonicalUrl`) antes de los tres permisos. `class_is_free`, `user`, `sessionStatus` y el consentimiento local no conceden autoridad. Antes de solicitar HTML/VTT y antes de emitir descargas TXT/ZIP, se exige una prueba efímera en memoria (`AuthorizedAccessProof`) que se invalida y purga ante errores 401/403 o desincronización de sesión; ZIP repite `recheck` tras `generateAsync` y antes de `saveAs`. No existe una fuente pública verificable de sesión/entitlement por clase; el adaptador productivo es `UNKNOWN` hasta recibir un contrato oficial explícito.

**Tech Stack:** JavaScript moderno (ES2022+), JSDoc para tipado estático, Node Test Runner (`node:test`, `node:assert/strict`), Zustand 5 (gestión de estado de sesión y extracción), JSZip 3, FileSaver, Vite 8 (empaquetador MV3 sin dependencias nuevas).

---

## Restricciones y Reglas Invariantes

1. **READ-ONLY en Sesión de Planificación:** No modificar código productivo ni tests en esta sesión; no ejecutar `git commit` ni `git push`. (Los pasos de commit listados en las tareas son directivas para la sesión futura de ejecución con `executing-plans`).
2. **Cero Dependencias Nuevas:** Reutilizar únicamente librerías ya presentes en `package.json` (`zustand`, `jszip`, `file-saver`, `lucide-react`, `axios`, `react`).
3. **Sin APIs Ficticias ni Mocks en Producción:** Default-closed (`deny`) ante cualquier respuesta o metadata desconocida. Clases de pago/suscripción quedan terminantemente bloqueadas en producción hasta contar con evidencia de API o contrato oficial de Platzi.
4. **Cero Permisos Privilegiados en Extensión:** Mantener `permissions: []` en `manifest.json`. Prohibido solicitar `cookies`, `tabs` o `storage` privilegiado. Sin lectura manual de `sessionid` ni flujos de contraseñas.
5. **Aislamiento de Identidad:** Ninguna propiedad derivada de `materialInfo`, streams de video o subtítulos VTT puede utilizarse para inferir o construir la identidad de un curso o clase.

---

## Foco de Revisión Técnica (Review Focus)

* **Seguridad de Acceso:** Confirmar que ninguna clase no pública pueda generar un `AuthorizedAccessProof` válido mientras no exista un proveedor oficial verificado.
* **Separación de Identidad:** Verificar que `resolveClassIdentity(classUrl, session)` entregue una identidad pública fuente-vinculada antes de cualquier HTTP de clase o inspector de reproductor; el SSR posterior solo corrobora esa identidad.
* **Triple Permiso:** Comprobar que `canExport` no se otorgue pasivamente por el simple hecho de que una clase sea pública o el usuario sea anónimo.
* **Resiliencia MV3:** Asegurar que la pérdida de estado del Service Worker no corrompa el heap de la pestaña activa (`index.html`) y que los eventos 401/403 purguen de inmediato los textos extraídos en memoria.
* **Manejo de Cambio Silencioso de Cuenta:** Como la extensión no tiene permiso `cookies` para detectar cambios de sesión en Platzi en tiempo real, cualquier respuesta de red inconsistente (401, 403, o discrepancia en canonical URL) debe forzar un incremento de `sessionEpoch`, revocando todas las pruebas y purgando la memoria viva.

---

## Mapa de Archivos y Símbolos

### Archivos Existentes a Modificar
1. [`src/utils/platziAccess.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/src/utils/platziAccess.js)
   * Símbolos actuales: `ACCESS_STATUS`, `inspectPlatziClassAccessDocument`, `assertPlatziFreeClassDocument`, `assertPlatziFreeClass`, `assertFreeAccessProofForUrl`.
   * Nuevos símbolos: `inspectClassIdentityDocument`, `inspectClassIdentity`, `evaluateClassCapabilities`, `extractProtectedMaterial`, `assertAuthorizedExportProof`. `CapabilityDecision` debe incluir `authenticated`/`authentication`, `canView`/`viewAccess` y `canExport`/`subtitleExport`; solo los tres estados verificados `true` permiten una operación sensible.
2. [`src/utils/platziClient.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/src/utils/platziClient.js)
   * Símbolos actuales: `isExtension`, `getPlatziPage`, `getVtt`, `isAllowedPlatziPageUrl`, `isAllowedVttUrl`.
   * Modificación: Vincular `assertAuthorizedExportProof` y estandarizar eventos de error HTTP 401/403/429.
3. [`src/utils/courseParser.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/src/utils/courseParser.js)
   * Símbolos actuales: `parsePlatziUrl`, `normalizeClassTitle`.
   * Modificación: Incorporar `inspectClassIdentity` en el temario sin intentar extraer streams protegidos.
4. [`src/store/authStore.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/src/store/authStore.js)
   * Símbolos actuales: `useAuthStore`.
   * Nuevos símbolos: `sessionEpoch`, acción `invalidateSession()`.
5. [`src/store/subtitleStore.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/src/store/subtitleStore.js)
   * Símbolos actuales: `useSubtitleStore`.
   * Nuevos símbolos: acción `purgeExtractedContent()`.
6. [`src/hooks/useSubtitleExtractor.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/src/hooks/useSubtitleExtractor.js)
   * Símbolos actuales: `useSubtitleExtractor`.
   * Modificación: Bucle de extracción adaptado a `evaluateClassCapabilities` y purga atómica ante cancelación o fallo 401/403.
7. [`src/utils/downloader.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/src/utils/downloader.js)
   * Símbolos actuales: `downloadVideoTxt`, `downloadMergedTxt`, `downloadZip`.
   * Modificación: Barrera de pre-flight para validar que cada video cuenta con prueba vigente no revocada antes de escribir el Blob.
8. [`src/i18n.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/src/i18n.js)
   * Modificación: Nuevas claves de internacionalización ES y EN para advertencias de autorización, decisión del adaptador oficial y expiración de sesión.

### Archivos de Test
* [`tests/platziAccess.test.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/tests/platziAccess.test.js) (ampliación de suite con desacoplamiento de identidad y triple permiso)
* [`tests/authLifecycle.test.js`](file:///D:/Proyectos/Visual%20Studio%20Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension/tests/authLifecycle.test.js) (nuevo archivo para ciclo de vida MV3, epoch y purga)

---

## Tareas de Implementación (Bite-Sized Tasks)

### Tarea 1: Desacoplamiento de Identidad Pública y Tipado JSDoc (`platziAccess.js`)

**Archivos:**
* Modificar: `src/utils/platziAccess.js`
* Test: `tests/platziAccess.test.js`

- [ ] **Paso 1: Escribir el test que falla**
  Agregar prueba en `tests/platziAccess.test.js` verificando que `inspectClassIdentityDocument` extrae `ClassIdentityMetadata` (`courseId`, `classId`, `canonicalUrl`, `title`, `isFreePublic`) sin requerir ni leer bloques `materialInfo` o VTTs:
  ```javascript
  test('inspectClassIdentityDocument extracts identity metadata independently of player material', () => {
    const doc = fixtureDocument({ events: [classEvent({ classId: 991, className: 'Intro a Rust', classIsFree: true })] });
    const identity = inspectClassIdentityDocument(doc, pageUrl);
    assert.equal(identity.classId, 991);
    assert.equal(identity.title, 'Intro a Rust');
    assert.equal(identity.isFreePublic, true);
    assert.equal('vttUrls' in identity, false); // Totalmente desacoplado de VTTs
  });
  ```
- [ ] **Paso 2: Ejecutar test y verificar fallo**
  Comando: `rtk node --test tests/platziAccess.test.js`  
  Esperado: Fallo con `inspectClassIdentityDocument is not a function`.
- [ ] **Paso 3: Implementar código mínimo**
  En `src/utils/platziAccess.js`, extraer la lógica de inspección de documento separando `inspectClassIdentityDocument(document, pageUrl)` para que retorne únicamente la estructura `ClassIdentityMetadata`, garantizando que ninguna propiedad de `materialInfo` se mezcle en este paso.
- [ ] **Paso 4: Ejecutar test y verificar pase**
  Comando: `rtk node --test tests/platziAccess.test.js`  
  Esperado: PASS.
- [ ] **Paso 5: Handoff de commit (Opcional para ejecutor futuro)**  
  `git commit -m "refactor(access): decouple class identity metadata from player material"`

---

### Tarea 2: Motor de Decisión de Triple Permiso (`evaluateClassCapabilities`)

**Archivos:**
* Modificar: `src/utils/platziAccess.js`
* Test: `tests/platziAccess.test.js`

- [ ] **Paso 1: Escribir el test que falla**
  Agregar pruebas en `tests/platziAccess.test.js` evaluando:
  1. Si no existe un adaptador oficial explícito, `authenticated`, `canView` y `canExport` son `false` o `unknown` y toda clase queda bloqueada.
  2. `isFreePublic`, `user`, `sessionStatus` y `userConsentForPublicExport` nunca cambian esa decisión.
  3. Un adaptador de prueba solo puede habilitar una clase cuando devuelve los tres permisos como `verified`, ligados a cuenta, clase, curso, canonical, época y expiración.
  4. Un futuro adaptador oficial puede autorizar una clase premium solo con un contrato verificable; su construcción no recibe booleans de la interfaz.
- [ ] **Paso 2: Ejecutar test y verificar fallo**
  Comando: `rtk node --test tests/platziAccess.test.js`  
  Esperado: Fallo por ausencia de `evaluateClassCapabilities`.
- [ ] **Paso 3: Implementar código mínimo**
  Implementar en `src/utils/platziAccess.js`:
  ```javascript
  export const evaluateClassCapabilities = (identity) => {
    // Local metadata and UI context never substitute the AuthorizationService.
    return createDeniedAuthorizationDecision(identity ? 'AUTHORIZATION_UNAVAILABLE' : 'UNKNOWN_CLASS_IDENTITY');
  };
  ```
- [ ] **Paso 4: Ejecutar test y verificar pase**
  Comando: `rtk node --test tests/platziAccess.test.js`  
  Esperado: PASS.
- [ ] **Paso 5: Handoff de commit (Opcional)**  
  `git commit -m "feat(access): implement three-permission capability decision engine"`

---

### Tarea 3: Resolución de Material Protegido y Emisión de `AuthorizedAccessProof`

**Archivos:**
* Modificar: `src/utils/platziAccess.js`
* Test: `tests/platziAccess.test.js`

- [ ] **Paso 1: Escribir el test que falla**
  Añadir test que verifique que `extractProtectedMaterial` lanza `PLATZI_ACCESS_UNVERIFIED` si se le pasa una decisión con `canExport: false`, y solo emite un `AuthorizedAccessProof` con TTL de 10 min cuando `canExport: true`.
- [ ] **Paso 2: Ejecutar test y verificar fallo**
  Comando: `rtk node --test tests/platziAccess.test.js`  
  Esperado: Fallo con error de función no definida.
- [ ] **Paso 3: Implementar código mínimo**
  Implementar `extractProtectedMaterial(document, identity, capabilityDecision, sessionFingerprint)` y `assertAuthorizedExportProof(proof, targetVttUrl)`. Vincular estructuralmente la URL de la clase y la lista blanca de VTTs.
- [ ] **Paso 4: Ejecutar test y verificar pase**
  Comando: `rtk node --test tests/platziAccess.test.js`  
  Esperado: PASS.
- [ ] **Paso 5: Handoff de commit (Opcional)**  
  `git commit -m "feat(access): issue and assert ephemeral authorized export proofs"`

---

### Tarea 4: Ciclo de Vida de Sesión en `authStore` y Purga en `subtitleStore`

**Archivos:**
* Modificar: `src/store/authStore.js`
* Modificar: `src/store/subtitleStore.js`
* Crear: `tests/authLifecycle.test.js`

- [ ] **Paso 1: Escribir el test que falla**
  Crear `tests/authLifecycle.test.js` validando que:
  1. `authStore.invalidateSession()` incrementa `sessionEpoch`.
  2. `subtitleStore.purgeExtractedContent()` vacía `extractedContent` de todos los videos conservando el temario.
- [ ] **Paso 2: Ejecutar test y verificar fallo**
  Comando: `rtk node --test tests/authLifecycle.test.js`  
  Esperado: Fallo por métodos no definidos en los stores.
- [ ] **Paso 3: Implementar código mínimo**
  En `src/store/authStore.js`, añadir `sessionEpoch: 0` e `invalidateSession: () => set(s => ({ sessionEpoch: s.sessionEpoch + 1 }))`.  
  En `src/store/subtitleStore.js`, añadir `purgeExtractedContent: () => set(s => ({ videos: s.videos.map(v => ({ ...v, extractedContent: {}, status: v.status === 'ready' ? 'pending' : v.status })) }))`.
- [ ] **Paso 4: Ejecutar test y verificar pase**
  Comando: `rtk node --test tests/authLifecycle.test.js`  
  Esperado: PASS.
- [ ] **Paso 5: Handoff de commit (Opcional)**  
  `git commit -m "feat(store): add session epoch invalidation and memory content purge"`

---

### Tarea 5: Adaptación de `platziClient` y Control de Errores 401/403/429

**Archivos:**
* Modificar: `src/utils/platziClient.js`
* Test: `tests/platziClient.test.js`

- [ ] **Paso 1: Escribir el test que falla**
  Agregar prueba en `tests/platziClient.test.js` verificando que cuando `fetch` recibe un código 401 o 403, lanza un error con código `PLATZI_SESSION_INVALIDATED` y que `getVtt` rechaza pruebas con `sessionEpoch` desactualizado.
- [ ] **Paso 2: Ejecutar test y verificar fallo**
  Comando: `rtk node --test tests/platziClient.test.js`  
  Esperado: Fallo en códigos de error y rechazo de prueba.
- [ ] **Paso 3: Implementar código mínimo**
  En `src/utils/platziClient.js`, actualizar `getVtt` para validar `assertAuthorizedExportProof`. En respuestas de error de red (tanto en `getPlatziPage` como en `getVtt`), adjuntar códigos normalizados `PLATZI_SESSION_INVALIDATED` para 401/403 y `PLATZI_RATE_LIMITED` para 429.
- [ ] **Paso 4: Ejecutar test y verificar pase**
  Comando: `rtk node --test tests/platziClient.test.js`  
  Esperado: PASS.
- [ ] **Paso 5: Handoff de commit (Opcional)**  
  `git commit -m "feat(client): standardize auth error codes and proof validation"`

---

### Tarea 6: Extractor Concurrente con Cancelación Atómica y Purga (`useSubtitleExtractor`)

**Archivos:**
* Modificar: `src/hooks/useSubtitleExtractor.js`
* Test: `tests/platziAccess.test.js`

- [ ] **Paso 1: Escribir el test que falla**
  Diseñar prueba simulando la interrupción de lote cuando una clase lanza 401: el segundo worker en vuelo debe abortar sin guardar texto y el lote debe quedar en estado revocado.
- [ ] **Paso 2: Ejecutar test y verificar fallo**
  Comando: `rtk node --test tests/platziAccess.test.js`  
  Esperado: Fallo en la lógica de interrupción.
- [ ] **Paso 3: Implementar código mínimo**
  Actualizar `useSubtitleExtractor.js`:
  1. Integrar llamada a `evaluateClassCapabilities` antes de procesar cada clase.
  2. Si `canExport` es `false`, marcar la clase como `blocked` y no solicitar VTT.
  3. Ante error 401/403, activar `stopRequested = true`, invocar `invalidateSession()` y `purgeExtractedContent()`.
  4. Mantener la cola de sincronización con retardo de 400ms (`REQUEST_GAP_MS`).
- [ ] **Paso 4: Ejecutar test y verificar pase**
  Comando: `rtk node --test tests/platziAccess.test.js`  
  Esperado: PASS.
- [ ] **Paso 5: Handoff de commit (Opcional)**  
  `git commit -m "feat(extractor): add atomic cancellation and content purge on auth failures"`

---

### Tarea 7: Barrera Pre-Flight de Exportación en `downloader.js`

**Archivos:**
* Modificar: `src/utils/downloader.js`
* Test: `tests/platziClient.test.js`

- [ ] **Paso 1: Escribir el test que falla**
  Agregar prueba que invoque `downloadZip` con videos que carecen de prueba vigente o con sesión invalidada, verificando que la función aborta y no llama a `saveAs`.
- [ ] **Paso 2: Ejecutar test y verificar fallo**
  Comando: `rtk node --test tests/platziClient.test.js`  
  Esperado: Fallo por descarga no bloqueada.
- [ ] **Paso 3: Implementar código mínimo**
  En `src/utils/downloader.js`, agregar verificación de estado antes de generar el Blob en `downloadVideoTxt`, `downloadMergedTxt` y `downloadZip`. Si el estado general de sesión está invalidado (`sessionEpoch` discrepante), abortar y lanzar error descriptivo.
- [ ] **Paso 4: Ejecutar test y verificar pase**
  Comando: `rtk node --test tests/platziClient.test.js`  
  Esperado: PASS.
- [ ] **Paso 5: Handoff de commit (Opcional)**  
  `git commit -m "feat(downloader): enforce pre-flight proof verification before TXT/ZIP export"`

---

### Tarea 8: Textos de Internacionalización y Notificaciones UI (`i18n.js`)

**Archivos:**
* Modificar: `src/i18n.js`
* Test: `tests/onboardingSettings.test.js`

- [ ] **Paso 1: Escribir el test que falla**
  Agregar en `tests/onboardingSettings.test.js` las nuevas claves:
  * `extractionNotice.sessionInvalidated`
  * `extractionNotice.premiumTemporarilyBlocked`
  * `extractionNotice.requiresExportConsent`
  * `setup.consentPublicExportCheckbox`
- [ ] **Paso 2: Ejecutar test y verificar fallo**
  Comando: `rtk node --test tests/onboardingSettings.test.js`  
  Esperado: Fallo por claves faltantes en ES y EN.
- [ ] **Paso 3: Implementar código mínimo**
  Añadir traducciones simétricas en español e inglés en `src/i18n.js` explicando con claridad que el contenido premium requiere contrato/API oficial de Platzi y sin convertir consentimiento local en autoridad; las clases públicas también requieren adapter verificable.
- [ ] **Paso 4: Ejecutar test y verificar pase**
  Comando: `rtk node --test tests/onboardingSettings.test.js`  
  Esperado: PASS con todas las claves cubiertas.
- [ ] **Paso 5: Handoff de commit (Opcional)**  
  `git commit -m "feat(i18n): add consent and authorization notice keys in ES and EN"`

---

### Tarea 9: Verificación de Empaquetado y Pruebas Globales

**Archivos:**
* Verificar: `public/manifest.json`, `dist/upse-extension.zip`

- [ ] **Paso 1: Ejecutar linter completo**
  Comando: `rtk npm run lint`  
  Esperado: 0 errores y 0 advertencias (`eslint .`).
- [ ] **Paso 2: Ejecutar suite de pruebas completa**
  Comando: `rtk node --test tests/*.test.js`  
  Esperado: Todos los tests pasando (16 existentes + nuevos tests).
- [ ] **Paso 3: Compilar y empaquetar la extensión**
  Comando: `rtk npm run build:extension`  
  Esperado: Generación exitosa de `dist/upse-extension.zip`.
- [ ] **Paso 4: Verificar ausencia de credenciales en empaquetado**
  Verificar que `manifest.json` no contiene `permissions: ["cookies"]` y que ningún archivo en `dist/` referencia APIs o tokens reales.

---

## Plan de Validación y Matriz de Riesgos

### Manejo del Riesgo: Cambio Silencioso de Cuenta en el Navegador
* **Diagnóstico del Riesgo:** Dado que UPSE no cuenta con el permiso privilegiado `cookies` de Chrome (por cumplimiento estricto de las directivas de Chrome Web Store), el navegador no emite eventos automáticos hacia la extensión si el usuario cierra sesión o cambia de perfil en otra pestaña de `platzi.com`.
* **Mecanismo de Mitigación Deny-Safe:**
  1. Durante la extracción, cada respuesta HTTP es auditada por `platziClient.js`.
  2. Si Platzi devuelve un código `401 Unauthorized`, `403 Forbidden` o una redirección hacia `/login/`, el cliente asume de inmediato que la sesión es inválida.
  3. Se activa `invalidateSession()` en `authStore`, lo que revoca automáticamente todas las pruebas `AuthorizedAccessProof` en memoria.
  4. Se purga de forma inmediata el búfer en memoria (`purgeExtractedContent`) para prevenir cualquier posibilidad de que datos de una sesión anterior se mezclen o descarguen bajo otra identidad.
  5. Si el cambio de cuenta es totalmente silencioso pero ambas cuentas son válidas, la vinculación estructural con el `canonicalUrl` y el identificador de clase previene que se descargue material ajeno a la clase solicitada.

---

## Handoff de Ejecución (Execution Handoff)

Plan completo redactado y guardado en `docs/superpowers/plans/2026-10-08-class-authorization.md`.

Opciones de ejecución una vez que la revisión técnica del plan sea completada:
1. **Subagent-Driven (en esta sesión):** Despachar un subagente por cada tarea de la 1 a la 9, con revisión intermedia y verificación de tests.
2. **Parallel Session (sesión separada):** Abrir una nueva sesión dedicada utilizando `superpowers:executing-plans`.
