# Ultimate Platzi Subtitle Extractor (UPSE) 🎓

UPSE es una herramienta construida con React y Vite diseñada para extraer, procesar y descargar los subtítulos completos de los cursos de Platzi. Es perfecta para quienes buscan tener transcripciones locales para leer, tomar notas o estudiar sin conexión.

## ✨ Características Principales

- **Extracción Masiva e Individual:** Descarga subtítulos de todo un curso de un tirón, o selecciona descargar el `.txt` de clases individuales.
- **Exportación en Múltiples Formatos:** 
  - Archivo de texto unificado (`.txt`) con todas las transcripciones en un solo pergamino de texto.
  - Archivo comprimido (`.zip`) con los subtítulos separados por carpetas e idiomas.
- **Respeto por la Estructura del Curso:** Detecta cuando una clase no es un video (lecturas, quizzes). Estas se mantienen en la numeración para que tus apuntes sigan perfectamente sincronizados con el índice real del curso.
- **Proxy Integrado (Anti-CORS):** Evita bloqueos de CORS en el navegador mediante el proxy de Vite que enruta limpiamente las peticiones, permitiendo descargar los archivos `.vtt` ocultos en base64 y JSON.
- **Auto-detección de Lenguaje:** Agrupa idiomas (Español, Inglés, etc) y hace foward al idioma requerido con fallbacks automáticos si tu idioma preferido no está disponible en esa lección.

## 🚀 Stack Tecnológico

- **Frontend:** React 19, JavaScript
- **Estilos:** Tailwind CSS
- **Estado Global:** Zustand
- **Servidor y Build:** Vite (Configurado con endpoints de proxy)

## ⚙️ Cómo Inicializar el Proyecto Localmente

Sigue estos sencillos pasos para tener tu entorno local funcionando:

### 1. Pre-requisitos
- [Node.js](https://nodejs.org/) (Versión 18 o superior recomendada).
- NPM (viene con Node.js).

### 2. Instalación

Abre tu terminal, entra a la carpeta del proyecto e instala las dependencias:

```bash
# Navega al proyecto (si no estás dentro)
cd "Ultimate Platzi Subtitle Extractor (UPSE)"

# Instalar los paquetes y dependencias de NPM
npm install
```

### 3. Ejecución (Modo Desarrollo)

Para levantar la aplicación y poder extraer subtítulos usando el Proxy anti-CORS en tu computadora:

```bash
npm run dev
```

Una vez que termine, la consola te mostrará una dirección local (usualmente `http://localhost:5173`). Haz click sobre ella o cópiala en tu navegador web.

### 4. Construcción para Producción

Si deseas compilar la versión optimizada:

```bash
npm run build
```
Los archivos finales se minificarán dentro de la carpeta `dist/`.

## 📖 Guía Rápida de Uso

1. Copia la URL del curso de Platzi que deseas extraer (ej. `https://platzi.com/cursos/ahorro-personal/`).
2. Pégala en la barra de búsqueda de UPSE.
3. Si el curso es de pago, el sistema requerirá que ingreses tu Cookie de Sesión de Platzi para poder validarte y desencriptar el contenido.
4. Presiona el botón para listar las clases, escanea todo, y finalmente expórtalo a TXT Múltiple o ZIP.

## 📜 Legal / Licencia
Aplicación diseñada para uso local, investigativo y educativo (extracción personal para apuntes).
