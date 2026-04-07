import { Sparkles } from 'lucide-react';

export function AiInsights({ insights }: { insights: string }) {
  return (
    <div className="relative rounded-xl p-[1px] bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500">
      <div className="rounded-[11px] bg-background p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-violet-500 to-pink-500">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-sm font-semibold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
            AI Insights
          </h3>
          <span className="text-xs text-muted-foreground ml-auto">Powered by Gemini</span>
        </div>
        <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
          {insights}
        </div>
      </div>
    </div>
  );
}
