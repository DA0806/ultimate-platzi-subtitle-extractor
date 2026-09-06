import { ArrowLeft, CheckCircle2, PlayCircle, ShieldCheck } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { useI18n } from '../i18n';

const TUTORIAL_VIDEO_URL = 'https://res.cloudinary.com/x7yrsxgf/video/upload/v1788657850/tutorial_upse_v2.mp4';

export const CookieTutorial = ({ onBack, isSetupContext = false }) => {
  const tutorialVideoUrl = import.meta.env.VITE_COOKIE_TUTORIAL_URL || TUTORIAL_VIDEO_URL;
  const { t } = useI18n();
  const steps = [
    { title: t('tutorial.openPlatzi'), description: t('tutorial.openPlatziDescription') },
    { title: t('tutorial.openDevTools'), description: t('tutorial.openDevToolsDescription') },
    { title: t('tutorial.network'), description: t('tutorial.networkDescription') },
    { title: t('tutorial.request'), description: t('tutorial.requestDescription') },
    { title: t('tutorial.copyCookie'), description: t('tutorial.copyCookieDescription') },
  ];

  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:px-8">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="animate-fade-in -ml-2">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {isSetupContext ? t('tutorial.backSetup') : t('tutorial.backTool')}
      </Button>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:gap-12">
        <section className="animate-slide-up">
          <p className="font-mono text-xs text-muted-foreground">{t('tutorial.eyebrow')}</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {t('tutorial.title')}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            {t('tutorial.description')}
          </p>

          <Card className="mt-8 overflow-hidden p-0">
            <div className="relative aspect-video overflow-hidden bg-secondary">
              {tutorialVideoUrl ? (
                <video controls preload="metadata" className="h-full w-full object-cover">
                  <source src={tutorialVideoUrl} />
                  {t('tutorial.videoFallback')}
                </video>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                    <PlayCircle className="h-8 w-8" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">{t('tutorial.comingSoon')}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('tutorial.watchProcess')}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 border-t border-border px-4 py-3 sm:px-5">
              <PlayCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{t('tutorial.caption')}</p>
            </div>
          </Card>
        </section>

        <aside className="animate-slide-up lg:pt-12" style={{ animationDelay: '80ms' }}>
          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-3 border-b border-border pb-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-semibold text-card-foreground">{t('tutorial.quickSteps')}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{t('tutorial.once')}</p>
              </div>
            </div>

            <ol className="mt-5 space-y-5">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="font-mono text-xs text-primary">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="text-sm font-medium text-card-foreground">{step.title}</h3>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <div className="mt-4 flex items-start gap-3 rounded-lg border border-warning/20 bg-warning/5 p-4 text-sm leading-6 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <p>
              {t('tutorial.videoSecurity')}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
};
