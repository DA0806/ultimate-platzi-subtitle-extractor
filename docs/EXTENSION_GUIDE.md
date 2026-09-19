# Guía de Instalación y Uso: Extensión de Navegador UPSE

Esta guía explica paso a paso cómo compilar, instalar, utilizar y compartir el **Ultimate Platzi Subtitle Extractor (UPSE)** como una extensión de navegador moderna (Manifest V3) basada en Chromium (Google Chrome, Brave, Microsoft Edge, Opera, etc.).

---

## 🚀 Ventajas Clave frente a una Web Tradicional

A diferencia de una aplicación web alojada en internet o un script tradicional, la extensión de navegador ofrece ventajas determinantes:

| Característica | Web Alojada Tradicional | Extensión UPSE (Manifest V3) |
| :--- | :--- | :--- |
| **Costo y Servidores** | Requiere servidores, proxies y backend con costos mensuales. | **100% gratuita y sin servidores.** Todo corre localmente en tu navegador. |
| **Protección Cloudflare** | Las IPs de servidores cloud suelen ser bloqueadas o desafiadas por Cloudflare. | **Cero bloqueos por IP.** Las peticiones salen desde tu propia conexión residencial de usuario real. |
| **Problemas de CORS** | Bloqueado por las políticas del navegador al consultar dominios externos. | **Sin bloqueos CORS.** Manifest V3 otorga permisos directos sobre los dominios de Platzi. |
| **Autenticación** | Requiere copiar y pegar manualmente cookies complejas con F12 / DevTools. | **Autenticación automática mágica.** Detecta la sesión activa de Platzi en tu navegador. |

---

## 🛠️ 1. Cómo Compilar la Extensión (Para Desarrolladores)

Si clonaste el repositorio o realizaste cambios en el código fuente, compilar la extensión toma menos de un minuto:

### Requisitos Previos
* **Node.js**: Versión 20 o superior (ej. Node 20 LTS o Node 22+).
* **npm**: Incluido con Node.js.

### Pasos de compilación

1. Abre tu terminal en la raíz del proyecto:
   ```bash
   cd "D:/Proyectos/Visual Studio Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension"
   ```

2. Instala las dependencias (solo la primera vez):
   ```bash
   npm install
   ```

3. Compila el paquete de producción:
   ```bash
   npm run build
   ```

4. **Resultado**: Se creará o actualizará la carpeta **`dist/`**.
   
   Esta carpeta contiene todo lo necesario para que el navegador ejecute la extensión:
   * `manifest.json`: Configuración y permisos de Manifest V3.
   * `background.js`: Service worker en segundo plano para abrir pestañas y gestionar cookies.
   * `index.html`: La consola de extracción en pestaña completa.
   * `assets/`: Lógica de React 19, Tailwind CSS y componentes empaquetados.
   * `icons/`: Iconos en distintas resoluciones para la barra del navegador.

---

## 🌐 2. Cómo Instalar la Extensión en tu Navegador

Puedes instalar la extensión en cualquier navegador basado en Chromium: **Google Chrome**, **Brave**, **Microsoft Edge**, **Opera** o **Vivaldi**.

### Paso a paso:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Abre chrome://extensions en la barra de direcciones       │
├─────────────────────────────────────────────────────────────┤
│ 2. Activa el interruptor [Modo de desarrollador] (arriba der)│
├─────────────────────────────────────────────────────────────┤
│ 3. Haz clic en el botón [Cargar descomprimida]              │
├─────────────────────────────────────────────────────────────┤
│ 4. Selecciona la carpeta "dist/" del proyecto               │
├─────────────────────────────────────────────────────────────┤
│ 5. ¡Listo! Fija el icono 📌 en tu barra de herramientas     │
└─────────────────────────────────────────────────────────────┘
```

### Instrucciones detalladas por navegador:

#### En Google Chrome / Brave:
1. En una nueva pestaña, escribe `chrome://extensions` (en Brave: `brave://extensions`) y presiona `Enter`.
2. En la esquina superior derecha, activa la casilla o interruptor **"Modo de desarrollador"** (*Developer mode*).
3. Aparecerán nuevos botones en la barra superior. Haz clic en **"Cargar descomprimida"** (*Load unpacked*).
4. Navega hasta el directorio del proyecto y selecciona la carpeta **`dist`**.
5. Verás la tarjeta de la extensión **Ultimate Platzi Subtitle Extractor** con su versión e icono.
6. Haz clic en el icono de pieza de rompecabezas (Extensiones) en la barra superior del navegador y pulsa el pin 📌 junto a UPSE para tenerlo siempre a mano.

#### En Microsoft Edge:
1. Escribe `edge://extensions` en la barra de direcciones.
2. En el menú lateral izquierdo, activa el interruptor **"Modo de desarrollador"**.
3. Haz clic en **"Cargar extensión sin empaquetar"**.
4. Selecciona la carpeta **`dist`** y fija el icono en la barra de herramientas.

#### En Opera / Opera GX:
1. Escribe `opera://extensions` en la barra de direcciones.
2. En la esquina superior derecha, activa **"Modo de desarrollador"**.
3. Haz clic en **"Cargar extensión descomprimida"** y selecciona la carpeta **`dist`**.

