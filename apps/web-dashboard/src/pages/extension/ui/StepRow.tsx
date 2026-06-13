import type React from 'react';

interface Props {
  n:      number;
  title:  string;
  body:   React.ReactNode;
  isLast: boolean;
}

export function StepRow({ n, title, body, isLast }: Props) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-[30px] h-[30px] rounded-full grid place-items-center text-[13px] font-semibold font-mono shrink-0 z-[1] border border-ld-accent-line bg-ld-accent-soft text-ld-accent-2">
          {n}
        </div>
        {!isLast && <div className="w-px flex-1 min-h-5 mt-1 bg-ld-border-strong" />}
      </div>

      <div className={!isLast ? 'pb-[22px]' : ''}>
        <h4 className="text-[15px] font-semibold mb-1 text-ld-text">{title}</h4>
        <div className="text-[13.5px] text-ld-text-2 leading-[1.55]">{body}</div>
      </div>
    </div>
  );
}
