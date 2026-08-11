import { useQuery } from "@tanstack/react-query";
import { Download, ImageOff, Loader2 } from "lucide-react";

import { getFileUrl, type Attachment } from "@/lib/data/chat";

export function AttachmentImage({ attachment }: { attachment: Attachment }) {
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
    <figure className="max-w-sm">
      <img
        src={url}
        alt={attachment.name}
        loading="lazy"
        className="w-full rounded-xl border border-border"
      />
      <figcaption className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{attachment.name}</span>
        <a
          href={url}
          download={attachment.name}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <Download className="size-3.5" /> Download
        </a>
      </figcaption>
    </figure>
  );
}
