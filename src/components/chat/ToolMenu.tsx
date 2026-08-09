import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { TOOL_REGISTRY } from "@/lib/ai/models";

export function ToolMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label="Tools">
          <SlidersHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Tools</DropdownMenuLabel>
        {TOOL_REGISTRY.map((tool) => (
          <DropdownMenuItem
            key={tool.key}
            onSelect={() => toast(`${tool.label} is coming soon`)}
            className="flex-col items-start gap-0.5"
          >
            <span className="text-sm">{tool.label}</span>
            <span className="text-xs text-muted-foreground">{tool.description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}