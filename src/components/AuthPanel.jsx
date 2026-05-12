import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { X, LogOut, Cookie, CheckCircle, AlertTriangle } from 'lucide-react';

export const AuthPanel = ({ isOpen, onClose }) => {
  const { loginWithCookie, logout } = useAuth();
  const user = useAuthStore(state => state.user);
  const cookie = useAuthStore(state => state.cookie);
  
  const [cookieStr, setCookieStr] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCookieLogin = (e) => {
    e.preventDefault();
    const trimmed = cookieStr.trim();
    if (!trimmed) return;

    loginWithCookie(trimmed);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const isMockCookie = cookie && cookie.includes('mock_session_cookie');
  const hasValidCookie = cookie && !isMockCookie && cookie.length > 20;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      
      <div className="fixed right-0 top-0 h-full w-96 bg-dark-800 border-l border-dark-600 shadow-2xl z-50 animate-slide-up p-6 flex flex-col gap-6 overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-neutral-100 font-semibold text-lg">🔐 Sesión Platzi</h2>
          <button onClick={onClose} className="p-2 hover:bg-dark-700 rounded-full transition-colors text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {hasValidCookie ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 p-4 bg-dark-700 rounded-xl border border-platzi-green/30">
              <div className="w-10 h-10 rounded-full bg-platzi-green/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-platzi-green" />
              </div>
              <div>
                <h3 className="text-white font-medium">Sesión activa</h3>
                <p className="text-neutral-400 text-sm">Cookie configurada ✓</p>
              </div>
            </div>
            
            <div className="bg-dark-700 rounded-xl p-3 border border-dark-600">
              <p className="text-xs text-neutral-500 mb-1">Cookie actual:</p>
              <p className="text-xs text-neutral-300 font-mono break-all line-clamp-3">{cookie?.substring(0, 120)}...</p>
            </div>
            
            <button 
              onClick={() => { logout(); setCookieStr(''); }}
              className="flex items-center justify-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión / Cambiar cookie
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {isMockCookie && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Tienes una cookie inválida configurada. Sigue las instrucciones para obtener tu cookie real.</p>
              </div>
            )}

            <div className="bg-dark-900 rounded-xl p-4 border border-dark-600">
              <div className="flex items-center gap-2 mb-3">
                <Cookie className="w-5 h-5 text-platzi-green" />
                <h3 className="text-white font-medium text-sm">Cómo obtener tu cookie</h3>
              </div>

              <ol className="text-xs text-neutral-400 space-y-3">
                <li className="flex gap-2">
                  <span className="text-platzi-green font-bold shrink-0">1.</span>
                  <span>Abre <a href="https://platzi.com" target="_blank" rel="noreferrer" className="text-platzi-green underline">platzi.com</a> en tu navegador (logueado).</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-platzi-green font-bold shrink-0">2.</span>
                  <span>Presiona <kbd className="bg-dark-600 px-1.5 py-0.5 rounded text-neutral-200 font-mono text-[10px]">F12</kbd> para abrir DevTools.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-platzi-green font-bold shrink-0">3.</span>
                  <span>Ve a la pestaña <strong className="text-neutral-200">Network</strong> (Red).</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-platzi-green font-bold shrink-0">4.</span>
                  <span>Recarga la página (<kbd className="bg-dark-600 px-1.5 py-0.5 rounded text-neutral-200 font-mono text-[10px]">F5</kbd>).</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-platzi-green font-bold shrink-0">5.</span>
                  <span>En la lista de peticiones, haz clic en la <strong className="text-neutral-200">primera</strong> (el documento HTML, suele ser el nombre de la página).</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-platzi-green font-bold shrink-0">6.</span>
                  <span>En el panel derecho, busca la sección <strong className="text-neutral-200">Request Headers</strong>.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-platzi-green font-bold shrink-0">7.</span>
                  <span>Busca el header <code className="bg-dark-600 px-1 rounded text-platzi-green">Cookie:</code> y copia <strong className="text-neutral-200">todo su valor</strong> (clic derecho → Copy value).</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-platzi-green font-bold shrink-0">8.</span>
                  <span>Pégalo aquí abajo.</span>
                </li>
              </ol>
            </div>
            
            <form onSubmit={handleCookieLogin} className="flex flex-col gap-3">
              <textarea 
                value={cookieStr}
                onChange={e => setCookieStr(e.target.value)}
                className="bg-dark-700 border border-dark-600 rounded-xl px-3 py-2.5 w-full text-neutral-100 text-xs h-28 focus:outline-none focus:ring-2 focus:ring-platzi-green/50 focus:border-platzi-green transition-all resize-none font-mono"
                placeholder="Pega aquí tu cookie completa del header Cookie de Network..."
                required
              />
              <button 
                type="submit"
                className="bg-platzi-green hover:bg-platzi-green-hover text-black font-semibold rounded-xl px-4 py-2.5 transition-colors duration-200"
              >
                Guardar cookie
              </button>
            </form>

            {showSuccess && (
              <div className="bg-platzi-green/10 border border-platzi-green/30 rounded-xl px-4 py-3 text-platzi-green text-sm flex items-center gap-2 animate-fade-in">
                <CheckCircle className="w-4 h-4" />
                Cookie guardada correctamente
              </div>
            )}
            
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3 text-yellow-400/80 text-xs flex items-start gap-2 mt-auto">
              <span className="text-lg leading-none">⚠️</span>
              <p>Sin sesión activa, solo podrás extraer subtítulos de clases gratuitas. Los cursos de pago requieren tu cookie de sesión.</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
