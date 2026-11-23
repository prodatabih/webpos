import { useEffect, useRef } from 'react';

export interface AdvanceGridFocusParams {
  tbodyEl: HTMLElement | null;
  rowIndex: number;
  currentEl: HTMLElement | null;
  isLastRow: boolean;
  hasSelectedItem: boolean;
  onAddRow: () => void;
  onFocusNewRowPicker?: (nextRowIndex: number) => void;
}

export interface UseDocumentShortcutsOptions {
  enabled?: boolean;
  isReadOnly?: boolean;
  onSave?: () => void;
  onPost?: () => void;
  onPrint?: () => void;
  onFocusSearch?: () => void;
  onAddRow?: () => void;
  onDuplicateRow?: () => void;
  onDeleteRow?: () => void;
}

function isFocusableElement(el: HTMLElement): boolean {
  if ('disabled' in el && (el as HTMLInputElement | HTMLButtonElement).disabled) {
    return false;
  }
  if (el instanceof HTMLInputElement && el.readOnly) {
    return false;
  }
  if (el.getAttribute('aria-disabled') === 'true') {
    return false;
  }
  return el.tabIndex !== -1;
}

function focusAndSelect(el: HTMLElement): void {
  el.focus();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    requestAnimationFrame(() => {
      el.select();
    });
  }
}

function getEnabledGridCells(rowEl: Element | null): HTMLElement[] {
  if (!rowEl) return [];
  return Array.from(rowEl.querySelectorAll<HTMLElement>('[data-grid-cell="true"]')).filter(
    isFocusableElement
  );
}

/**
 * Focuses and selects the first enabled `[data-grid-cell="true"]` input in `tr[data-row-index="${rowIndex}"]`.
 */
export function focusFirstNumericCellInRow(
  tbodyEl: HTMLElement | null,
  rowIndex: number
): boolean {
  if (!tbodyEl) return false;
  const rowEl = tbodyEl.querySelector<HTMLElement>(`tr[data-row-index="${rowIndex}"]`);
  const cells = getEnabledGridCells(rowEl);
  const firstCell = cells[0];
  if (!firstCell) return false;
  focusAndSelect(firstCell);
  return true;
}

/**
 * Finds `[data-item-picker="true"]` inside `tr[data-row-index="${rowIndex}"]`, focuses it,
 * and optionally clicks it so the searchable dropdown opens immediately.
 */
export function focusItemPickerInRow(
  tbodyEl: HTMLElement | null,
  rowIndex: number,
  openPicker = true
): boolean {
  if (!tbodyEl) return false;
  const rowEl = tbodyEl.querySelector<HTMLElement>(`tr[data-row-index="${rowIndex}"]`);
  if (!rowEl) return false;
  const picker = rowEl.querySelector<HTMLElement>('[data-item-picker="true"]');
  if (!picker || !isFocusableElement(picker)) return false;

  picker.focus();
  if (openPicker) {
    picker.click();
  }
  return true;
}

/**
 * Advances keyboard focus across enabled `[data-grid-cell="true"]` inputs within the active row.
 * At the last cell of the row:
 * - If not the last row, jumps to row `rowIndex + 1`'s item picker or first grid cell.
 * - If the last row and an item is already selected, adds a new row and focuses/opens its item picker.
 */
export function advanceGridFocus({
  tbodyEl,
  rowIndex,
  currentEl,
  isLastRow,
  hasSelectedItem,
  onAddRow,
  onFocusNewRowPicker,
}: AdvanceGridFocusParams): boolean {
  if (!tbodyEl) return false;

  const rowEl = tbodyEl.querySelector<HTMLElement>(`tr[data-row-index="${rowIndex}"]`);
  const cells = getEnabledGridCells(rowEl);
  const currentIdx = currentEl ? cells.indexOf(currentEl) : -1;

  if (currentIdx >= 0 && currentIdx < cells.length - 1) {
    const nextCell = cells[currentIdx + 1];
    if (nextCell) {
      focusAndSelect(nextCell);
      return true;
    }
  }

  const nextRowIndex = rowIndex + 1;

  if (!isLastRow) {
    const nextRowEl = tbodyEl.querySelector<HTMLElement>(`tr[data-row-index="${nextRowIndex}"]`);
    if (!nextRowEl) return false;

    const nextPicker = nextRowEl.querySelector<HTMLElement>('[data-item-picker="true"]');
    if (nextPicker && isFocusableElement(nextPicker)) {
      nextPicker.focus();
      return true;
    }

    const nextRowCells = getEnabledGridCells(nextRowEl);
    const firstNextCell = nextRowCells[0];
    if (firstNextCell) {
      focusAndSelect(firstNextCell);
      return true;
    }
    return false;
  }

  if (isLastRow && hasSelectedItem) {
    onAddRow();
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (onFocusNewRowPicker) {
          onFocusNewRowPicker(nextRowIndex);
        } else {
          focusItemPickerInRow(tbodyEl, nextRowIndex, true);
        }
      }, 30);
    });
    return true;
  }

  return false;
}

