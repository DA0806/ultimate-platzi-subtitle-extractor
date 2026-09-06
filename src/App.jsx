import { useEffect, useState } from 'react';
import { ArrowRight, FileText, Play, ShieldCheck } from 'lucide-react';
import { useSettingsStore } from './store/settingsStore';
import { useSubtitleStore } from './store/subtitleStore';
import { useSubtitleExtractor } from './hooks/useSubtitleExtractor';
import { Header } from './components/Header';
import { UrlInput } from './components/UrlInput';
import { LanguageSelector } from './components/LanguageSelector';
import { VideoList } from './components/VideoList';
import { ProgressBar } from './components/ProgressBar';
import { ExportPanel } from './components/ExportPanel';
import { CookieTutorial } from './components/CookieTutorial';
import { SetupWizard } from './components/SetupWizard';
import { CourseWorkspaceSkeleton } from './components/CourseWorkspaceSkeleton';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { useI18n } from './i18n';

const COOKIE_TUTORIAL_HASH = '#cookie-tutorial';
const SETUP_HASH = '#setup';

const getRoute = () => {
  const hash = window.location.hash;

  if (hash.startsWith(COOKIE_TUTORIAL_HASH)) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    return {
      view: 'tutorial',
      context: params.get('context') === 'setup' ? 'setup' : 'tool',
    };
  }

  if (hash.startsWith(SETUP_HASH)) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const parsedStep = Number(params.get('step'));
    return {
      view: 'setup',
      context: params.get('context') || 'setup',
      step: Number.isInteger(parsedStep) && parsedStep >= 1 && parsedStep <= 3 ? parsedStep : 1,
    };
  }

  return { view: 'workspace', context: 'tool' };
};

const setupHash = step => `${SETUP_HASH}?step=${step}&context=setup`;

function App() {
  const [route, setRoute] = useState(getRoute);
  const [isCourseLoading, setIsCourseLoading] = useState(false);
  const theme = useSettingsStore(state => state.theme);
  const { t } = useI18n();
  const hasCompletedSetup = useSettingsStore(state => state.hasCompletedSetup);
  const completeSetup = useSettingsStore(state => state.completeSetup);
  const { videos, isExtracting } = useSubtitleStore();
  const { extractSubtitles } = useSubtitleExtractor();
  const selectedVideos = videos.filter(video => video.selected);
  const canExtract =
    selectedVideos.length > 0 &&
    !isExtracting &&
    !selectedVideos.every(video => video.status === 'ready' || video.status === 'error');

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(getRoute());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!hasCompletedSetup && route.view === 'workspace') {
      window.location.hash = setupHash(1);
    }
  }, [hasCompletedSetup, route.view]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme !== 'dark');
  }, [theme]);

  const navigateToTutorial = (context = 'tool') => {
    const nextHash = context === 'setup' ? `${COOKIE_TUTORIAL_HASH}?context=setup` : COOKIE_TUTORIAL_HASH;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  };

  const navigateToSetup = step => {
    const nextHash = setupHash(step);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  };

  const navigateToWorkspace = () => {
    if (window.location.hash) {
      window.location.hash = '';
    }
  };

  if (route.view === 'tutorial') {
    return (
      <div className="min-h-screen overflow-x-hidden bg-background text-foreground transition-colors duration-state ease-motion">
        <Header onNavigateToTutorial={() => navigateToTutorial(route.context)} />
        <CookieTutorial
          onBack={route.context === 'setup' ? () => navigateToSetup(3) : navigateToWorkspace}
          isSetupContext={route.context === 'setup'}
        />
      </div>
    );
  }

  if (!hasCompletedSetup || route.view === 'setup') {
    return (
      <div className="min-h-screen overflow-x-hidden bg-background text-foreground transition-colors duration-state ease-motion">
        <SetupWizard
          step={route.step || 1}
          onStepChange={navigateToSetup}
          onOpenTutorial={() => navigateToTutorial('setup')}
          onComplete={() => {
            completeSetup();
            navigateToWorkspace();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground transition-colors duration-state ease-motion">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[60] rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {t('app.skipContent')}
      </a>

      <Header onNavigateToTutorial={navigateToTutorial} />
      <ProgressBar />

      <main id="main-content" className="mx-auto w-full max-w-6xl px-4 pb-56 pt-8 sm:px-6 sm:pb-48 sm:pt-12 lg:px-8">
        <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)] lg:gap-12">
          <div className="animate-fade-in pt-2" style={{ animationDelay: '40ms' }}>
            <p className="font-mono text-xs text-muted-foreground">{t('app.heroEyebrow')}</p>
            <h2 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {t('app.heroTitle')}
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
              {t('app.heroDescription')}
            </p>

            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3 border-y border-border py-5">
              {[
                ['01', t('app.stepCourse')],
                ['02', t('app.stepLanguage')],
                ['03', t('app.stepSubtitles')],
              ].map(([step, label]) => (
                <div key={step} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-mono text-xs text-primary">{step}</span>
                  <ArrowRight className="hidden h-3.5 w-3.5 text-border sm:block" aria-hidden="true" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <Card className="animate-slide-up border-primary/20 bg-card/90 p-6 sm:p-7" style={{ animationDelay: '90ms' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-primary">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  <span className="font-mono text-xs">{t('app.sourceEyebrow')}</span>
                </div>
                <h1 className="mt-3 text-xl font-semibold text-card-foreground">{t('app.sourceTitle')}</h1>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  {t('app.sourceDescription')}
                </p>
              </div>
              <div className="hidden h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary sm:flex">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>

            <div className="mt-6">
              <UrlInput onLoadingChange={setIsCourseLoading} />
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-md border border-warning/20 bg-warning/5 p-3 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <p>{t('app.localWarning')}</p>
            </div>
          </Card>
        </section>

        {isCourseLoading ? (
          <CourseWorkspaceSkeleton />
        ) : videos.length > 0 && (
          <section className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]" aria-label={t('app.workspaceLabel')}>
            <div className="min-w-0">
              <VideoList />
            </div>

            <aside className="lg:sticky lg:top-24">
              <Card className="border-border/80 p-5">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-card-foreground">{t('app.prepareExtraction')}</h2>
                    <p className="text-xs text-muted-foreground">{t('app.selectedCount', { count: selectedVideos.length })}</p>
                  </div>
                </div>

                <LanguageSelector />

                <div className="mt-6 border-t border-border pt-5">
                  <div className="mb-4 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('app.chosenClasses')}</span>
                    <span className="font-mono text-foreground">{selectedVideos.length}/{videos.length}</span>
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={extractSubtitles}
                    disabled={!canExtract}
                    loading={isExtracting}
                  >
                    {!isExtracting && <Play className="h-4 w-4 fill-current" aria-hidden="true" />}
                    {isExtracting ? t('app.processing') : t('app.startExtraction')}
                  </Button>
                </div>
              </Card>
            </aside>
          </section>
        )}
      </main>

      <ExportPanel />
    </div>
  );
}

export default App;
