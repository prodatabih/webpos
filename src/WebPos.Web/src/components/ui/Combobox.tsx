import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { t } from '../../i18n';

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  code?: string;
  barcode?: string;
  stockQty?: string | number;
  price?: string | number;
  uom?: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  label,
  placeholder,
  searchPlaceholder,
  error,
  required,
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 80);
    return options
      .filter(
        (opt) =>
          opt.label.toLowerCase().includes(q) ||
          (opt.code && opt.code.toLowerCase().includes(q)) ||
          (opt.barcode && opt.barcode.toLowerCase().includes(q)) ||
          (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
      )
      .slice(0, 80);
  }, [options, query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setHighlightedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQuery('');
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredOptions.length > 0 ? (prev + 1) % filteredOptions.length : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredOptions.length > 0
          ? (prev - 1 + filteredOptions.length) % filteredOptions.length
          : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = filteredOptions[highlightedIndex];
      if (chosen) {
        onChange(chosen.value);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative flex flex-col gap-1 w-full', className)}>
      {label && (
        <label className="text-xs font-medium text-foreground flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-destructive">*</span>}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-1.5 text-left text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
          error && 'border-destructive'
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0 flex-1">
          <span className={cn('truncate', !selectedOption && 'text-muted-foreground')}>
            {selectedOption
              ? `${selectedOption.code ? `${selectedOption.code} — ` : ''}${selectedOption.label}`
              : placeholder ?? t('common.selectOption')}
          </span>
          {selectedOption && (selectedOption.price !== undefined || selectedOption.stockQty !== undefined) && (
            <span className="text-[11px] text-muted-foreground shrink-0">
              {selectedOption.price !== undefined ? `${selectedOption.price} ${t('common.currencyKm')}` : ''}
              {selectedOption.stockQty !== undefined ? ` (${selectedOption.stockQty} ${selectedOption.uom ?? ''})` : ''}
            </span>
          )}
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground ml-2" />
      </button>

      {open && (
        <div
          onKeyDown={handleKeyDown}
          className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-center border-b border-border px-2.5 py-1.5 gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder={searchPlaceholder ?? t('common.searchPlaceholder')}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                {t('common.noResults')}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-sm px-2.5 py-1.5 text-left text-xs cursor-pointer transition-colors gap-2',
                      isHighlighted ? 'bg-accent text-accent-foreground' : 'text-foreground',
                      isSelected && 'font-semibold'
                    )}
                  >
                    <div className="flex flex-col truncate pr-2 min-w-0 flex-1">
                      <span className="truncate">
                        {opt.code ? `${opt.code} — ` : ''}{opt.label}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate">
                        {opt.barcode && <span>{t('master.barcode')}: {opt.barcode}</span>}
                        {opt.sublabel && <span>{opt.sublabel}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(opt.price !== undefined || opt.stockQty !== undefined) && (
                        <div className="text-right text-[11px]">
                          {opt.price !== undefined && (
                            <div className="font-semibold text-foreground">
                              {typeof opt.price === 'number' ? opt.price.toFixed(2) : opt.price} {t('common.currencyKm')}
                            </div>
                          )}
                          {opt.stockQty !== undefined && (
                            <div className="text-muted-foreground">
                              {opt.stockQty} {opt.uom ?? ''}
                            </div>
                          )}
                        </div>
                      )}
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
    </div>
  );
}