/**
 * Registers keyboard-first document editor shortcuts:
 * - Ctrl+S: Save draft
 * - F9 / Ctrl+Enter: Post document
 * - Ctrl+P: Print
 * - F2: Focus quick-add / search
 * - Insert / Alt+N: Add row
 * - Ctrl+D: Duplicate active row
 * - Ctrl+Delete: Delete active row
 */
export function useDocumentShortcuts(options: UseDocumentShortcutsOptions): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const opts = optionsRef.current;
      if (opts.enabled === false) return;

      const mod = e.ctrlKey || e.metaKey;
      const keyLower = e.key.toLowerCase();
      const target = e.target as HTMLElement | null;
      const isTextarea = target instanceof HTMLTextAreaElement;

      // Ctrl+S -> Save
      if (mod && !e.altKey && !e.shiftKey && keyLower === 's') {
        if (!opts.isReadOnly && opts.onSave) {
          e.preventDefault();
          opts.onSave();
        }
        return;
      }

      // Ctrl+P -> Print (allowed even when read-only)
      if (mod && !e.altKey && !e.shiftKey && keyLower === 'p') {
        if (opts.onPrint) {
          e.preventDefault();
          opts.onPrint();
        }
        return;
      }

      // F9 or Ctrl+Enter -> Post
      if (
        (e.key === 'F9' && !mod && !e.altKey && !e.shiftKey) ||
        (mod && !e.altKey && e.key === 'Enter')
      ) {
        if (!opts.isReadOnly && opts.onPost) {
          e.preventDefault();
          opts.onPost();
        }
        return;
      }

      // F2 -> Focus search / quick-add
      if (e.key === 'F2' && !mod && !e.altKey && !e.shiftKey) {
        if (opts.onFocusSearch) {
          e.preventDefault();
          opts.onFocusSearch();
        }
        return;
      }

      // Insert or Alt+N -> Add row
      if (
        (e.key === 'Insert' && !mod && !e.altKey && !e.shiftKey && !isTextarea) ||
        (e.altKey && !mod && keyLower === 'n')
      ) {
        if (!opts.isReadOnly && opts.onAddRow) {
          e.preventDefault();
          opts.onAddRow();
        }
        return;
      }

      // Ctrl+D -> Duplicate active row
      if (mod && !e.altKey && !e.shiftKey && keyLower === 'd') {
        if (!opts.isReadOnly && opts.onDuplicateRow) {
          e.preventDefault();
          opts.onDuplicateRow();
        }
        return;
      }

      // Ctrl+Delete -> Delete active row (skip inside multi-line textareas)
      if (mod && !e.altKey && e.key === 'Delete' && !isTextarea) {
        if (!opts.isReadOnly && opts.onDeleteRow) {
          e.preventDefault();
          opts.onDeleteRow();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

/**
 * Registers F3 and Alt+N shortcuts on document/master list pages to create a new record,
 * automatically ignoring keystrokes when inside an open modal dialog or text input.
 */
export function useListNewShortcut(onCreateNew: () => void, enabled = true): void {
  const callbackRef = useRef(onCreateNew);
  callbackRef.current = onCreateNew;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) {
        return;
      }
      if (isEditableElement(e.target)) {
        return;
      }

      const isF3 = e.key === 'F3' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
      const isAltN =
        e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n';

      if (isF3 || isAltN) {
        e.preventDefault();
        callbackRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
