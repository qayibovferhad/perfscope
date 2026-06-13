import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function CopySnippet({ text }: { text: string }) {
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
    <div className="flex items-center gap-3 px-4 py-[14px] rounded-[12px] border border-ld-border-strong bg-ld-bg-2">
      <code className="flex-1 font-mono text-[13px] text-ld-accent-2 overflow-x-auto whitespace-nowrap">
        {text}
      </code>
      <button
        onClick={handleCopy}
        aria-label="Copy path"
        className={`w-[34px] h-[34px] rounded-[8px] grid place-items-center shrink-0 border transition-all duration-200 ${
          ok
            ? 'text-ld-accent border-ld-accent-line bg-ld-accent-soft'
            : 'text-ld-text-3 border-ld-border bg-ld-surface hover:text-ld-accent hover:border-ld-accent-line'
        }`}
      >
        {ok ? <Check className="w-[15px] h-[15px]" /> : <Copy className="w-[15px] h-[15px]" />}
      </button>
    </div>
  );
}
