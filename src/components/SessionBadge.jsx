import { Star } from 'lucide-react';

export const SessionBadge = ({ user }) => {
  if (!user) {
    return (
      <div className="bg-dark-700 text-neutral-500 text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-neutral-500"></span>
        Sin sesión
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="bg-platzi-green/10 text-platzi-green text-xs px-3 py-1.5 rounded-full border border-platzi-green/20 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-platzi-green animate-pulse-slow"></span>
        Conectado
      </div>
      
      {user.plan && (
        <div className={`text-xs px-2 py-1 rounded-md border flex items-center gap-1 ${
          user.plan.includes('Expert') 
            ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' 
            : 'bg-platzi-green/10 text-platzi-green border-platzi-green/20'
        }`}>
          {user.plan.includes('Expert') && <Star className="w-3 h-3 fill-yellow-400" />}
          {user.plan}
        </div>
      )}
    </div>
  );
};
