import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * A path or selector with a copy button.
 *
 * `sm` exists for lists of them — the audit details show up to five selectors under one
 * finding, and five full-size boxes push the next finding off the screen. Same component,
 * same behaviour, tighter box: a second hand-rolled copy button was the alternative.
 */
export function CopySnippet({ text, size = 'md' }: { text: string; size?: 'sm' | 'md' }) {
  const sm = size === 'sm';
  const [ok, setOk] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setOk(true);
      setTimeout(() => setOk(false), 1600);
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setOk(true);
      setTimeout(() => setOk(false), 1600);
    });
  }

  return (
    <div className={`flex items-center rounded-[12px] border border-ld-border-strong bg-ld-bg-2 ${
      sm ? 'gap-2 px-[10px] py-[5px] rounded-[9px]' : 'gap-3 px-4 py-[14px]'
    }`}>
      <code className={`flex-1 font-mono text-ld-accent-2 overflow-x-auto whitespace-nowrap ${
        sm ? 'text-[11.5px]' : 'text-[13px]'
      }`}>
        {text}
      </code>
      <button
        onClick={handleCopy}
        aria-label="Copy path"
        className={`${sm ? 'w-[24px] h-[24px] rounded-[6px]' : 'w-[34px] h-[34px] rounded-[8px]'} grid place-items-center shrink-0 border transition-all duration-200 ${
          ok
            ? 'text-ld-accent border-ld-accent-line bg-ld-accent-soft'
            : 'text-ld-text-3 border-ld-border bg-ld-surface hover:text-ld-accent hover:border-ld-accent-line'
        }`}
      >
        {ok
          ? <Check className={sm ? 'w-[12px] h-[12px]' : 'w-[15px] h-[15px]'} />
          : <Copy  className={sm ? 'w-[12px] h-[12px]' : 'w-[15px] h-[15px]'} />}
      </button>
    </div>
  );
}
