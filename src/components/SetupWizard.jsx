import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FileText, ListChecks, Sparkles } from 'lucide-react';
import { AuthPanel } from './AuthPanel';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { InterfaceLanguageSelect } from './InterfaceLanguageSelect';
import { useI18n } from '../i18n';

export const SetupWizard = ({ step = 1, onStepChange, onOpenTutorial, onComplete }) => {
  const { t } = useI18n();
  const steps = [
    { number: 1, label: t('setup.welcome') },
    { number: 2, label: t('setup.features') },
    { number: 3, label: t('setup.cookie') },
  ];
  const stepCopy = {
    1: { eyebrow: t('setup.welcomeEyebrow'), title: t('setup.welcomeTitle'), description: t('setup.welcomeDescription'), icon: FileText },
    2: { eyebrow: t('setup.featuresEyebrow'), title: t('setup.featuresTitle'), description: t('setup.featuresDescription'), icon: ListChecks },
    3: { eyebrow: t('setup.cookieEyebrow'), title: t('setup.cookieTitle'), description: t('setup.cookieDescription'), icon: Sparkles },
  };
  const featureRows = [
    [t('setup.discoverClasses'), t('setup.discoverClassesDescription')],
    [t('setup.chooseFocus'), t('setup.chooseFocusDescription')],
    [t('setup.exportReview'), t('setup.exportReviewDescription')],
  ];
  const currentStep = Math.min(Math.max(step, 1), steps.length);
  const isLastStep = currentStep === steps.length;
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(null);
  const copy = stepCopy[currentStep];
  const StepIcon = copy.icon;

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;

    let resizeObserver;
    const frame = window.requestAnimationFrame(() => {
      setContentHeight(content.scrollHeight);
      const ResizeObserverConstructor = window.ResizeObserver;
      if (!ResizeObserverConstructor) return;
      resizeObserver = new ResizeObserverConstructor(() => setContentHeight(content.scrollHeight));
      resizeObserver.observe(content);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
    };
  }, [currentStep]);

  const goNext = () => {
    if (isLastStep) {
      onComplete();
      return;
    }
    onStepChange(currentStep + 1);
  };

  return (
    <main id="main-content" className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12 lg:px-8">
      <section className="mx-auto max-w-3xl">
        <div className="flex justify-end">
          <InterfaceLanguageSelect />
        </div>
        <div className="animate-fade-in">
          <div className="flex items-center gap-3 text-primary">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-primary/50 bg-primary/10">
              <span className="absolute h-2 w-2 animate-pulse-slow rounded-full bg-primary" aria-hidden="true" />
              <span className="sr-only">{t('setup.inProgress')}</span>
            </span>
            <p className="font-mono text-xs text-muted-foreground">{t('setup.eyebrow')}</p>
          </div>

          <nav className="mt-8" aria-label={t('setup.progress')}>
            <ol className="flex items-start">
              {steps.map((item, index) => {
                const isCompleted = item.number < currentStep;
                const isActive = item.number === currentStep;

                return (
                  <li key={item.number} className="flex min-w-0 flex-1 items-start last:flex-none">
                    <button
                      type="button"
                      onClick={() => item.number < currentStep && onStepChange(item.number)}
                      disabled={!isCompleted}
                      aria-current={isActive ? 'step' : undefined}
                      className="group flex min-w-0 items-center gap-2 text-left disabled:cursor-default"
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-xs transition-[background-color,border-color,color] duration-state ease-motion ${isActive ? 'border-primary bg-primary text-primary-foreground' : isCompleted ? 'border-success bg-success/15 text-success' : 'border-border bg-secondary text-muted-foreground'}`}>
                        {isCompleted ? <Check className="h-4 w-4" aria-hidden="true" /> : item.number}
                      </span>
                      <span className={`hidden text-xs font-medium sm:block ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</span>
                    </button>
                    {index < steps.length - 1 && <span className={`mx-2 mt-[18px] h-px flex-1 transition-colors duration-state ease-motion sm:mx-4 ${isCompleted ? 'bg-success' : 'bg-border'}`} aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        <div
          className="mt-10 overflow-hidden transition-[height] duration-reveal ease-motion"
          style={{ height: contentHeight ? `${contentHeight}px` : undefined }}
        >
          <div ref={contentRef} key={currentStep} className="animate-slide-up">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                <StepIcon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">{copy.eyebrow}</p>
                <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{copy.title}</h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{copy.description}</p>
              </div>
            </div>

            <div className="mt-8">
              {currentStep === 1 && (
                <Card className="border-primary/20 bg-card/90 p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-card-foreground">{t('setup.studySpace')}</h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('setup.studyDescription')}</p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-3">
                    {[t('setup.discover'), t('setup.select'), t('setup.review')].map((label, index) => (
                      <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-mono text-xs text-primary">{String(index + 1).padStart(2, '0')}</span>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {currentStep === 2 && (
                <Card className="border-primary/20 bg-card/90 p-5 sm:p-6">
                  <ul className="divide-y divide-border">
                    {featureRows.map(([title, description], index) => (
                      <li key={title} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                        <span className="font-mono text-xs text-primary">{String(index + 1).padStart(2, '0')}</span>
                        <div>
                          <h2 className="text-sm font-medium text-card-foreground">{title}</h2>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {currentStep === 3 && <AuthPanel isOpen embedded onOpenTutorial={onOpenTutorial} />}
            </div>
          </div>
        </div>

        <div className={`mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center ${currentStep === 1 ? 'justify-end' : 'justify-between'}`}>
          {currentStep > 1 && (
            <Button type="button" variant="ghost" onClick={() => onStepChange(currentStep - 1)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t('setup.back')}
            </Button>
          )}
          <Button type="button" onClick={goNext}>
            {currentStep === 1 ? t('setup.start') : isLastStep ? t('setup.finish') : t('setup.next')}
            {!isLastStep && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
      </section>
    </main>
  );
};
