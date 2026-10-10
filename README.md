# Ultimate Platzi Subtitle Extractor (UPSE)

## Extensión de Chrome

La versión 1.0.7 implementa una arquitectura de autorización cerrada por defecto basada en separación de capacidades, verificación independiente de identidad y defensas efímeras en memoria:

```bash
npm run build:extension
```

El comando crea `dist/upse-extension.zip`. Para instalarla en Chrome o Edge:
1. Descomprime ese archivo ZIP en una carpeta local.
2. Abre `chrome://extensions` (o `edge://extensions`).
3. Activa el **Modo de desarrollador**.
4. Haz clic en **Cargar descomprimida** y selecciona la carpeta descomprimida.

La extensión funciona de manera autónoma sin requerir servidores locales ni proxies externos. Abre UPSE en el mismo perfil de navegador donde usas Platzi. Las peticiones a Platzi utilizan las credenciales nativas del perfil (`credentials: 'include'`). UPSE **no lee, no copia, no intercepta ni persiste cookies ni contraseñas**.

---

## Arquitectura de Autorización y Separación de Capacidades

A diferencia de modelos binarios o basados en scraping heurístico, UPSE 1.0.7 implementa una arquitectura formal de autorización alineada con las directivas de seguridad de Manifest V3:

### 1. Modelo de Triple Permiso (`CapabilityDecision`)
Toda operación sensible de acceso y extracción requiere la verificación estricta de tres facultades independientes:
1. **`authenticated` (`authentication`):** Estado de sesión del perfil en el navegador o contexto de invitado verificado.
2. **`canView` (`viewAccess`):** Derecho de reproducción e inspección del contenido en la plataforma.
3. **`canExportSubtitles` (`subtitleExport`):** Permiso explícito de extracción y descarga de subtítulos en formatos locales (TXT/ZIP).

> [!IMPORTANT]
> Una operación sensible **solo se autoriza si los tres permisos son simultáneamente verdaderos y permitidos**. Cualquier estado `UNKNOWN` o indefinido resulta invariablemente en **DENY** (falla cerrada por defecto).

### 2. `class_is_free` no es una autoridad
- La detección del atributo SSR `class_is_free: true` solo aporta identidad pública y una defensa informativa.
- No autentica al usuario, no concede `canView` ni `canExport`, y el consentimiento local no sustituye una fuente oficial verificable.
- Un adaptador oficial futuro se construirá explícitamente fuera del contexto de la interfaz y deberá devolver los tres permisos ligados a la clase, la cuenta, la época y la expiración.

### 3. Resolución Independiente de Identidad (`ClassIdentityMetadata`)
- La identidad canónica de la clase (`courseId`, `classId`, `canonicalUrl`, `courseSlug`, `classSlug`, `title`) se valida de manera **estrictamente independiente** a partir de la estructura HTML SSR y encabezados `<h1>`.
- **Invariante arquitectónica:** Ningún flujo de datos de streams protegidos, reproductores multimedia (`movin.subtitles`) ni pistas VTT construye, infiere o valida la identidad ni los permisos de una clase.

### 4. Pruebas de Acceso Efímeras en Memoria (`AuthorizedAccessProof`)
- La autorización aprobada emite un `AuthorizedAccessProof` en memoria volátil (heap de la pestaña de la extensión).
- Cada prueba incluye: `proofId` (UUID), `classId`, `canonicalUrl`, lista blanca de URLs VTT autorizadas, `sessionEpoch` y un tiempo de vida máximo (TTL) de 10 minutos.
- El Service Worker de MV3 no retiene credenciales ni proofs; ante la suspensión, recarga de pestaña o reinicio del worker, el estado se reinicia limpiamente (fail-closed).

### 5. Ciclo de Vida, Invalidación Atómica y Purga de Memoria
- **Errores HTTP 401 / 403:** Incrementan de inmediato el `sessionEpoch` en `authStore`, invalidan todas las pruebas previas, cancelan el lote concurrente activo y ejecutan `purgeExtractedContent()` en `subtitleStore`, borrando de memoria los subtítulos extraídos para evitar mezclas entre sesiones.
- **Protección contra condiciones de carrera:** Las operaciones concurrentes (límite de 2 trabajadores) verifican el `jobEpoch` antes de consolidar datos; operaciones desactualizadas (stale) son descartadas sin sobrescribir el estado.
- **Control de tasa HTTP 429:** Suspende la extracción y respeta los encabezados `Retry-After` con retroceso exponencial.
- **Pre-flight de Exportación:** Antes de generar o guardar archivos TXT o ZIP (`downloader.js`), se valida que cada video seleccionado posea una prueba vigente no revocada y que la sesión actual no haya sido invalidada.

