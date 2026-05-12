import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { X, LogOut, ChevronDown } from 'lucide-react';

export const AuthPanel = ({ isOpen, onClose }) => {
  const { login, loginWithCookie, logout, isLoading } = useAuth();
  const user = useAuthStore(state => state.user);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cookieMode, setCookieMode] = useState(false);
  const [cookieStr, setCookieStr] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login({ email, password });
    } catch (err) {
      console.error(err);
    }
  };

  const handleCookieLogin = (e) => {
    e.preventDefault();
    if (cookieStr.trim()) {
      loginWithCookie(cookieStr);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      
      <div className="fixed right-0 top-0 h-full w-80 bg-dark-800 border-l border-dark-600 shadow-2xl z-50 animate-slide-up p-6 flex flex-col gap-6 overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-neutral-100 font-semibold text-lg">Cuenta Platzi</h2>
          <button onClick={onClose} className="p-2 hover:bg-dark-700 rounded-full transition-colors text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {user ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 p-4 bg-dark-700 rounded-xl border border-dark-600">
              <img src={user.avatar} alt="Avatar" className="w-12 h-12 rounded-full bg-platzi-green/20" />
              <div>
                <h3 className="text-white font-medium">{user.name}</h3>
                <p className="text-neutral-400 text-sm">{user.email}</p>
                <div className="mt-1 inline-block bg-platzi-green/10 text-platzi-green text-xs px-2 py-0.5 rounded border border-platzi-green/20">
                  {user.plan}
                </div>
              </div>
            </div>
            
            <button 
              onClick={logout}
              className="flex items-center justify-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-neutral-400 uppercase tracking-wider mb-1 block">Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-dark-700 border border-dark-600 rounded-xl px-4 py-2.5 w-full text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-platzi-green/50 focus:border-platzi-green transition-all duration-200"
                  placeholder="tu@email.com"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 uppercase tracking-wider mb-1 block">Contraseña</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="bg-dark-700 border border-dark-600 rounded-xl px-4 py-2.5 w-full text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-platzi-green/50 focus:border-platzi-green transition-all duration-200"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={isLoading}
                className="bg-platzi-green hover:bg-platzi-green-hover text-black font-semibold rounded-xl px-4 py-2.5 transition-colors duration-200 disabled:opacity-50 mt-2"
              >
                {isLoading ? 'Conectando...' : 'Iniciar sesión'}
              </button>
            </form>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-dark-600"></div>
              <span className="flex-shrink-0 mx-4 text-neutral-500 text-sm">o</span>
              <div className="flex-grow border-t border-dark-600"></div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                type="button"
                onClick={() => setCookieMode(!cookieMode)}
                className="text-sm text-neutral-400 hover:text-white flex items-center justify-between"
              >
                <span>Pegar cookie manualmente</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${cookieMode ? 'rotate-180' : ''}`} />
              </button>
              
              {cookieMode && (
                <form onSubmit={handleCookieLogin} className="flex flex-col gap-3 animate-fade-in">
                  <div className="text-xs text-neutral-400 bg-dark-900 p-3 rounded-lg border border-dark-600">
                    <p className="mb-2">1. Abre Platzi en otra pestaña e inicia sesión.</p>
                    <p className="mb-2">2. Abre las herramientas de desarrollador (F12) &gt; Consola.</p>
                    <p className="mb-2">3. Escribe <code className="bg-dark-600 px-1 rounded text-platzi-green">copy(document.cookie)</code> y presiona Enter.</p>
                    <p>4. Pega el resultado aquí abajo:</p>
                  </div>
                  <textarea 
                    value={cookieStr}
                    onChange={e => setCookieStr(e.target.value)}
                    className="bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 w-full text-neutral-100 text-xs h-24 focus:outline-none focus:border-platzi-green transition-all resize-none"
                    placeholder="sessionid=...; csrftoken=...;"
                    required
                  />
                  <button 
                    type="submit"
                    className="bg-dark-600 hover:bg-dark-500 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors duration-200"
                  >
                    Usar cookie
                  </button>
                </form>
              )}
            </div>
            
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3 text-yellow-400/80 text-xs flex items-start gap-2 mt-auto">
              <span className="text-lg leading-none">⚠️</span>
              <p>Sin sesión activa, solo podrás extraer subtítulos de clases gratuitas del curso.</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
