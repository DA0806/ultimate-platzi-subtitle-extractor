import { Card } from './ui/Card';
import { useI18n } from '../i18n';

const resultRows = ['w-3/5', 'w-2/3', 'w-1/2', 'w-3/5'];

const SkeletonBlock = ({ className = '', pill = false }) => (
  <div aria-hidden="true" className={`${pill ? 'rounded-full' : 'rounded-md'} bg-secondary/80 ${className}`} />
);

export const CourseWorkspaceSkeleton = () => {
  const { t } = useI18n();

  return (
    <section
      className="mt-10 grid items-start gap-6 animate-fade-in lg:grid-cols-[minmax(0,1fr)_280px]"
      aria-busy="true"
      aria-label={t('skeleton.ariaLabel')}
      role="status"
    >
      <p className="sr-only">{t('skeleton.description')}</p>

    <Card className="rounded-2xl border-primary/10 bg-card/80 p-2 sm:p-3">
      <div aria-hidden="true" className="animate-pulse">
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/30 p-4 sm:p-5">
          <SkeletonBlock className="h-9 w-9 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBlock className="h-4 w-2/5" />
            <SkeletonBlock className="h-3 w-1/4" />
          </div>
          <SkeletonBlock className="hidden h-8 w-28 sm:block" />
        </div>

        <div className="mt-2 space-y-2">
          {resultRows.map((width, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card/70 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
              <SkeletonBlock className="h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBlock className={`h-4 ${width}`} />
                <SkeletonBlock className="h-3 w-20" />
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <SkeletonBlock pill className="h-7 w-12" />
                <SkeletonBlock pill className="h-7 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>

    <aside className="lg:sticky lg:top-24">
      <Card className="p-5">
        <div aria-hidden="true" className="animate-pulse">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <SkeletonBlock className="h-9 w-9 shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-3/5" />
              <SkeletonBlock className="h-3 w-2/5" />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <SkeletonBlock className="h-3 w-2/5" />
            <SkeletonBlock className="h-3 w-3/5" />
            <div className="flex gap-2">
              <SkeletonBlock className="h-11 w-20" />
              <SkeletonBlock className="h-11 w-20" />
              <SkeletonBlock className="h-11 w-16" />
            </div>
          </div>

          <div className="mt-6 space-y-3 border-t border-border pt-5">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-3 w-2/5" />
              <SkeletonBlock className="h-3 w-10" />
            </div>
            <SkeletonBlock className="h-11 w-full" />
          </div>
        </div>
      </Card>
    </aside>
    </section>
  );
};
