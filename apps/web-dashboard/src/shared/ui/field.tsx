import { useId } from 'react';

/**
 * A labelled form control.
 *
 * Every form in the app wrote `<label>Email</label>` above an `<Input>` and left them
 * unconnected — which looks identical and is not: clicking the label does not focus the
 * field, and a screen reader announces whatever else it can find (usually the placeholder,
 * and on a field with no placeholder, nothing at all). Lighthouse caught one of these on
 * Settings; the other seventeen were the same mistake on fields that happened to have a
 * placeholder to fall back on.
 *
 * The child is a function so the wiring stays explicit and there is no cloning: `Field`
 * owns the id, the caller decides what to put it on. That matters for the Radix selects,
 * where the id belongs on the trigger rather than on an input.
 *
 *     <Field label="Email">{(id) => <Input id={id} … />}</Field>
 *
 * `hint` and `error` live here too, because a hint that is not tied to the field is read
 * out of nowhere — `aria-describedby` is what makes it part of the control.
 */
export function Field({ label, hint, error, aside, className, children }: {
  label:  string;
  /** Explanation under the field. Announced with the control, not after it. */
  hint?:  React.ReactNode;
  /** What is wrong right now. Replaces the hint while it is set. */
  error?: string;
  /** Trailing content in the label row — an "optional" chip, a character count. */
  aside?: React.ReactNode;
  className?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <label
        htmlFor={id}
        className="text-[12.5px] font-semibold text-ld-text-2 flex items-center justify-between gap-[10px]"
      >
        {label}
        {aside}
      </label>

      {/* The control is handed the id and, when there is something to say about it, the id
          of the thing saying it. */}
      <div aria-describedby={describedBy}>{children(id)}</div>

      {error
        ? <span id={`${id}-error`} className="text-[11px] px-1 text-ld-rose">{error}</span>
        : hint
          ? <span id={`${id}-hint`} className="text-[11px] px-1 text-ld-text-3">{hint}</span>
          : null}
    </div>
  );
}
