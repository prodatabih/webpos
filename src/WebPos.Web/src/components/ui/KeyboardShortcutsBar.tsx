import { cn } from '../../lib/utils';

export interface KeyboardShortcutItem {
  keys: string;
  label: string;
}

export const DEFAULT_DOCUMENT_SHORTCUTS: KeyboardShortcutItem[] = [
  { keys: 'Enter/Tab', label: 'Sljedeće polje / Novi red' },
  { keys: 'Insert', label: 'Novi red' },
  { keys: 'Ctrl+D', label: 'Kopiraj' },
  { keys: 'Ctrl+Del', label: 'Obriši red' },
  { keys: 'F2', label: 'Pretraga' },
  { keys: 'Ctrl+S', label: 'Snimi' },
  { keys: 'F9', label: 'Proknjiži' },
  { keys: 'Ctrl+P', label: 'Štampa' },
  { keys: 'Esc', label: 'Zatvori' },
];

export interface KeyboardShortcutsBarProps {
  items?: KeyboardShortcutItem[];
  className?: string;
}

export function KeyboardShortcutsBar({
  items = DEFAULT_DOCUMENT_SHORTCUTS,
  className,
}: KeyboardShortcutsBarProps) {
  if (items.length === 0) return null;

  return (
    <div
      role="note"
      aria-label="Prečice na tastaturi"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-border/70 bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground print:hidden',
        className
      )}
    >
      {items.map((item, idx) => (
        <span key={`${item.keys}-${item.label}`} className="inline-flex items-center gap-1.5">
          {idx > 0 && (
            <span className="text-border select-none" aria-hidden="true">
              ·
            </span>
          )}
          <kbd className="inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-foreground shadow-xs">
            {item.keys}
          </kbd>
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}
