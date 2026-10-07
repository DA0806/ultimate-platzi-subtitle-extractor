# Ultimate Platzi Subtitle Extractor (UPSE)

## Extensión de Chrome

La versión 1.0.7 se puede empaquetar para cargarla localmente en Chrome:

```bash
npm run build:extension
```

El comando crea `dist/upse-extension.zip`. Para instalarla, descomprime ese ZIP, abre `chrome://extensions`, activa **Modo de desarrollador** y elige **Cargar descomprimida** apuntando a la carpeta descomprimida.

La extensión funciona sin ejecutar `npm run dev` ni un servidor propio. Abre UPSE en el mismo perfil del navegador que usas para Platzi. Antes de buscar o descargar VTT, UPSE exige que el HTML de la clase actual incluya la metadata SSR de Platzi con `class_is_free: true` vinculada a esa clase. Las clases marcadas como no gratuitas o con metadata desconocida se bloquean; esto no valida suscripciones ni autoriza cuentas de pago. Las peticiones usan las credenciales nativas del perfil; UPSE no lee, copia ni guarda cookies.

El flujo de extensión no solicita ni procesa pagos. Usa la herramienta con contenido y una cuenta a los que tengas derecho de acceso y respeta las condiciones de Platzi.

Desde Ajustes, **Borrar datos de UPSE** elimina solamente las preferencias de UPSE y los restos de autenticación local heredados (`platzi_session` y `platzi_settings`). No borra cookies del navegador, no cierra la sesión de Platzi, no elimina archivos TXT/ZIP exportados ni modifica el historial del navegador.

Consulta la [Política de privacidad](docs/PRIVACY_POLICY.md) y la [guía de privacidad para Chrome Web Store](docs/CHROME_WEB_STORE_PRIVACY.md). Son documentación preparada para revisión; esta versión no se ha publicado todavía en Chrome Web Store.

UPSE es una aplicación local y experimental para obtener los subtítulos de un curso o una clase de Platzi, convertirlos a texto limpio y descargarlos para lectura, búsqueda o estudio sin conexión.

La herramienta depende de la estructura HTML, las URLs de subtítulos y los controles de acceso de Platzi. No es un cliente oficial de Platzi ni un servicio alojado.

## Estado actual y rework

El árbol actual incluye un rework visual y técnico respecto a la versión original. La interfaz se reorganiza como una **Signal Console**: un workspace centrado en origen, selección, extracción y resultados. El rework también incorpora:

- tokens de diseño para colores, radios, espaciado, foco y movimiento;
- primitivas reutilizables de UI (`Button`, `Input`, `Card`, `Badge` y `Progress`);
- setup inicial de tres pasos con acceso por navegador en la extensión y cookie manual solo en el modo web local;
- skeleton de carga, estados por clase, barra de progreso persistente y avisos de pausa;
- reintentos con backoff, separación entre solicitudes, concurrencia limitada y detección de páginas de protección de Platzi;
- mejoras de teclado, foco visible, etiquetas semánticas, anuncios de estado y respeto por `prefers-reduced-motion`.

Comparación acotada a diferencias observables en el código actual:

| Antes | Rework actual |
| --- | --- |
| UI fragmentada, con estilos y controles repetidos | Workspace tipo **Signal Console**, tokenización CSS y primitivas reutilizables |
| Sin un recorrido inicial guiado | Onboarding de tres pasos, con acceso a la guía de cookie |
| Feedback concentrado en botones y estados básicos | Skeleton, estados por clase, progreso global, resultados y avisos de pausa |
| Extracción directa con manejo básico de solicitudes | Concurrencia 2, separación de 400 ms, reintentos, backoff y detección de bloqueos/respuestas temporales |
| Accesibilidad básica de controles | Skip link, labels, roles ARIA, foco visible, diálogo con Escape y movimiento reducido |

## Flujo de usuario

1. En el primer acceso, completa el setup de bienvenida, funciones y acceso. En la extensión se usa el perfil del navegador; en el modo web local la cookie manual es opcional para comenzar.
2. Pega una URL de curso o clase de Platzi (`/cursos/...` o `/clases/...`) y pulsa **Analizar URL**.
3. La extensión solicita el HTML directamente a Platzi con las credenciales nativas del perfil y solo continúa con una clase que Platzi marque explícitamente como gratuita. El modo web local usa el proxy de Vite y, si se configuró, la cookie manual, pero conserva la misma guardia de clase gratuita.
4. Selecciona las clases y el idioma (`es`, `en`, `pt`, `de`, `fr` o **Todos**).
5. Inicia la extracción. Cada clase puede quedar como `Listo`, `Sin video` o `Error`; las clases de lectura o quiz no se tratan como video.
6. Cuando termina, copia el texto o descarga un TXT o ZIP. Las clases con error pueden reintentarse después de corregir la causa o esperar a que Platzi deje de limitar las solicitudes.

