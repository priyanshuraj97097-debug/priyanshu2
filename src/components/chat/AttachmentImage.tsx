import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, ImageOff, Loader2, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getFileUrl, type Attachment } from "@/lib/data/chat";

export function AttachmentImage({ attachment }: { attachment: Attachment }) {
  const [open, setOpen] = useState(false);
  const { data: url, isLoading } = useQuery({
    queryKey: ["file-url", attachment.id],
    queryFn: () => getFileUrl(attachment.id),
    staleTime: 45 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex h-40 w-full max-w-sm items-center justify-center rounded-xl border border-border bg-card">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!url) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <ImageOff className="size-3.5" /> Image unavailable
      </div>
    );
  }

  return (
    <>
      <figure className="max-w-sm">
        <Button
          type="button"
          variant="ghost"
          aria-label={`View ${attachment.name} fullscreen`}
          onClick={() => setOpen(true)}
          className="group relative h-auto w-full overflow-hidden rounded-lg border border-border p-0"
        >
          <img
            src={url}
            alt={attachment.name}
            loading="lazy"
            className="w-full object-contain"
          />
          <span className="absolute right-2 top-2 rounded-md bg-background/85 p-1.5 text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Maximize2 className="size-4" />
          </span>
        </Button>
        <figcaption className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{attachment.name}</span>
          <a
            href={url}
            download={attachment.name}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 hover:text-foreground"
          >
            <Download className="size-3.5" /> Download
          </a>
        </figcaption>
      </figure>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[95dvh] w-[calc(100%-1rem)] max-w-6xl overflow-auto p-3 sm:p-5">
          <DialogTitle className="sr-only">{attachment.name}</DialogTitle>
          <img
            src={url}
            alt={attachment.name}
            className="mx-auto max-h-[82dvh] w-auto max-w-full object-contain"
          />
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <p className="min-w-0 truncate text-sm text-muted-foreground">{attachment.name}</p>
            <Button asChild size="sm" variant="secondary">
              <a href={url} download={attachment.name} target="_blank" rel="noreferrer">
                <Download className="size-4" /> Download
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