---

## 🪄 3. Cómo Usarla y Flujo de Trabajo

### Abrir la Consola
Haz clic en el icono de **UPSE** en tu barra de herramientas. La extensión abrirá automáticamente la consola de trabajo (*Signal Console*) en una **pestaña completa** dedicada, ofreciéndote todo el espacio y comodidad para trabajar. Si ya tienes la pestaña abierta, al hacer clic en el icono el navegador te llevará directamente a ella.

### Autenticación Mágica (Sin F12 ni copiar cookies)
* Si ya iniciaste sesión en tu cuenta de Platzi (`platzi.com`) en ese mismo navegador, **UPSE detectará tu sesión de forma 100% automática y silenciosa**.
* En la esquina superior derecha verás el indicador verde activo:
  > 🟢 **Sesión Platzi activa** *(detectada automáticamente)*
* No necesitas abrir las herramientas de desarrollador (F12), ni inspeccionar solicitudes de red, ni copiar encabezados `Cookie`.
* **Fallback manual**: Si por alguna razón usas perfiles separados o la sesión no se detecta, siempre puedes ingresar a la configuración (icono de engranaje ⚙️) y pegar la cookie manualmente como respaldo.

### Extracción de Subtítulos Paso a Paso

1. **Ingresa la URL**:
   * Copia el enlace del curso o clase que deseas estudiar:
     * Curso completo: `https://platzi.com/cursos/react/`
     * Clase individual: `https://platzi.com/clases/1234-nombre-clase/`
   * Pégala en el campo de origen y haz clic en **Analizar URL**.
2. **Selecciona Idioma y Clases**:
   * UPSE inspeccionará el curso y detectará automáticamente los idiomas disponibles (Español, Inglés, Portugués, etc.).
   * Selecciona si deseas un idioma en particular o **Todos**.
   * Marca o desmarca las clases que te interesen mediante las casillas de selección.
3. **Inicia la Extracción**:
   * Haz clic en **Iniciar extracción**.
   * Observa el progreso clase por clase en tiempo real. La extensión realiza las peticiones respetando pausas de cortesía y reintentos automáticos para garantizar descargas limpias.
4. **Descarga tus Subtítulos**:
   * **Descargar ZIP**: Crea un archivo `.zip` ordenado con los subtítulos de cada clase en formato `.txt`. Si seleccionaste "Todos", creará carpetas organizadas por idioma.
   * **Descargar TXT unificado**: Crea un único archivo de texto con todo el contenido del curso ordenado secuencialmente, ideal para alimentar herramientas de IA (NotebookLM, Claude, ChatGPT) o para leer sin distracciones.
   * **Copiar al portapapeles**: Para transferir rápidamente el texto a tus notas.

---

## 👥 4. Cómo Compartirla con Amigos (Sin que instalen Node.js)

Tus amigos, compañeros de estudio o colegas **NO necesitan saber programar, ni clonar repositorios con Git, ni instalar Node.js ni npm**.

Para compartirles la herramienta lista para usar:

1. **Compila la extensión en tu máquina**:
   ```bash
   npm run build
   ```
2. **Comprime la carpeta `dist/`**:
   * Haz clic derecho sobre la carpeta `dist/` y selecciona **Comprimir en archivo ZIP** (puedes nombrarlo `UPSE-extension.zip`).
3. **Envíales el archivo `.zip`** por correo, Telegram, Drive, etc.
4. **Instrucciones para tus amigos**:
   * Descomprimir el archivo `.zip` en cualquier carpeta de su computadora (por ejemplo, en `Documentos/UPSE`).
   * Abrir `chrome://extensions` en su navegador (Chrome, Brave, Edge, etc.).
   * Activar el **Modo de desarrollador**.
   * Pulsar **Cargar descomprimida** y seleccionar esa carpeta.
   * ¡Listo! Al abrir Platzi en su navegador e iniciar la extensión, tendrán su extractor personal funcionando al instante.

---

## ❓ Preguntas Frecuentes y Solución de Problemas

#### ¿Por qué algunas clases dicen "Sin video"?
En Platzi existen clases que son lecturas escritas, enlaces a artículos, resúmenes o exámenes/quizzes. Estas clases no contienen un reproductor de video con pistas VTT asociadas. UPSE las identifica claramente para que no generen falsos errores.

#### ¿Cómo actualizo la extensión cuando hay cambios en el código?
1. Vuelve a ejecutar `npm run build` en la terminal.
2. Ve a `chrome://extensions`.
3. Busca la tarjeta de UPSE y haz clic en el botón de **Recargar** (icono de flecha circular 🔄).
4. Refresca la pestaña del extractor.

#### La sesión dice "Sin sesión" a pesar de tener Platzi abierto
* Asegúrate de que la sesión esté iniciada en el mismo perfil de navegador donde instalaste la extensión.
* Visita `platzi.com` para comprobar que tu avatar y cuenta aparecen activos.
* Vuelve a la pestaña de UPSE y haz clic en el botón de refrescar sesión o recarga la pestaña (`F5`).
