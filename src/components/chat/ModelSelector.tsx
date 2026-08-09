import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { listModels } from "@/lib/data/chat";

export function ModelSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (slug: string) => void;
}) {
  const { data: models = [] } = useQuery({ queryKey: ["ai-models"], queryFn: listModels });
  const active = models.find((m) => m.slug === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs text-muted-foreground">
          {active?.display_name ?? "Model"}
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Available models</DropdownMenuLabel>
        {models.map((m) => (
          <DropdownMenuItem key={m.slug} onSelect={() => onChange(m.slug)} className="items-start gap-2">
            <Check className={`mt-0.5 size-3.5 ${m.slug === value ? "opacity-100" : "opacity-0"}`} />
            <div>
              <p className="text-sm font-medium">{m.display_name}</p>
              <p className="text-xs text-muted-foreground">{m.description}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}