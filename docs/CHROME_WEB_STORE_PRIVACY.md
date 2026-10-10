# Guía Preparada para la Privacidad de Chrome Web Store

**Producto:** UPSE 1.0.7
**Fecha de preparación:** 10 de octubre de 2026
**Estado:** Documento técnico de apoyo para el Chrome Web Store Developer Dashboard.

Esta guía reúne las declaraciones factuales correspondientes a la versión 1.0.7 con arquitectura de autorización corregida y modelo de triple permiso.

---

## 1. Propósito Único (Single Purpose)

**Declaración oficial:**
Permitir que un usuario con autorización oficial verificable extraiga y descargue transcripciones en texto plano (TXT o ZIP) de una clase de Platzi con fines de estudio personal, búsqueda y accesibilidad. La versión actual permanece cerrada por defecto porque no existe ese adaptador oficial.

La extensión no ofrece cuentas propias, publicidad, pagos ni almacenamiento en la nube. Las clases para suscriptores o de estado no verificable permanecen bloqueadas de forma preventiva en producción (falla cerrada).

---

## 2. Permisos y Justificación de Red

| Permiso o Host | Justificación Factual |
| :--- | :--- |
| `https://platzi.com/*` | Solicitar el HTML de cursos y clases introducidos por el usuario para resolver la identidad canónica y el temario. |
| `https://www.platzi.com/*` | Compatibilidad con la variante `www` de los enlaces de la plataforma. |
| `https://static.platzi.com/*` | Descarga directa de archivos WebVTT solo después de una decisión oficial vigente y una prueba efímera en memoria (`AuthorizedAccessProof`). |
| `permissions: []` | La extensión no solicita `cookies`, `tabs`, `webRequest`, `storage` privilegiado ni permisos de segundo plano. |

---

## 3. Código Remoto (Remote Code)

**Código remoto: NO.**
Todo el código JavaScript, componentes React y estilos CSS están empaquetados localmente dentro de `dist/`. No se cargan scripts externos, no se usa `eval()` ni se inyecta código dinámico desde servidores remotos. Las referencias a fuentes de Google Fonts y video explicativo de Cloudinary son recursos estáticos de interfaz de usuario.

---

## 4. Declaración en el Formulario de Prácticas de Privacidad

| Categoría en Dashboard | Declaración | Justificación Detallada |
| :--- | :---: | :--- |
| **Website content** | **Sí** | Se procesan en memoria el HTML de Platzi y los subtítulos VTT de las clases solicitadas para generar los textos limpios. |
| **Web history** | **Sí (Limitado)** | Únicamente las URLs de cursos/clases introducidas manualmente por el usuario. No se monitorea ni se lee el historial general del navegador. |
| **Authentication information** | **Sí (Declaración Conservadora)** | La extensión realiza peticiones con `credentials: 'include'` para que el navegador resuelva con el perfil activo. UPSE **no lee, no extrae, no copia ni almacena cookies ni tokens**. |
| **Personal communications** | **No** | No hay chats, foros ni intercambio de mensajería. |
| **Personal information** | **No** | UPSE no recopila perfiles, nombres, correos ni datos de cuenta. |
| **Financial and payment data** | **No** | La extensión no procesa pagos, suscripciones ni tarjetas. |
| **User activity and analytics** | **No** | Cero telemetría, métricas de uso o seguimiento analítico. |

---

## 5. Compromiso de Uso Limitado (Limited Use)

UPSE 1.0.7 se diseñó para seguir las directivas de Limited Use de Google Chrome; la revisión y decisión final de la Chrome Web Store siguen fuera del alcance de este repositorio:
1. **Prohibición de venta:** Ningún dato se comercializa ni transfiere a corredores de datos.
2. **Uso restringido al propósito central:** Los contenidos solicitados se procesan exclusivamente para generar las transcripciones solicitadas por el usuario.
3. **Sin publicidad personalizada ni perfiles de crédito:** La extensión carece de modelos publicitarios o evaluación de usuarios.

---

## 6. Fuentes Oficiales

- [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data/)
- [Chrome Web Store User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Chrome Extensions Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Platzi Términos de Servicio](https://platzi.com/terminos/)
- [Platzi Centro de Ayuda](https://platzi.com/ayuda/)
