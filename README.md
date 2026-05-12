# Ultimate Platzi Subtitle Extractor (UPSE) 🎓

UPSE es una herramienta construida con React y Vite diseñada para extraer, procesar y descargar los subtítulos completos de los cursos de Platzi. Es perfecta para quienes buscan tener transcripciones locales para leer, tomar notas o estudiar sin conexión.

## ✨ Características Principales

- **Extracción Masiva e Individual:** Descarga subtítulos de todo un curso de un tirón, o selecciona descargar el `.txt` de clases individuales.
- **Exportación en Múltiples Formatos:** 
  - Archivo de texto unificado (`.txt`) con todas las transcripciones en un solo pergamino de texto.
  - Archivo comprimido (`.zip`) con los subtítulos separados por carpetas e idiomas.
- **Respeto por la Estructura del Curso:** Detecta cuando una clase no es un video (lecturas, quizzes). Estas se mantienen en la numeración para que tus apuntes sigan perfectamente sincronizados con el índice real del curso.
- **Proxy Integrado (Anti-CORS):** Evita bloqueos de CORS en el navegador mediante el proxy de Vite que enruta limpiamente las peticiones, permitiendo descargar los archivos `.vtt` ocultos en base64 y JSON.
- **Auto-detección de Idiomas:** Detecta automáticamente los idiomas disponibles (Español, Inglés, Portugués, etc.) analizando el HTML de cada clase. Soporta tanto URLs absolutas como hashes parciales de subtítulos embebidos en el JSON de Platzi.

## 🚀 Stack Tecnológico

- **Frontend:** React 19, JavaScript
- **Estilos:** Tailwind CSS
- **Estado Global:** Zustand
- **Servidor y Build:** Vite (Configurado con proxy de desarrollo para Platzi y static.platzi.com)

## ⚙️ Cómo Inicializar el Proyecto Localmente

Sigue estos sencillos pasos para tener tu entorno local funcionando:

### 1. Pre-requisitos
- [Node.js](https://nodejs.org/) (Versión 18 o superior recomendada).
- NPM (viene con Node.js).
- Una cuenta activa de Platzi (para cursos de pago).

### 2. Instalación

Abre tu terminal, entra a la carpeta del proyecto e instala las dependencias:

```bash
# Navega al proyecto (si no estás dentro)
cd ultimate-platzi-subtitle-extractor

# Instalar los paquetes y dependencias de NPM
npm install
```

### 3. Ejecución (Modo Desarrollo)

Para levantar la aplicación y poder extraer subtítulos usando el Proxy anti-CORS en tu computadora:

```bash
npm run dev
```

Una vez que termine, la consola te mostrará una dirección local (usualmente `http://localhost:5173`). Haz click sobre ella o cópiala en tu navegador web.

> ⚠️ **Importante:** La app debe ejecutarse en modo desarrollo (`npm run dev`) para que el proxy de Vite funcione. La versión de producción (`dist/`) no incluye el proxy.

### 4. Construcción para Producción

Si deseas compilar la versión optimizada:

```bash
npm run build
```
Los archivos finales se minificarán dentro de la carpeta `dist/`.

## 🔐 Autenticación (Cookie de Sesión)

Para extraer subtítulos de **cursos de pago**, necesitas proporcionar tu cookie de sesión de Platzi. Las clases gratuitas no requieren autenticación.

### Cómo obtener tu cookie

1. Abre [platzi.com](https://platzi.com) en tu navegador e inicia sesión normalmente.
2. Presiona `F12` para abrir las herramientas de desarrollador (DevTools).
3. Ve a la pestaña **Network** (Red).
4. Recarga la página (`F5`).
5. En la lista de peticiones, haz clic en la **primera** (el documento HTML).
6. En el panel derecho, busca la sección **Request Headers**.
7. Busca el header `Cookie:` → clic derecho → **Copy value**.
8. Pega el valor en el panel de sesión de UPSE.

> ⚠️ **¿Por qué desde Network y no desde la consola?**  
> Platzi utiliza cookies `HttpOnly` y de Cloudflare (`cf_clearance`, `__cf_bm`) que **no son accesibles** mediante `document.cookie` en la consola ni desde la pestaña Application. La única forma de obtener **todas** las cookies necesarias es copiar el header `Cookie` directamente desde una petición real en la pestaña Network.

## 📖 Guía Rápida de Uso

1. Inicia la app con `npm run dev`.
2. (Opcional) Configura tu cookie de sesión haciendo clic en el ícono de cuenta.
3. Copia la URL del curso de Platzi que deseas extraer (ej. `https://platzi.com/cursos/economia-cotidiana/`).
4. Pégala en la barra de búsqueda de UPSE y presiona **Extraer**.
5. Espera a que se listen todas las clases del curso.
6. Presiona el botón de extracción para descargar los subtítulos.
7. Exporta a **TXT unificado** o **ZIP** organizado por carpetas e idiomas.

## 🏗️ Arquitectura

```
src/
├── components/       # Componentes React (AuthPanel, LanguageSelector, etc.)
├── hooks/            # Hooks personalizados
│   ├── useAuth.js              # Manejo de autenticación
│   ├── useSubtitleExtractor.js # Lógica principal de extracción de VTT
│   └── useLanguageDetect.js    # Detección automática de idiomas
├── store/            # Estado global (Zustand)
│   ├── authStore.js            # Sesión y cookies
│   ├── subtitleStore.js        # Videos, progreso, contenido extraído
│   └── settingsStore.js        # Preferencias (idioma, formato)
└── utils/            # Utilidades
    ├── courseParser.js          # Parsing del HTML de Platzi
    ├── languageDetector.js     # Detección de idiomas disponibles
    └── vttParser.js            # Parser de archivos .vtt a texto plano
```

## 📜 Legal / Licencia
Aplicación diseñada para uso local, investigativo y educativo (extracción personal para apuntes).
