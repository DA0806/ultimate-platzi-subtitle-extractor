import { useState } from 'react';
import { usePlayerExtractor } from '../hooks/usePlayerExtractor';
import { useSubtitleStore } from '../store/subtitleStore';
import { Button } from './ui/Button';

const playerSlug = track => `player-${String(track.trackId || 'track').replace(/[^a-z0-9_-]/gi, '-')}`;

export const PlayerSourcePanel = () => {
  const { status, tracks, page, documentId, playerRevision, authorizationNonce, error, detectPlayer, extractTrack } = usePlayerExtractor();
  const setVideos = useSubtitleStore(state => state.setVideos);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [rightsContextKey, setRightsContextKey] = useState(null);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [selectedContextKey, setSelectedContextKey] = useState(null);
  const [actionError, setActionError] = useState(null);
  const isPlatziPage = Boolean(page?.origin && /(^|\.)platzi\.com$/i.test(new URL(page.origin).hostname));
  const contextKey = `${page?.pageKey || ''}:${documentId || ''}:${playerRevision || ''}:${authorizationNonce || ''}`;
  const rightsConfirmedForContext = rightsConfirmed && rightsContextKey === contextKey && !isPlatziPage;

  const handleDetect = async () => {
    setRightsConfirmed(false);
    setRightsContextKey(null);
    setSelectedTrackId(null);
    setSelectedContextKey(null);
    setActionError(null);
    await detectPlayer();
  };

  const extract = async track => {
    setActionError(null);
    try {
      const result = await extractTrack(track, rightsConfirmedForContext);
      const id = playerSlug(track);
      const lang = result.language || 'und';
      const nextVideo = {
        id,
        slug: id,
        title: result.label || track.label || track.language || 'Pista del reproductor',
        url: `${page.origin}${page.pathname}`,
        status: 'ready',
        selected: true,
        availableLangs: [lang],
        extractedContent: { [lang]: result.text },
        cues: result.cues,
        authorizationProof: result.authorizationProof,
        provenance: result.provenance,
      };
      const currentVideos = useSubtitleStore.getState().videos;
      setVideos([...currentVideos.filter(video => video.id !== id), nextVideo]);
      setSelectedTrackId(track.trackId);
      setSelectedContextKey(contextKey);
    } catch (extractError) {
      setActionError(extractError.message);
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-primary/20 bg-card/80 p-5" aria-label="Pistas del reproductor">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-card-foreground">Pistas del reproductor</h2>
          <p className="mt-1 text-sm text-muted-foreground">Detecta pistas estándar de un reproductor HTML5 en la pestaña activa.</p>
        </div>
        <Button type="button" variant="secondary" onClick={handleDetect} loading={status === 'detecting'}>
          {status === 'detecting' ? 'Detectando…' : 'Detectar pistas'}
        </Button>
      </div>

      {status === 'available' && isPlatziPage && (
        <p className="mt-4 text-sm text-muted-foreground">Se detectaron metadatos de pistas en Platzi. La extracción local requiere una página no Platzi con derechos confirmados.</p>
      )}
      {status === 'available' && !isPlatziPage && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">{tracks.length} pista(s) detectada(s). La lectura solo ocurre después de confirmar tus derechos.</p>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input type="checkbox" checked={rightsConfirmedForContext} onChange={event => { setRightsConfirmed(event.target.checked); setRightsContextKey(event.target.checked ? contextKey : null); }} className="mt-1 h-4 w-4 accent-primary" />
            <span>Confirmo que tengo derecho a guardar y exportar una copia de estos subtítulos de la página actual.</span>
          </label>
          <div className="space-y-2">
            {tracks.map(track => (
              <div key={track.trackId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 p-3">
                <span className="text-sm text-foreground">{track.label || track.language || 'Pista sin nombre'} <span className="font-mono text-xs text-muted-foreground">{track.language || 'und'}</span></span>
                <Button type="button" size="sm" disabled={!rightsConfirmedForContext || !track.enabled || !['subtitles', 'captions'].includes(track.kind)} onClick={() => extract(track)}>
                  {selectedTrackId === track.trackId && selectedContextKey === contextKey ? 'Extraída' : !['subtitles', 'captions'].includes(track.kind) ? 'No es subtítulo' : track.enabled ? 'Extraer' : 'Activa la pista en el reproductor'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {status === 'no-video' && <p className="mt-4 text-sm text-muted-foreground">No hay un elemento de video estándar en la pestaña activa.</p>}
      {status === 'no-tracks' && <p className="mt-4 text-sm text-muted-foreground">No hay pistas textTracks cargadas. Activa los subtítulos en el reproductor y vuelve a detectar.</p>}
      {status === 'unsupported-page' && <p className="mt-4 text-sm text-muted-foreground">Esta página no está disponible para extracción local.</p>}
      {(error || actionError) && <p className="mt-4 text-sm text-destructive" role="alert">{error || actionError}</p>}
    </section>
  );
};