---

## Estado de Integración: Matriz de Soporte

| Tipo de Contenido / Escenario | Estado en UPSE | Detalle de Implementación |
| :--- | :--- | :--- |
| **Clases públicas gratuitas** | **Bloqueadas por defecto** | `class_is_free` y el consentimiento local no autorizan extracción sin adaptador oficial verificable. |
| **Cuentas registradas gratuitas** | **Bloqueadas por defecto** | `user`, `sessionStatus` y `credentials: include` no demuestran autoridad. |
| **Clases para suscriptores (Premium)** | **Pendiente de Contrato** | **Deshabilitadas y bloqueadas en producción.** Proveedor por defecto falla cerrado (`UNKNOWN` -> `DENY`). Los adaptadores de suscriptor operan únicamente en suites de pruebas unitarias locales. |
| **Extracción masiva no autorizada** | **No soportado** | Concurrencia limitada a 2 hilos, intervalo de 400 ms (`REQUEST_GAP_MS`) y detección de bloqueos WAF. |

> [!WARNING]
> **No se afirma integración premium real:** UPSE no procesa clases protegidas de pago en producción hasta contar con un acuerdo contractual formal o una especificación de API oficial provista por Platzi. Consulta el reporte detallado en [`docs/CLASS_AUTHORIZATION_REPORT.md`](docs/CLASS_AUTHORIZATION_REPORT.md).

---

## Cero Recolección y Eliminación de Rutas Heredadas

En conformidad con las directivas de la Chrome Web Store y auditorías de seguridad:
- Se eliminaron por completo las rutas de extracción manual de cookies (`Cookie`, `x-platzi-cookie`), formularios de inicio de sesión simulados y almacenamiento persistente de credenciales.
- Ni la extensión empaquetada ni el entorno de desarrollo local aceptan, copian o reenvían encabezados de cookies manuales.
- El manifiesto (`manifest.json`) no solicita el permiso `cookies`, `tabs` ni `webRequest`.

---

## Flujo de Usuario

1. **Inicio:** Al abrir UPSE, la interfaz detecta el estado de sesión del navegador (`Desconocido`, `Sin sesión activa`, `Sesión activa` o `Sesión invalidada`) ofreciendo enlaces directos a Platzi y botón de re-verificación sin formularios de credenciales.
2. **Análisis de URL:** Pega una URL de curso o clase (`https://platzi.com/cursos/...` o `/clases/...`) y pulsa **Analizar URL**.
3. **Catalogación e Identidad:** UPSE valida la identidad canónica y el temario. Toda clase queda pendiente de una fuente oficial de autorización; el estado desconocido se bloquea.
4. **Selección:** Selecciona los idiomas deseados (`es`, `en`, `pt`, `de`, `fr` o **Todos**). No existe una vía local para convertir esa selección o consentimiento en autoridad.
5. **Extracción:** La barra de progreso muestra la resolución concurrente de subtítulos con pruebas efímeras.
6. **Exportación Pre-flight:** Descarga un archivo TXT unificado o un archivo ZIP estructurado tras la verificación previa de vigencia de sesión.

---

## Instalación y Scripts

Requisitos: Node.js (`^20.19.0` o `>=22.12.0`) y npm.

```bash
npm install
npm run dev
```

Scripts disponibles:

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo Vite con proxies limpios (sin inyección de cookies manuales). |
| `npm run build` | Compila la aplicación web estática en `dist/`. |
| `npm run build:extension` | Compila la extensión MV3 y empaqueta el artefacto `dist/upse-extension.zip`. |
| `npm run preview` | Previsualiza los archivos compilados de producción. |
| `npm run lint` | Ejecuta ESLint con reglas estrictas (cero errores o advertencias). |
| `node --test tests/*.test.js` | Ejecuta la suite de pruebas unitarias y de ciclo de vida (54 pruebas locales sin red en la validación del 10 de octubre de 2026). |

---

## Documentación y Referencias

- [Reporte de Autorización y Especificación de Contrato](docs/CLASS_AUTHORIZATION_REPORT.md)
- [Política de Privacidad](docs/PRIVACY_POLICY.md)
- [Guía de Privacidad para Chrome Web Store](docs/CHROME_WEB_STORE_PRIVACY.md)
- [Especificación Técnica de Autorización](docs/superpowers/specs/2026-10-08-class-authorization-design.md)
