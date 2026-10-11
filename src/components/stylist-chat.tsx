import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { Images, LoaderCircle, MessageCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthDialog } from "@/components/auth-dialog";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { supabase } from "@/integrations/supabase/client";
import { loadStylistChat } from "@/lib/stylist-chat.functions";
import type {
  StylistActiveLook,
  StylistLookTrayItem,
  StylistMessageMetadata,
} from "@/lib/stylist-chat.types";

export type StylistSessionLook = {
  productName: string;
  comment: string;
  imageUrl: string;
};

type Props = {
  page?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionLook?: StylistSessionLook | null;
};

function lookKey(
  look: Pick<StylistLookTrayItem, "kind" | "savedLookId" | "sessionImagePath" | "imagePath">,
) {
  if (look.kind === "saved") return `saved:${look.savedLookId ?? look.imagePath}`;
  return `session:${look.sessionImagePath ?? look.imagePath}`;
}

export function StylistChat(props: Props) {
  const load = useServerFn(loadStylistChat);
  const [account, setAccount] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [lookTray, setLookTray] = useState<StylistLookTrayItem[]>([]);
  const [activeLook, setActiveLook] = useState<StylistActiveLook | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const sessionPathRef = useRef<{ url: string; path: string } | null>(null);

  const sessionImageUrl = props.sessionLook?.imageUrl ?? "";
  const sessionProductName = props.sessionLook?.productName ?? "";
  const sessionComment = props.sessionLook?.comment ?? "";

  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;
    setInitialMessages(null);
    setError("");
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setAccount(null);
        return;
      }
      setAccount(data.user.id);
      try {
        const history = await load();
        if (cancelled) return;
        const messages = JSON.parse(history.messages) as UIMessage[];
        const tray = JSON.parse(history.lookTray) as StylistLookTrayItem[];
        const active = JSON.parse(history.activeLook) as StylistActiveLook | { kind: null };
        let nextTray = tray;
        let nextActive: StylistActiveLook | null =
          active.kind === "saved" || active.kind === "session" ? active : null;

        if (sessionImageUrl && sessionProductName) {
          let sessionPath =
            sessionPathRef.current?.url === sessionImageUrl ? sessionPathRef.current.path : null;
          if (!sessionPath) {
            const photo = await (await fetch(sessionImageUrl)).blob();
            const path = `${data.user.id}/stylist/${crypto.randomUUID()}/look`;
            const { error: uploadError } = await supabase.storage
              .from("shoplook-media")
              .upload(path, photo, { contentType: photo.type || "image/png" });
            if (uploadError)
              throw new Error("Your ShopLook could not be attached. Please try again.");
            sessionPathRef.current = { url: sessionImageUrl, path };
            sessionPath = path;
          }
          const sessionItem: StylistLookTrayItem = {
            kind: "session",
            sessionImagePath: sessionPath,
            productName: sessionProductName,
            comment: sessionComment,
            imageUrl: sessionImageUrl,
            imagePath: sessionPath,
          };
          nextTray = [
            sessionItem,
            ...tray.filter((item) => lookKey(item) !== lookKey(sessionItem)),
          ];
          nextActive = {
            kind: "session",
            sessionImagePath: sessionPath,
            productName: sessionProductName,
            comment: sessionComment,
            imageUrl: sessionImageUrl,
            imagePath: sessionPath,
          };
        }

        setLookTray(nextTray);
        setActiveLook(nextActive);
        setInitialMessages(messages);
      } catch {
        if (!cancelled) setError("Your conversation could not load. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.open, sessionImageUrl, sessionProductName, sessionComment, attempt, load]);

  const content = (
    <>
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-4 pr-12">
        <span
          className="grid size-9 place-items-center rounded-full bg-primary-soft font-semibold text-primary"
          aria-hidden="true"
        >
          SL
        </span>
        <div>
          {props.page ? (
            <h1 className="text-base font-semibold">Your AI Stylist</h1>
          ) : (
            <DialogTitle className="text-base">Your AI Stylist</DialogTitle>
          )}
          <p className="text-xs text-muted-foreground">ShopLook</p>
        </div>
      </div>
      {!account ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <Button onClick={() => setAuthOpen(true)}>
            <MessageCircle /> Sign in to chat
          </Button>
        </div>
      ) : initialMessages ? (
        <StylistConversation
          key={`${account}:${attempt}`}
          initialMessages={initialMessages}
          lookTray={lookTray}
          activeLook={activeLook}
          onActiveLookChange={setActiveLook}
          page={Boolean(props.page)}
        />
      ) : (
        <div className="grid flex-1 place-items-center p-6">
          {error ? (
            <div>
              <p role="alert" className="mb-3 text-sm text-destructive">
                {error}
              </p>
              <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>
                Try again
              </Button>
            </div>
          ) : (
            <LoaderCircle
              className="size-5 animate-spin text-muted-foreground"
              aria-label="Loading your chat"
            />
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {props.page ? (
        <section className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden bg-card">
          {content}
        </section>
      ) : (
        <Dialog open={props.open && !authOpen} onOpenChange={props.onOpenChange}>
          <DialogContent
            aria-describedby={undefined}
            className="flex h-[min(760px,calc(100dvh-1rem))] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[430px] flex-col gap-0 overflow-hidden rounded-lg bg-card p-0"
          >
            {content}
          </DialogContent>
        </Dialog>
      )}
      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        onSignedIn={() => {
          setAttempt((value) => value + 1);
          setAuthOpen(false);
        }}
      />
    </>
  );
}

function StylistConversation({
  initialMessages,
  lookTray,
  activeLook,
  onActiveLookChange,
  page,
}: {
  initialMessages: UIMessage[];
  lookTray: StylistLookTrayItem[];
  activeLook: StylistActiveLook | null;
  onActiveLookChange: (look: StylistActiveLook | null) => void;
  page: boolean;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [question, setQuestion] = useState("");
  const [includeImage, setIncludeImage] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [requestError, setRequestError] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/stylist-chat",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
        },
      }),
    [],
  );
  const { messages, sendMessage, status, stop, error } = useChat({
    id: "my-shoplook-stylist",
    messages: initialMessages,
    transport,
    onError: (reason) => {
      setRequestError(reason.message);
    },
    onFinish: () => {
      inputRef.current?.focus();
    },
  });
  const busy = status === "submitted" || status === "streaming" || preparing;
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  async function submit(text: string) {
    if (!text.trim() || busy) return;
    setRequestError("");
    setPreparing(true);
    try {
      let image: string | undefined;
      if (includeImage && activeLook?.imageUrl) {
        const blob = await (await fetch(activeLook.imageUrl)).blob();
        image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            typeof reader.result === "string"
              ? resolve(reader.result)
              : reject(new Error("Could not attach your look."));
          reader.onerror = () => reject(new Error("Could not attach your look."));
          reader.readAsDataURL(blob);
        });
      }
      const lookBody =
        activeLook?.kind === "saved" && activeLook.savedLookId
          ? {
              savedLookId: activeLook.savedLookId,
              ...(image ? { image } : {}),
            }
          : activeLook?.kind === "session"
            ? {
                sessionImagePath: activeLook.sessionImagePath,
                productName: activeLook.productName,
                comment: activeLook.comment,
                ...(image ? { image } : {}),
              }
            : image
              ? { image }
              : undefined;
      setQuestion("");
      setPreparing(false);
      await sendMessage(
        {
          text: text.trim(),
          ...(activeLook?.productName
            ? {
                metadata: {
                  productName: activeLook.productName,
                  comment: activeLook.comment,
                  imagePath: activeLook.imagePath,
                  ...(activeLook.savedLookId ? { savedLookId: activeLook.savedLookId } : {}),
                } satisfies StylistMessageMetadata,
              }
            : {}),
        },
        { body: lookBody ? { look: lookBody } : {} },
      );
    } catch (reason) {
      setRequestError(
        reason instanceof Error ? reason.message : "Your question could not be sent.",
      );
      setQuestion(text);
    } finally {
      setPreparing(false);
      inputRef.current?.focus();
    }
  }

  function selectLook(item: StylistLookTrayItem) {
    onActiveLookChange({
      kind: item.kind,
      ...(item.savedLookId ? { savedLookId: item.savedLookId } : {}),
      ...(item.sessionImagePath ? { sessionImagePath: item.sessionImagePath } : {}),
      productName: item.productName,
      comment: item.comment,
      imageUrl: item.imageUrl,
      imagePath: item.imagePath,
    });
    setPickerOpen(false);
  }

  return (
    <>
      {activeLook && (
        <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-2.5">
          <img
            src={activeLook.imageUrl}
            alt=""
            className="h-12 w-9 shrink-0 rounded object-cover bg-muted"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-muted-foreground">This look</p>
            <p className="truncate text-sm font-medium leading-5">{activeLook.productName}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label="Clear selected look"
            onClick={() => onActiveLookChange(null)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}
      <Conversation className="min-h-0">
        <ConversationContent className="gap-5">
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <OriginatingLook metadata={message.metadata} />
              <MessageContent
                className={
                  message.role === "user"
                    ? "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground"
                    : "bg-transparent"
                }
              >
                {message.parts.map((part, index) =>
                  part.type === "text" ? (
                    <MessageResponse key={index}>{part.text}</MessageResponse>
                  ) : part.type === "reasoning" ? (
                    <details key={index} className="text-xs text-muted-foreground">
                      <summary>Stylist is thinking</summary>
                      <MessageResponse>{part.text}</MessageResponse>
                    </details>
                  ) : null,
                )}
              </MessageContent>
            </Message>
          ))}
          {(status === "submitted" || preparing) && <Shimmer>Stylist is thinking…</Shimmer>}
          {(requestError || error) && (
            <p role="alert" className="text-sm text-destructive">
              {requestError || error?.message}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="shrink-0 border-t border-border p-3">
        {activeLook?.imageUrl && (
          <label className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={includeImage}
              onCheckedChange={(checked) => setIncludeImage(checked === true)}
              disabled={busy}
            />{" "}
            Include this ShopLook photo
          </label>
        )}
        <PromptInput onSubmit={({ text }) => submit(text)}>
          <PromptInputTextarea
            ref={inputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={2000}
            placeholder={
              activeLook?.productName
                ? "What shoes would work with this?"
                : "Ask about outfits, colours or styling…"
            }
            aria-label="Ask your stylist"
            className="min-h-16 text-sm"
          />
          <PromptInputFooter className="justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Choose a look"
              aria-expanded={pickerOpen}
              disabled={busy}
              onClick={() => setPickerOpen(true)}
            >
              <Images className="size-4" />
            </Button>
            <PromptInputSubmit
              status={status}
              onStop={() => {
                void stop();
              }}
              disabled={preparing || (!busy && !question.trim())}
              className="size-9"
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
      {pickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose a look"
          className="fixed inset-0 z-50 flex items-end justify-center bg-scrim"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPickerOpen(false);
          }}
        >
          <div className="flex max-h-[min(68dvh,540px)] w-full max-w-[430px] flex-col rounded-t-lg bg-background shadow-sheet">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Choose a look</h2>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Close look picker"
                onClick={() => setPickerOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            {lookTray.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                {page
                  ? "Heart a ShopLook to discuss it here, or ask general styling questions anytime."
                  : "No looks to attach yet."}
              </p>
            ) : (
              <div className="scrollbar-none grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto p-3">
                {lookTray.map((item) => {
                  const selected = Boolean(activeLook && lookKey(activeLook) === lookKey(item));
                  return (
                    <button
                      key={lookKey(item)}
                      type="button"
                      onClick={() => selectLook(item)}
                      className={`overflow-hidden rounded-md border text-left transition-colors ${
                        selected
                          ? "border-primary bg-primary-soft"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                      aria-pressed={selected}
                    >
                      <div
                        className="w-full overflow-hidden bg-muted"
                        style={{ aspectRatio: "4 / 3" }}
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          className="size-full object-contain"
                        />
                      </div>
                      <span className="line-clamp-2 px-2 py-1.5 text-[11px] leading-4 text-foreground">
                        {item.productName}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function OriginatingLook({ metadata }: { metadata: unknown }) {
  const origin = metadata as StylistMessageMetadata | undefined;
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl("");
    if (!origin?.imagePath) return;
    let active = true;
    void supabase.storage
      .from("shoplook-media")
      .createSignedUrl(origin.imagePath, 3600)
      .then(({ data }) => {
        if (active && data) setUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [origin?.imagePath]);
  if (!origin?.productName) return null;
  return (
    <div className="mb-2 flex max-w-full items-center gap-3 border-l-2 border-primary pl-3">
      {url && (
        <img
          src={url}
          alt={`Originating ShopLook: ${origin.productName}`}
          className="h-24 w-16 shrink-0 rounded object-contain bg-muted"
        />
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-primary">From this ShopLook</p>
        <p className="break-words text-xs text-muted-foreground">{origin.productName}</p>
      </div>
    </div>
  );
}
