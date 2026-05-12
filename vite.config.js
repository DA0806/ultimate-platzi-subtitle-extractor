import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https'
import http from 'http'

const MAX_REDIRECTS = 5;

const fetchWithRedirects = (targetUrl, headers, onResponse, onError, redirectCount = 0) => {
  const client = targetUrl.startsWith('https') ? https : http;

  const req = client.get(targetUrl, { headers }, (proxyRes) => {
    const statusCode = proxyRes.statusCode || 200;
    const location = proxyRes.headers.location;
    const isRedirect = statusCode >= 300 && statusCode < 400 && location;

    if (isRedirect && redirectCount < MAX_REDIRECTS) {
      const redirectedUrl = new URL(location, targetUrl).toString();
      proxyRes.resume();
      fetchWithRedirects(redirectedUrl, headers, onResponse, onError, redirectCount + 1);
      return;
    }

    onResponse(proxyRes, statusCode);
  });

  req.on('error', onError);
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'cors-proxy-middleware',
      configureServer(server) {
        server.middlewares.use('/api/proxy', (req, res) => {
          const targetUrl = new URL(req.url, 'http://localhost').searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.end('Missing url parameter');
            return;
          }

          const requestHeaders = {
            'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
          };

          if (req.headers['x-platzi-cookie']) {
            requestHeaders.Cookie = req.headers['x-platzi-cookie'];
          }
          if (req.headers['x-proxy-referer']) {
            requestHeaders.Referer = req.headers['x-proxy-referer'];
          }

          fetchWithRedirects(
            targetUrl,
            requestHeaders,
            (proxyRes, statusCode) => {
            res.statusCode = statusCode;
            // Set CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            
            // Forward headers
            Object.keys(proxyRes.headers).forEach(key => {
              // Evita inconsistencias si cambia longitud tras redirecciones/chunking
              if (key.toLowerCase() === 'content-length') return;
              res.setHeader(key, proxyRes.headers[key]);
            });

            proxyRes.pipe(res);
            },
            (err) => {
            console.error('Proxy error:', err);
            res.statusCode = 500;
            res.end('Proxy error');
            }
          );
        });
      }
    }
  ],
  server: {
    proxy: {
      '/api/platzi': {
        target: 'https://platzi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/platzi/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            if (req.headers['x-platzi-cookie']) {
              proxyReq.setHeader('Cookie', req.headers['x-platzi-cookie']);
            }
          });
        }
      },
      '/api/static': {
        target: 'https://static.platzi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/static/, '')
      }
    }
  }
})
