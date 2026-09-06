# Ultimate Platzi Subtitle Extractor (UPSE)

UPSE es una aplicación local y experimental para obtener los subtítulos de un curso o una clase de Platzi, convertirlos a texto limpio y descargarlos para lectura, búsqueda o estudio sin conexión.

La herramienta depende de la estructura HTML, las URLs de subtítulos y los controles de acceso de Platzi. No es un cliente oficial de Platzi ni un servicio alojado.

## Estado actual y rework

El árbol actual incluye un rework visual y técnico respecto a la versión original. La interfaz se reorganiza como una **Signal Console**: un workspace centrado en origen, selección, extracción y resultados. El rework también incorpora:

- tokens de diseño para colores, radios, espaciado, foco y movimiento;
- primitivas reutilizables de UI (`Button`, `Input`, `Card`, `Badge` y `Progress`);
- setup inicial de tres pasos y una guía específica para copiar la cookie;
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

1. En el primer acceso, completa el setup de bienvenida, funciones y sesión. La cookie es opcional para comenzar.
2. Pega una URL de curso o clase de Platzi (`/cursos/...` o `/clases/...`) y pulsa **Analizar URL**.
3. UPSE solicita el HTML mediante el proxy local, obtiene las clases del curso o prepara la clase individual y detecta idiomas a partir de la primera clase disponible.
4. Selecciona las clases y el idioma (`es`, `en`, `pt`, `de`, `fr` o **Todos**).
5. Inicia la extracción. Cada clase puede quedar como `Listo`, `Sin video` o `Error`; las clases de lectura o quiz no se tratan como video.
6. Cuando termina, copia el texto o descarga un TXT o ZIP. Las clases con error pueden reintentarse después de corregir la causa o esperar a que Platzi deje de limitar las solicitudes.

## Autenticación: cookie manual

La autenticación operativa es **manual mediante una cookie real de sesión de Platzi**:

1. Abre `platzi.com` en el navegador con tu sesión iniciada.
2. Abre DevTools (`F12`), entra en **Network** y recarga la página.
3. Abre una solicitud HTML hacia Platzi y, en **Request Headers**, copia el valor completo del encabezado `Cookie`.
4. Pega ese valor en el panel de sesión de UPSE, durante el setup o desde el engranaje.

La cookie se guarda localmente en el navegador mediante el store persistido `platzi_session` y se envía a Platzi a través de los endpoints proxy del servidor de desarrollo. La interfaz la muestra enmascarada y la marca como **Sin validar**: guardarla no demuestra que siga activa.

El login con email y contraseña **no es operativo**. No hay un flujo real de login contra Platzi; la función de credenciales que permanece en el código es una representación mock y no debe usarse para obtener una sesión válida.

Sin cookie, la aplicación puede funcionar con clases públicas. Para cursos de pago o recursos protegidos, normalmente se necesita una cookie vigente con acceso a esos contenidos.

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
| `npm run preview` | Sirve localmente el contenido ya construido de `dist/`. |
| `npm run lint` | Ejecuta ESLint sobre el proyecto. |

Para usar la extracción completa, ejecuta `npm run dev` y abre la URL local que muestre Vite, normalmente `http://localhost:5173`.

### Proxy solo en desarrollo

El proxy está definido en `vite.config.js` y solo lo instala el servidor de desarrollo de Vite. Sus rutas son:

- `GET /api/platzi/<ruta>`: reenvía a `https://platzi.com/<ruta>`, conserva la cookie recibida en `x-platzi-cookie` y aplica headers de navegación.
- `GET /api/static/<ruta>`: reenvía a `https://static.platzi.com/<ruta>`.
- `GET /api/proxy?url=<URL-encoded>`: proxy genérico para los VTT; acepta `x-platzi-cookie` y `x-proxy-referer`, sigue hasta cinco redirecciones y expone headers CORS básicos.

`dist/` contiene archivos estáticos y `npm run preview` sirve esos archivos sin ejecutar `configureServer` ni `server.proxy`. Por tanto, **la extracción no funciona allí automáticamente**: para este flujo debe usarse `npm run dev` o debe existir un backend/proxy externo que no forma parte del repositorio.

## Formatos de exportación

- **Copiar TXT**: copia al portapapeles el texto unificado de las clases exportables seleccionadas.
- **Descargar TXT**: descarga un TXT unificado en el idioma seleccionado. Si se elige **Todos**, la vista unificada usa español como idioma de referencia.
- **TXT por clase**: cada tarjeta lista permite descargar su subtítulo individual cuando la extracción está lista.
- **Descargar ZIP**: incluye los subtítulos de las clases seleccionadas. Para un idioma concreto usa archivos TXT con ese idioma; con **Todos** crea carpetas por idioma. Las clases sin video se incluyen como archivos informativos.

El parser convierte VTT a texto plano eliminando cabecera, marcas de tiempo, identificadores de cue, etiquetas HTML y líneas vacías. UPSE no exporta VTT en el flujo actual.

## Arquitectura resumida

- **React 19 + Vite 8**: entrada de la aplicación, servidor de desarrollo y build.
- **`App.jsx`**: composición de setup, tutorial, workspace, selección, extracción y exportación; las vistas de setup/tutorial se resuelven mediante el hash de la URL.
- **Zustand**: `authStore` persiste la cookie y `settingsStore` persiste preferencias, tema y finalización del setup. El estado del curso y de los subtítulos vive en `subtitleStore` en memoria.
- **Parser**: `useCourseParser` y `courseParser.js` validan la ruta, consultan el HTML y construyen la lista de clases.
- **Extracción**: `useSubtitleExtractor` encuentra URLs `.vtt`, infiere idiomas, descarga mediante proxy, usa `vttParser` y actualiza el estado por clase.
- **Resiliencia**: las solicitudes reintentables usan hasta dos reintentos, backoff exponencial y `Retry-After` cuando está disponible; la extracción se pausa ante bloqueos, errores temporales o límites de Platzi.
- **Exportación**: `downloader.js` usa FileSaver y JSZip; `textMerger.js` construye el TXT unificado.
- **UI**: Tailwind CSS, tokens CSS en `src/index.css`, Lucide React y primitivas en `src/components/ui/`.

## Limitaciones y dependencia de Platzi

- Platzi puede cambiar su HTML, sus rutas de cursos o la forma de publicar los subtítulos; cualquiera de esos cambios puede romper el análisis.
- Cloudflare, límites de solicitudes, respuestas `401`, `403`, `404`, `429` o errores del servidor pueden detener la extracción.
- Una cookie puede expirar, no tener permisos para el curso o requerir que se copie de nuevo desde una sesión válida.
- La detección de idiomas se basa en nombres o rutas de VTT reconocibles y en la primera clase consultada; no garantiza que todos los idiomas estén disponibles en cada clase.
- El contenido extraído no se persiste entre recargas. La cookie y las preferencias sí se mantienen localmente hasta que se desconectan o se limpian los datos del navegador.
- No hay backend propio, login automático, validación independiente de sesión ni procesamiento de archivos subidos.

## Privacidad y uso responsable

- La cookie de Platzi es un credencial de sesión. No la compartas, publiques ni la incluyas en capturas, logs o tickets.
- La aplicación guarda esa cookie en el almacenamiento local del navegador; no es un almacén cifrado. Usa el equipo y el perfil de navegador adecuados y desconéctala cuando termines.
- Las solicitudes se realizan desde tu instalación local hacia Platzi mediante el proxy de desarrollo. Revisa el código y la configuración antes de exponer el servidor en una red.
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
