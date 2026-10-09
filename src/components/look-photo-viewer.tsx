import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LookPhotoViewer({ src, open, onOpenChange }: { src: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
    <Dialog.Content aria-describedby={undefined} className="fixed inset-x-3 top-1/2 z-50 mx-auto flex max-h-[92dvh] max-w-3xl -translate-y-1/2 flex-col rounded-md bg-background p-3 shadow-sheet focus:outline-none">
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><Dialog.Title className="font-display text-xl">Your ShopLook</Dialog.Title><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close full-size photo"><X /></Button></Dialog.Close></div>
      <img src={src} alt="Your full-size ShopLook photo" className="min-h-0 w-full flex-1 object-contain" />
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}