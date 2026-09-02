import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Ico } from "./icons";

export function IconBtn({
  icon,
  label,
  tip,
  active,
  danger,
  large,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label?: string;
  tip?: string;
  active?: boolean;
  danger?: boolean;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${active ? "on" : ""} ${danger ? "danger" : ""} ${large ? "lg" : ""} ${label ? "with-label" : ""}`}
      title={tip || label}
      aria-label={tip || label || rest["aria-label"]}
      {...rest}
    >
      <span className="icon-btn-ico">{icon}</span>
      {label ? <span className="icon-btn-txt">{label}</span> : null}
    </button>
  );
}

export { Ico };

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      <p className="muted">{hint}</p>
      {children}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search-field">
      <span className="tree-ico">{Ico.search({})}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function Select({
  value,
  onChange,
  options,
  empty,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  empty?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {empty !== undefined && <option value="">{empty}</option>}
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
