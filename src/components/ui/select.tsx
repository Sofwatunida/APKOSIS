"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { DropdownPanel } from "@/components/ui/dropdown";

interface SelectOption {
  key: string;
  value: string;
  label: ReactNode;
  disabled: boolean;
}

export interface SelectProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type"> {
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  wrapperClassName?: string;
  menuClassName?: string;
  leftIcon?: ReactNode;
}

function optionText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(optionText).join("");
  if (isValidElement(node)) {
    return optionText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

function collectOptions(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as {
      value?: string | number | readonly string[];
      children?: ReactNode;
      disabled?: boolean;
    };

    if (child.type === "option") {
      const value =
        props.value === undefined ? optionText(props.children) : String(props.value);
      options.push({
        key: String(child.key ?? `${options.length}-${value}`),
        value,
        label: props.children,
        disabled: Boolean(props.disabled),
      });
      return;
    }

    if (props.children) collectOptions(props.children);
  });

  return options;
}

export function Select({
  children,
  className = "",
  wrapperClassName = "",
  menuClassName = "",
  leftIcon,
  value,
  defaultValue,
  onChange,
  disabled,
  name,
  form,
  required,
  autoFocus,
  onFocus,
  onBlur,
  onClick,
  onKeyDown,
  ...rest
}: SelectProps) {
  const listId = `${useId()}-listbox`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const options = useMemo(() => collectOptions(children), [children]);
  const enabledIndexes = useMemo(
    () => options.reduce<number[]>((acc, option, index) => {
      if (!option.disabled) acc.push(index);
      return acc;
    }, []),
    [options],
  );

  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(() => {
    if (defaultValue !== undefined) return String(defaultValue);
    const firstEnabled = enabledIndexes[0];
    return firstEnabled !== undefined ? (options[firstEnabled]?.value ?? "") : "";
  });
  const currentValue = isControlled ? String(value) : internalValue;
  const selected = options.find((option) => option.value === currentValue);
  const isPlaceholder =
    selected?.value === "" &&
    /^(pilih|belum|—|-)/i.test(optionText(selected.label).trim());

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, options.findIndex((option) => option.value === currentValue)),
  );

  const closeMenu = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const openMenu = useCallback(() => {
    const selectedIndex = options.findIndex(
      (option) => option.value === currentValue && !option.disabled,
    );
    setActiveIndex(
      selectedIndex >= 0 ? selectedIndex : Math.max(0, enabledIndexes[0] ?? 0),
    );
    setOpen(true);
  }, [options, currentValue, enabledIndexes]);

  const commit = useCallback(
    (option: SelectOption) => {
      if (option.disabled) return;
      if (!isControlled) setInternalValue(option.value);
      if (onChange) {
        const selectedIndex = options.findIndex((item) => item.value === option.value);
        const target = {
          value: option.value,
          name: name ?? "",
          selectedIndex,
          options: options.map((item) => ({
            value: item.value,
            text: optionText(item.label),
            selected: item.value === option.value,
            disabled: item.disabled,
          })),
        } as unknown as HTMLSelectElement;
        onChange({ target, currentTarget: target } as ChangeEvent<HTMLSelectElement>);
      }
      closeMenu();
    },
    [isControlled, onChange, options, name, closeMenu],
  );

  function handleClick(event: ReactMouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    if (event.defaultPrevented || disabled) return;
    if (open) closeMenu();
    else openMenu();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled || enabledIndexes.length === 0) return;

    const position = enabledIndexes.indexOf(activeIndex);
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) {
          openMenu();
          return;
        }
        const step = event.key === "ArrowDown" ? 1 : -1;
        const nextPosition =
          position < 0
            ? 0
            : (position + step + enabledIndexes.length) % enabledIndexes.length;
        setActiveIndex(enabledIndexes[nextPosition]);
        return;
      }
      case "Home":
        event.preventDefault();
        if (open) setActiveIndex(enabledIndexes[0]);
        return;
      case "End":
        event.preventDefault();
        if (open) setActiveIndex(enabledIndexes[enabledIndexes.length - 1]);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) commit(options[activeIndex]);
        else openMenu();
        return;
      case "Escape":
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          closeMenu();
        }
        return;
      case "Tab":
        if (open) setOpen(false);
        return;
    }
  }

  return (
    <div className={`select-shell ${wrapperClassName}`}>
      {leftIcon && (
        <span className="select-leading-icon" aria-hidden>
          {leftIcon}
        </span>
      )}
      <button
        {...rest}
        ref={triggerRef}
        type="button"
        role="combobox"
        autoFocus={autoFocus}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && options[activeIndex] ? `${listId}-option-${activeIndex}` : undefined
        }
        aria-required={required || undefined}
        disabled={disabled}
        className={`select-trigger ${leftIcon ? "select-trigger--with-icon" : ""} ${className}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <span className={`select-value ${isPlaceholder ? "select-value--placeholder" : ""}`}>
          {selected?.label ?? ""}
        </span>
      </button>
      <ChevronDown
        aria-hidden
        className={`select-chevron ${open ? "select-chevron--open" : ""}`}
        strokeWidth={2}
      />
      {name && <input type="hidden" name={name} value={currentValue} form={form} />}

      <DropdownPanel
        open={open}
        anchorRef={triggerRef}
        onClose={() => setOpen(false)}
        onEscape={closeMenu}
        className={menuClassName}
        role="listbox"
        id={listId}
        ariaLabel={rest["aria-label"]}
        ariaLabelledBy={rest["aria-labelledby"]}
      >
        {options.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">
            Tidak ada pilihan
          </p>
        ) : (
          options.map((option, index) => {
            const isSelected = option.value === currentValue;
            const isActive = index === activeIndex;
            return (
              <button
                key={option.key}
                id={`${listId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-active={isActive || undefined}
                disabled={option.disabled}
                tabIndex={-1}
                className={`select-option ${isSelected ? "select-option--selected" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(option)}
              >
                <span className="select-option-label">{option.label}</span>
                {isSelected && (
                  <Check aria-hidden className="select-option-check" strokeWidth={2.5} />
                )}
              </button>
            );
          })
        )}
      </DropdownPanel>
    </div>
  );
}
