import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, MessageCircle } from "lucide-react";
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

type Props = {
  page?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  comment: string;
  imageUrl: string;
};

export function StylistChat(props: Props) {
  const load = useServerFn(loadStylistChat);
  const [account, setAccount] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
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
        if (!cancelled) setInitialMessages(JSON.parse(history.messages) as UIMessage[]);
      } catch {
        if (!cancelled) setError("Your conversation could not load. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.open, attempt, load]);
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
          {...props}
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
  productName,
  comment,
  imageUrl,
}: Props & { initialMessages: UIMessage[] }) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const originRef = useRef<{ url: string; path: string } | null>(null);
  const [question, setQuestion] = useState("");
  const [includeImage, setIncludeImage] = useState(false);
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
      let imagePath: string | undefined;
      if (imageUrl && productName) {
        if (originRef.current?.url === imageUrl) {
          imagePath = originRef.current.path;
        } else {
          const { data } = await supabase.auth.getUser();
          if (!data.user) throw new Error("Sign in again to attach your ShopLook.");
          const photo = await (await fetch(imageUrl)).blob();
          const path = `${data.user.id}/stylist/${crypto.randomUUID()}/look`;
          const { error: uploadError } = await supabase.storage.from("shoplook-media").upload(path, photo, { contentType: photo.type || "image/png" });
          if (uploadError) throw new Error("Your ShopLook could not be attached. Please try again.");
          originRef.current = { url: imageUrl, path };
          imagePath = path;
        }
      }
      let image: string | undefined;
      if (includeImage) {
        const blob = await (await fetch(imageUrl)).blob();
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
      setQuestion("");
      setPreparing(false);
      await sendMessage(
        { text: text.trim(), ...(productName ? { metadata: { productName, comment, imagePath } } : {}) },
        {
          body:
            productName || comment || image
              ? { look: { productName, comment, ...(imagePath ? { imagePath } : {}), ...(image ? { image } : {}) } }
              : {},
        },
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
  return (
    <>
      <Conversation className="min-h-0">
        <ConversationContent className="gap-5">
          {comment && (
            <div className="border-l-2 border-primary pl-3">
              <p className="mb-1 text-xs font-semibold text-primary">Stylist’s take</p>
              <p className="text-sm leading-5">{comment}</p>
            </div>
          )}
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
        {imageUrl && (
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
              imageUrl
                ? "What shoes would work with this?"
                : "Ask about outfits, colours or styling…"
            }
            aria-label="Ask your stylist"
            className="min-h-16 text-sm"
          />
          <PromptInputFooter className="justify-end">
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
    </>
  );
}

function OriginatingLook({ metadata }: { metadata: unknown }) {
  const origin = metadata as { productName?: string; imagePath?: string } | undefined;
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl("");
    if (!origin?.imagePath) return;
    let active = true;
    void supabase.storage.from("shoplook-media").createSignedUrl(origin.imagePath, 3600).then(({ data }) => {
      if (active && data) setUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [origin?.imagePath]);
  if (!origin?.productName) return null;
  return (
    <div className="mb-2 flex max-w-full items-center gap-3 border-l-2 border-primary pl-3">
      {url && <img src={url} alt={`Originating ShopLook: ${origin.productName}`} className="h-24 w-16 shrink-0 rounded object-contain bg-muted" />}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-primary">From this ShopLook</p>
        <p className="break-words text-xs text-muted-foreground">{origin.productName}</p>
      </div>
    </div>
  );
}
