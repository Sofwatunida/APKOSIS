"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
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
import { Check, ChevronDown, Search } from "lucide-react";
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
  searchable?: boolean;
  searchPlaceholder?: string;
  searchEmptyLabel?: string;
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
  searchable = false,
  searchPlaceholder = "Cari...",
  searchEmptyLabel = "Tidak ada hasil",
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

  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const shownOptions = useMemo(() => {
    if (!searchable || !normalizedQuery) return options;
    return options.filter((option) =>
      optionText(option.label).toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [options, searchable, normalizedQuery]);
  const shownEnabledIndexes = useMemo(
    () =>
      shownOptions.reduce<number[]>((acc, option, index) => {
        if (!option.disabled) acc.push(index);
        return acc;
      }, []),
    [shownOptions],
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

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }, []);

  const openMenu = useCallback(() => {
    const selectedIndex = options.findIndex(
      (option) => option.value === currentValue && !option.disabled,
    );
    setQuery("");
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
    if (event.defaultPrevented || disabled || shownEnabledIndexes.length === 0) return;

    const position = shownEnabledIndexes.indexOf(activeIndex);
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
            : (position + step + shownEnabledIndexes.length) % shownEnabledIndexes.length;
        setActiveIndex(shownEnabledIndexes[nextPosition]);
        return;
      }
      case "Home":
        event.preventDefault();
        if (open) setActiveIndex(shownEnabledIndexes[0]);
        return;
      case "End":
        event.preventDefault();
        if (open) setActiveIndex(shownEnabledIndexes[shownEnabledIndexes.length - 1]);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) {
          const option = shownOptions[activeIndex];
          if (option) commit(option);
        } else openMenu();
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

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (shownEnabledIndexes.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const position = shownEnabledIndexes.indexOf(activeIndex);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const nextPosition =
        position < 0
          ? 0
          : (position + step + shownEnabledIndexes.length) % shownEnabledIndexes.length;
      setActiveIndex(shownEnabledIndexes[nextPosition]);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = shownOptions[activeIndex];
      if (option && !option.disabled) commit(option);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  const optionList =
    shownOptions.length === 0 ? (
      <p className="select-empty">
        {searchable && normalizedQuery ? searchEmptyLabel : "Tidak ada pilihan"}
      </p>
    ) : (
      shownOptions.map((option, index) => {
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
    );

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
        aria-controls={searchable ? `${listId}-options` : listId}
        aria-activedescendant={
          open && shownOptions[activeIndex] ? `${listId}-option-${activeIndex}` : undefined
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
        onClose={() => {
          setOpen(false);
          setQuery("");
        }}
        onEscape={closeMenu}
        className={menuClassName}
        role={searchable ? "dialog" : "listbox"}
        id={listId}
        ariaLabel={rest["aria-label"]}
        ariaLabelledBy={rest["aria-labelledby"]}
      >
        {searchable && (
          <div className="select-search">
            <Search aria-hidden className="select-search-icon" strokeWidth={2} />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              autoComplete="off"
              className="select-search-input"
            />
          </div>
        )}
        {searchable ? (
          <div id={`${listId}-options`} role="listbox" className="select-options-scroll">
            {optionList}
          </div>
        ) : (
          optionList
        )}
      </DropdownPanel>
    </div>
  );
}
