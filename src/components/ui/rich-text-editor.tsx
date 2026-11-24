"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Select } from "@/components/ui/form";
import { Bold, Italic, Strikethrough, List, ListOrdered } from "lucide-react";


type Heading = "p" | "h1" | "h2" | "h3";

function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const allowed = new Set(["P", "H1", "H2", "H3", "UL", "OL", "LI", "STRONG", "B", "EM", "I", "S", "STRIKE", "DEL", "BR", "DIV"]);
  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (!allowed.has(el.tagName)) {
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
        return;
      }
      [...el.attributes].forEach((a) => el.removeAttribute(a.name));
    }
    [...node.childNodes].forEach(walk);
  };
  [...doc.body.childNodes].forEach(walk);
  return doc.body.innerHTML;
}

function isEmptyHtml(html: string) {
  const text = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  return text.length === 0;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(value);
  const [active, setActive] = useState({ bold: false, italic: false, strike: false, ul: false, ol: false, block: "p" as Heading });
  const [empty, setEmpty] = useState(() => isEmptyHtml(value || ""));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value !== last.current && value !== el.innerHTML) {
      el.innerHTML = value || "";
      last.current = value || "";
    }
    setEmpty(isEmptyHtml(el.innerHTML));
  }, [value]);

  const refresh = useCallback(() => {
    try {
      const b = document.queryCommandValue("formatBlock").toLowerCase();
      const block: Heading = b === "h1" ? "h1" : b === "h2" ? "h2" : b === "h3" ? "h3" : "p";
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        strike: document.queryCommandState("strikeThrough"),
        ul: document.queryCommandState("insertUnorderedList"),
        ol: document.queryCommandState("insertOrderedList"),
        block,
      });
    } catch {}
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refresh);
    return () => document.removeEventListener("selectionchange", refresh);
  }, [refresh]);

  function emit() {
    const el = ref.current;
    if (!el) return;
    const clean = sanitizeHtml(el.innerHTML);
    const out = isEmptyHtml(clean) ? "" : clean;
    last.current = out;
    setEmpty(isEmptyHtml(el.innerHTML));
    onChange(out);
    refresh();
  }

  function cmd(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  }

  function setBlock(tag: Heading) {
    ref.current?.focus();
    document.execCommand("formatBlock", false, tag === "p" ? "P" : tag.toUpperCase());
    emit();
  }

  const baseBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-slate-300 dark:hover:bg-slate-700/70 dark:hover:text-white";
  const activeBtn = "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white transition-shadow focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-900 dark:focus-within:border-brand-500 dark:focus-within:ring-brand-500/20">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/60">
        <Select
          wrapperClassName="w-auto"
          className="h-8 w-auto rounded-[10px] px-2.5 py-0 pr-8 text-xs font-medium"
          value={active.block}
          onChange={(e) => setBlock(e.target.value as Heading)}
          aria-label="Heading"
        >
          <option value="p">Normal Text</option>
          <option value="h1">H1</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
        </Select>


        <div className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />

        <div className="flex items-center gap-0.5">
          <button type="button" className={`${baseBtn} ${active.ul ? activeBtn : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertUnorderedList")} title="Bulleted List" aria-label="Bulleted List" aria-pressed={active.ul}>
            <List className="h-4 w-4" />
          </button>
          <button type="button" className={`${baseBtn} ${active.ol ? activeBtn : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertOrderedList")} title="Numbered List" aria-label="Numbered List" aria-pressed={active.ol}>
            <ListOrdered className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />

        <div className="flex items-center gap-0.5">
          <button type="button" className={`${baseBtn} ${active.bold ? activeBtn : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("bold")} title="Bold" aria-label="Bold" aria-pressed={active.bold}>
            <Bold className="h-4 w-4" />
          </button>
          <button type="button" className={`${baseBtn} ${active.italic ? activeBtn : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("italic")} title="Italic" aria-label="Italic" aria-pressed={active.italic}>
            <Italic className="h-4 w-4" />
          </button>
          <button type="button" className={`${baseBtn} ${active.strike ? activeBtn : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("strikeThrough")} title="Strikethrough" aria-label="Strikethrough" aria-pressed={active.strike}>
            <Strikethrough className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative">
        {empty && placeholder && (
          <div className="pointer-events-none absolute left-4 top-3 text-sm text-slate-400 dark:text-slate-500">{placeholder}</div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onKeyUp={() => {
            if (ref.current) setEmpty(isEmptyHtml(ref.current.innerHTML));
            refresh();
          }}
          onMouseUp={refresh}
          className="min-h-[180px] w-full px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none dark:text-slate-100 [&_h1]:my-2 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:my-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:my-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_p]:my-1"
        />
      </div>
    </div>
  );
}

export function RichTextContent({ html, className = "" }: { html: string; className?: string }) {
  const clean = sanitizeHtml(html);
  if (isEmptyHtml(clean)) return null;
  return (
    <div
      className={`prose prose-sm max-w-none text-slate-600 dark:text-slate-400 [&_h1]:my-1 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-slate-900 dark:[&_h1]:text-white [&_h2]:my-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-white [&_h3]:my-1 [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_p]:my-1 ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

export function htmlToPlainText(html: string): string {
  const clean = sanitizeHtml(html);
  if (typeof window === "undefined") return clean.replace(/<[^>]*>/g, " ");
  const doc = new DOMParser().parseFromString(clean, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}