## Autenticación del modo web local

Cuando se ejecuta con el servidor de desarrollo, la autenticación es **manual mediante una cookie real de sesión de Platzi**:

1. Abre `platzi.com` en el navegador con tu sesión iniciada.
2. Abre DevTools (`F12`), entra en **Network** y recarga la página.
3. Abre una solicitud HTML hacia Platzi y, en **Request Headers**, copia el valor completo del encabezado `Cookie`.
4. Pega ese valor en el panel de sesión de UPSE, durante el setup o desde el engranaje.

La cookie se guarda localmente en el navegador mediante el store persistido `platzi_session` y se envía a Platzi a través de los endpoints proxy del servidor de desarrollo. La interfaz la muestra enmascarada y la marca como **Sin validar**: guardarla no demuestra que siga activa.

El login con email y contraseña **no es operativo**. No hay un flujo real de login contra Platzi; la función de credenciales que permanece en el código es una representación mock y no debe usarse para obtener una sesión válida.

La extensión solo procesa clases que Platzi marque explícitamente como gratuitas. Una clase de pago puede seguir siendo inaccesible para UPSE aunque el perfil tenga una sesión válida, porque esta versión no dispone de una señal autoritativa para verificar sus derechos. El modo web local conserva la cookie manual para sus solicitudes, pero aplica la misma guardia.

## Instalación y scripts

Requisitos: Node.js compatible con Vite 8 (`^20.19.0` o `>=22.12.0`) y npm.

```bash
npm install
npm run dev
```

Scripts definidos en `package.json`:

| Comando | Uso |
| --- | --- |
| `npm run dev` | Inicia Vite en desarrollo, con los proxies necesarios para consultar Platzi. |
| `npm run build` | Genera la aplicación estática en `dist/`. |
| `npm run build:extension` | Compila la extensión y crea `dist/upse-extension.zip`. |
| `npm run preview` | Sirve localmente el contenido ya construido de `dist/`. |
| `npm run lint` | Ejecuta ESLint sobre el proyecto. |

Para usar el modo web local, ejecuta `npm run dev` y abre la URL local que muestre Vite, normalmente `http://localhost:5173`. Para la extensión, instala la carpeta `dist/` desempaquetada en un perfil del navegador y abre UPSE desde su icono.

### Proxy solo en desarrollo

El proxy está definido en `vite.config.js` y solo lo instala el servidor de desarrollo de Vite. Sus rutas son:

- `GET /api/platzi/<ruta>`: reenvía a `https://platzi.com/<ruta>`, conserva la cookie recibida en `x-platzi-cookie` y aplica headers de navegación.
- `GET /api/static/<ruta>`: reenvía a `https://static.platzi.com/<ruta>`.
- `GET /api/proxy?url=<URL-encoded>`: proxy genérico para los VTT; acepta `x-platzi-cookie` y `x-proxy-referer`, sigue hasta cinco redirecciones y expone headers CORS básicos.

`dist/` contiene archivos estáticos. `npm run preview` sirve esos archivos sin ejecutar `configureServer` ni `server.proxy`, por lo que el modo web local necesita `npm run dev`; la extensión empaquetada no depende de ese proxy.

## Formatos de exportación

- **Copiar TXT**: copia al portapapeles el texto unificado de las clases exportables seleccionadas.
- **Descargar TXT**: descarga un TXT unificado en el idioma seleccionado. Si se elige **Todos**, la vista unificada usa español como idioma de referencia.
- **TXT por clase**: cada tarjeta lista permite descargar su subtítulo individual cuando la extracción está lista.
- **Descargar ZIP**: incluye los subtítulos de las clases seleccionadas. Para un idioma concreto usa archivos TXT con ese idioma; con **Todos** crea carpetas por idioma. Las clases sin video se incluyen como archivos informativos.

El parser convierte VTT a texto plano eliminando cabecera, marcas de tiempo, identificadores de cue, etiquetas HTML y líneas vacías. UPSE no exporta VTT en el flujo actual.

## Arquitectura resumida

