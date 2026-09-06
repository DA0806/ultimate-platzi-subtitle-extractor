import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useI18n } from '../i18n';
import { useSettingsStore } from '../store/settingsStore';

const OPTIONS = [
  { value: 'es', labelKey: 'language.spanish' },
  { value: 'en', labelKey: 'language.english' },
];

export const InterfaceLanguageSelect = ({ className = '' }) => {
  const { t } = useI18n();
  const language = useSettingsStore(state => state.uiLanguage === 'en' ? 'en' : 'es');
  const setUiLanguage = useSettingsStore(state => state.setUiLanguage);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const focusIndexRef = useRef(null);
  const listboxId = useId();
  const selectedOption = OPTIONS.find(option => option.value === language) || OPTIONS[0];

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = event => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || focusIndexRef.current === null) return;

    optionRefs.current[focusIndexRef.current]?.focus();
    focusIndexRef.current = null;
  }, [isOpen]);

  const selectLanguage = value => {
    setUiLanguage(value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const moveFocus = (index, offset) => {
    const nextIndex = (index + offset + OPTIONS.length) % OPTIONS.length;
    optionRefs.current[nextIndex]?.focus();
  };

  const handleTriggerKeyDown = event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusIndexRef.current = event.key === 'ArrowDown' ? 0 : OPTIONS.length - 1;
      setIsOpen(true);
    }
  };

  const handleOptionKeyDown = (event, index) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(index, 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(index, -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      optionRefs.current[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      optionRefs.current[OPTIONS.length - 1]?.focus();
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t('language.interface')}
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen(open => !open)}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex h-11 min-w-[96px] items-center justify-between gap-2 rounded-md border border-border/90 bg-card/80 px-3 text-left text-xs font-semibold leading-none text-foreground transition-[background-color,border-color,box-shadow,transform] duration-micro ease-motion hover:-translate-y-px hover:border-primary/50 hover:bg-card active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span>{t(selectedOption.labelKey)}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-micro ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={t('language.interface')}
          className="absolute right-0 top-full z-50 mt-2 min-w-[132px] rounded-lg border border-border/90 bg-popover p-1 shadow-[0_16px_40px_-18px_hsl(var(--black)/0.75)] animate-fade-in"
        >
          {OPTIONS.map((option, index) => {
            const isSelected = option.value === language;

            return (
              <button
                key={option.value}
                ref={element => { optionRefs.current[index] = element; }}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => selectLanguage(option.value)}
                onKeyDown={event => handleOptionKeyDown(event, index)}
                className={`flex w-full items-center justify-between gap-4 rounded-md px-3 py-2.5 text-left text-xs font-medium transition-colors duration-micro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isSelected ? 'bg-primary/10 text-primary' : 'text-popover-foreground hover:bg-accent/10 hover:text-foreground'}`}
              >
                <span>{t(option.labelKey)}</span>
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
