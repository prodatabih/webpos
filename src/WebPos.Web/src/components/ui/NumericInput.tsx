import React, { useState, useRef, useCallback } from 'react';
import Decimal from 'decimal.js';
import { cn } from '../../lib/utils';

export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string | number;
  onChange: (value: string) => void;
  decimals?: 0 | 2 | 4;
  allowNegative?: boolean;
  min?: number;
  max?: number;
  onCommit?: (formatted: string) => void;
  onEnterKey?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onTabForward?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Parses user-entered decimal strings supporting both Bosnian comma (',') and dot ('.')
 * as decimal separators. Rejects multiple separators, invalid characters, and negative
 * numbers unless `allowNegative` is true.
 */
export function parseDecimalInput(raw: string, allowNegative = false): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replaceAll(',', '.');
  const pattern = allowNegative ? /^-?(?:\d+\.?\d*|\.\d+)$/ : /^(?:\d+\.?\d*|\.\d+)$/;
  if (!pattern.test(normalized)) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  return Object.is(parsed, -0) ? 0 : parsed;
}

/**
 * Formats a raw string or number into a canonical dot-decimal string with the requested
 * number of decimal places (ROUND_HALF_UP), clamping to optional `min` and `max` bounds.
 */
export function formatDecimalValue(
  val: string | number,
  decimals: 0 | 2 | 4 = 2,
  min?: number,
  max?: number
): string {
  let dec: Decimal;

  if (typeof val === 'number') {
    dec = Number.isFinite(val) ? new Decimal(val) : new Decimal(0);
  } else {
    const parsed = parseDecimalInput(val, true);
    if (parsed === null) {
      dec = new Decimal(0);
    } else {
      const normalized = val.trim().replaceAll(',', '.');
      const safeStr = normalized.endsWith('.') ? normalized.slice(0, -1) : normalized;
      dec = new Decimal(safeStr);
    }
  }

  if (min !== undefined && dec.lessThan(min)) {
    dec = new Decimal(min);
  }
  if (max !== undefined && dec.greaterThan(max)) {
    dec = new Decimal(max);
  }

  const rounded = dec.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  if (rounded.isZero()) {
    return new Decimal(0).toFixed(decimals);
  }
  return rounded.toFixed(decimals);
}

function normalizeLiveDotString(raw: string): string {
  const dotted = raw.replace(',', '.');
  if (dotted.startsWith('.')) return `0${dotted}`;
  if (dotted.startsWith('-.')) return `-0${dotted.slice(1)}`;
  return dotted;
}

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      value,
      onChange,
      decimals = 2,
      allowNegative = false,
      min,
      max,
      onCommit,
      onEnterKey,
      onTabForward,
      className,
      onFocus,
      onBlur,
      onKeyDown,
      inputMode = 'decimal',
      autoComplete = 'off',
      spellCheck = false,
      ...rest
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [localText, setLocalText] = useState<string>('');
    const localTextRef = useRef<string>('');

    const commitFormatted = useCallback(
      (rawText: string) => {
        const formatted = formatDecimalValue(rawText, decimals, min, max);
        localTextRef.current = formatted;
        setLocalText(formatted);
        onChange(formatted);
        onCommit?.(formatted);
        return formatted;
      },
      [decimals, min, max, onChange, onCommit]
    );

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      const initial = value === undefined || value === null ? '' : String(value);
      localTextRef.current = initial;
      setLocalText(initial);
      setIsFocused(true);

      const inputEl = e.currentTarget;
      requestAnimationFrame(() => {
        inputEl.select();
      });

      onFocus?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      const allowedPattern =
        decimals === 0
          ? allowNegative
            ? /^-?\d*$/
            : /^\d*$/
          : allowNegative
            ? /^-?\d*(?:[.,]\d*)?$/
            : /^\d*(?:[.,]\d*)?$/;

      if (!allowedPattern.test(raw)) {
        return;
      }

      localTextRef.current = raw;
      setLocalText(raw);

      if (
        raw !== '' &&
        raw !== '-' &&
        !raw.endsWith('.') &&
        !raw.endsWith(',')
      ) {
        const parsed = parseDecimalInput(raw, allowNegative);
        if (parsed !== null) {
          onChange(normalizeLiveDotString(raw));
        }
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      commitFormatted(localTextRef.current);
      setIsFocused(false);
      onBlur?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        commitFormatted(localTextRef.current);
        if (onEnterKey) {
          e.preventDefault();
          onEnterKey(e);
        }
      } else if (e.key === 'Tab' && !e.shiftKey && onTabForward) {
        commitFormatted(localTextRef.current);
        onTabForward(e);
      }

      onKeyDown?.(e);
    };

    const displayValue = isFocused
      ? localText
      : value === undefined || value === null
        ? ''
        : String(value);

    return (
      <input
        ref={ref}
        type="text"
        inputMode={inputMode}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
        value={displayValue}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex h-8 w-full rounded-md border border-input bg-card px-2 py-1 text-right text-sm tabular-nums text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...rest}
      />
    );
  }
);

NumericInput.displayName = 'NumericInput';