- **React 19 + Vite 8**: entrada de la aplicación, servidor de desarrollo y build.
- **`App.jsx`**: composición de setup, tutorial, workspace, selección, extracción y exportación; las vistas de setup/tutorial se resuelven mediante el hash de la URL.
- **Zustand**: el modo web local puede persistir una cookie manual y `settingsStore` persiste preferencias, tema y finalización del setup. La extensión no lee ni persiste cookies; conserva solo un marcador local de compatibilidad. El estado del curso y de los subtítulos vive en `subtitleStore` en memoria.
- **Parser**: `useCourseParser` y `courseParser.js` validan la ruta, consultan el HTML y construyen la lista de clases.
- **Acceso y extracción**: `platziAccess.js` valida el evento SSR `material-view/page-view` de la clase actual, exige `class_is_free: true` y bloquea metadata no verificable antes de encontrar o descargar VTT. `useSubtitleExtractor` y `languageDetector` comparten esa guardia; `getVtt` exige la prueba vinculada a la URL de la clase.
- **Resiliencia**: las solicitudes reintentables usan hasta dos reintentos, backoff exponencial y `Retry-After` cuando está disponible; la extracción se pausa ante bloqueos, errores temporales o límites de Platzi.
- **Exportación**: `downloader.js` usa FileSaver y JSZip; `textMerger.js` construye el TXT unificado.
- **UI**: Tailwind CSS, tokens CSS en `src/index.css`, Lucide React y primitivas en `src/components/ui/`.

## Limitaciones y dependencia de Platzi

- Platzi puede cambiar su HTML, sus rutas de cursos o la forma de publicar los subtítulos; cualquiera de esos cambios puede romper el análisis.
- Cloudflare, límites de solicitudes, respuestas `401`, `403`, `404`, `429` o errores del servidor pueden detener la extracción.
- En la extensión, Platzi puede devolver `401` o `403` si el perfil no tiene sesión o permiso para el contenido; en el modo web local, la cookie manual puede expirar o requerir que se copie de nuevo.
- La detección de idiomas se basa en nombres o rutas de VTT reconocibles y en la primera clase consultada; no garantiza que todos los idiomas estén disponibles en cada clase.
- El contenido extraído no se persiste entre recargas. Las preferencias se mantienen localmente hasta que se limpian; el modo web local también puede mantener una cookie manual. La extensión no almacena las cookies del navegador.
- No hay backend propio, login automático, validación independiente de sesión ni procesamiento de archivos subidos.

## Privacidad y uso responsable

- En la extensión, las URLs, el HTML y los VTT se solicitan desde tu navegador a Platzi; el navegador gestiona sus cookies y las envía a Platzi. UPSE no lee, copia ni guarda esos valores y no tiene backend ni telemetría propia.
- La extensión mantiene preferencias locales y limpia restos de autenticación heredados de versiones anteriores cuando corresponde. **Borrar datos de UPSE** no borra cookies del navegador ni archivos TXT/ZIP que ya exportaste.
- En el modo web local, la cookie manual sí se guarda en `platzi_session` y se envía al proxy local de Vite. No uses ese modo en un servidor expuesto.
- La hoja de estilos solicita fuentes a Google Fonts y el tutorial puede solicitar un video a Cloudinary; son recursos web ordinarios de la interfaz y sus proveedores pueden tratar metadatos ordinarios conforme a sus propias políticas.
- Usa la herramienta con tu propia cuenta, respeta los términos de Platzi, los permisos de los cursos y los derechos de autor. La extracción está pensada para uso personal, educativo y de estudio; no redistribuyas contenido protegido.

## Estructura de carpetas

```text
.
├── public/                  # favicon y recursos públicos
├── src/
│   ├── components/          # workspace, setup, sesión, listas, progreso y exportación
│   │   └── ui/              # Button, Input, Card, Badge y Progress
│   ├── hooks/               # parser, autenticación, idiomas y extracción
│   ├── store/               # estado de sesión, preferencias y subtítulos
│   ├── utils/               # parser de curso, VTT, idiomas, merge y descargas
│   ├── App.jsx              # composición principal y navegación por hash
│   ├── index.css            # tokens, temas, foco y accesibilidad de movimiento
│   └── main.jsx             # entrada React
├── vite.config.js           # configuración Vite y proxies de desarrollo
├── tailwind.config.js       # tokens y utilidades Tailwind
├── package.json             # scripts y dependencias
└── dist/                    # salida generada por npm run build
```

`dist/` solo aparece después de ejecutar el build y no incorpora el proxy de desarrollo.
