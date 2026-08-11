import { Check, ChevronDown, Sparkles } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MODES, modeLabel, type ModeKey } from "@/lib/ai/modes";

export function ModeSelector({
  value,
  onChange,
}: {
  value: ModeKey;
  onChange: (mode: ModeKey) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 max-w-[9.5rem] gap-1 px-2 text-xs text-muted-foreground"
        >
          <Sparkles className="size-3.5 shrink-0" />
          <span className="truncate">{modeLabel(value)}</span>
          <ChevronDown className="size-3 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Assistant mode</DropdownMenuLabel>
        {MODES.map((m) => (
          <DropdownMenuItem key={m.key} onSelect={() => onChange(m.key)} className="items-start gap-2">
            <Check className={`mt-0.5 size-3.5 ${m.key === value ? "opacity-100" : "opacity-0"}`} />
            <div>
              <p className="text-sm font-medium">{m.label}</p>
              <p className="text-xs text-muted-foreground">{m.hint}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
