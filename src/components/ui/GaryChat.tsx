"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";
import { CornerDownLeft } from "lucide-react";
import ThoughtBubble from "@/components/ui/ThoughtBubble";

/**
 * Gary's chat.
 *
 * The conversation lives in the root layout, not in the /fun page, and that
 * placement is the whole design. Gary's job is handing out links, so if the
 * state were mounted inside a page the first link he gave would unmount it
 * mid sentence.
 *
 * It is drawn two different ways. On /fun he is on screen, so the conversation
 * is a speech bubble coming off his head and he stops walking to have it: see
 * GaryPacing. Anywhere else there is no Gary to speak from, so the same
 * conversation continues in a corner panel. Follow one of his links and the
 * bubble becomes the panel with the talk intact, rather than vanishing.
 *
 * A hard reload is the other half, which is what sessionStorage covers. It is
 * scoped to the one tab and cleared when it closes, which is exactly "one
 * visit". Nothing is stored on the server: no cookies, no database, no logs.
 *
 * See docs/gary-chat.md.
 */

export const F = {
  card: "#ffffff",
  edge: "#e2e2e2",
  edgeSoft: "#ececec",
  ink: "#1a1a1a",
  inkSoft: "#555555",
  inkFaint: "#888888",
  accent: "#b8922a",
  shadow: "0 4px 32px rgba(0,0,0,0.45)",
};

/* The lobes bulge outside the box by up to about half a lobe radius, and the
   trail further still, so the panel keeps clear of the screen edge by more
   than a plain rectangle would need. */
const PANEL_MARGIN = 40;
const PANEL_W = 480;

const STORE_KEY = "gary.conversation";
const GREETED_KEY = "gary.greeted";

export type Message = { role: "user" | "assistant"; content: string };

type GaryState = {
  /** False when content/gary.md has no voice in it. Nothing renders. */
  enabled: boolean;
  greeting: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  /** True once the greeting has been shown in this tab. */
  greeted: boolean;
  markGreeted: () => void;
};

const Ctx = createContext<GaryState | null>(null);

/**
 * Who is presenting the conversation.
 *
 * The corner panel is the fallback, not the preferred form: wherever Gary
 * himself is on screen the conversation should come off him as a bubble, and
 * the panel should stand down. StoryGary claims the conversation while he is
 * walking the story board; GaryPacing never needs to, because the panel
 * already excuses itself on /fun by pathname.
 *
 * A module-level count rather than context state, because the claimant
 * (StoryGary) manages the character imperatively inside one long-lived effect
 * and must not re-run that effect when the claim changes hands.
 */
let presenterCount = 0;
const presenterSubs = new Set<() => void>();

export function claimConversation(): () => void {
  presenterCount++;
  presenterSubs.forEach((fn) => fn());
  let released = false;
  return () => {
    if (released) return;
    released = true;
    presenterCount--;
    presenterSubs.forEach((fn) => fn());
  };
}

function subscribePresenters(fn: () => void) {
  presenterSubs.add(fn);
  return () => {
    presenterSubs.delete(fn);
  };
}

const readPresenters = () => presenterCount;
const readPresentersServer = () => 0;

export function useGary(): GaryState {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // GaryPacing renders on /fun whether or not the provider is above it in a
    // given tree, so failing soft keeps the walking figure working.
    return {
      enabled: false,
      greeting: "",
      open: false,
      setOpen: () => {},
      messages: [],
      setMessages: () => {},
      greeted: true,
      markGreeted: () => {},
    };
  }
  return ctx;
}

export function GaryProvider({
  enabled,
  greeting,
  children,
}: {
  enabled: boolean;
  greeting: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [greeted, setGreeted] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Read the tab's conversation back after mount. Doing this in an effect
  // rather than in useState keeps the server and client markup identical.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORE_KEY);
      if (saved) setMessages(JSON.parse(saved));
      setGreeted(sessionStorage.getItem(GREETED_KEY) === "1");
    } catch {
      // Private mode, or storage disabled. Gary still works, he just forgets.
      setGreeted(false);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(messages));
    } catch {
      // Nothing to do. Losing history is not worth breaking the page over.
    }
  }, [messages, hydrated]);

  const markGreeted = useCallback(() => {
    setGreeted(true);
    try {
      sessionStorage.setItem(GREETED_KEY, "1");
    } catch {
      /* see above */
    }
  }, []);

  return (
    <Ctx.Provider
      value={{
        enabled,
        greeting,
        open,
        setOpen,
        messages,
        setMessages,
        greeted: !hydrated || greeted,
        markGreeted,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

/**
 * The conversation itself, with no opinion about what it is drawn inside.
 * The bubble on /fun and the corner panel everywhere else both render this.
 */
export function GaryConversation({ autoFocus = true }: { autoFocus?: boolean }) {
  const { messages, setMessages } = useGary();
  const pathname = usePathname();

  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || streaming) return;

    setDraft("");
    setError(null);
    setStreaming(true);

    const outgoing: Message[] = [...messages, { role: "user", content: text }];
    setMessages(outgoing);

    try {
      const res = await fetch("/api/gary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: outgoing, pathname }),
      });

      if (!res.ok || !res.body) {
        setError(await res.text().catch(() => "Something went wrong."));
        setStreaming(false);
        return;
      }

      // Append an empty turn, then grow it as the bytes land.
      setMessages([...outgoing, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...outgoing, { role: "assistant", content: acc }]);
      }
    } catch {
      setError("Gary did not answer. Try again?");
    } finally {
      setStreaming(false);
    }
  }, [draft, streaming, messages, setMessages, pathname]);

  return (
    <>
      <div
        ref={scroller}
        className="flex-1 space-y-3 overflow-y-auto px-3 py-2"
        style={{ fontSize: "0.82rem", lineHeight: 1.5, minHeight: 0 }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              color: m.role === "user" ? F.inkSoft : F.ink,
              textAlign: m.role === "user" ? "right" : "left",
            }}
          >
            <span
              style={{
                display: "inline-block",
                maxWidth: "90%",
                padding: m.role === "user" ? "0.35rem 0.6rem" : 0,
                borderRadius: "0.6rem",
                backgroundColor: m.role === "user" ? "#f4f4f4" : "transparent",
                whiteSpace: "pre-wrap",
              }}
              dangerouslySetInnerHTML={
                m.role === "assistant" ? { __html: linkify(m.content) } : undefined
              }
            >
              {m.role === "user" ? m.content : undefined}
            </span>
          </div>
        ))}

        {streaming && !messages[messages.length - 1]?.content && (
          <p style={{ color: F.inkFaint }}>...</p>
        )}
        {error && <p style={{ color: "#a33" }}>{error}</p>}
      </div>

      <div
        className="flex items-end gap-2 px-3 py-1.5"
        style={{ borderTop: `1px solid ${F.edgeSoft}` }}
      >
        <textarea
          ref={input}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Ask Gary"
          className="flex-1 resize-none bg-transparent outline-none"
          style={{
            color: F.ink,
            fontSize: "0.82rem",
            maxHeight: "4.5rem",
            padding: "0.3rem 0",
          }}
        />
        <button
          onClick={() => void send()}
          disabled={!draft.trim() || streaming}
          aria-label="Send"
          style={{
            color: draft.trim() ? F.accent : F.inkFaint,
            lineHeight: 0,
            paddingBottom: "0.4rem",
          }}
        >
          <CornerDownLeft size={15} />
        </button>
      </div>
    </>
  );
}

/**
 * The corner panel, used on every page except /fun, where Gary himself is on
 * screen and speaks instead.
 */
export function GaryPanel() {
  const { enabled, open, setOpen } = useGary();
  const pathname = usePathname();
  const claimed =
    useSyncExternalStore(subscribePresenters, readPresenters, readPresentersServer) > 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  /* "/" is boring mode, a plain academic page with no nav and no animation.
     Nav hides itself there for the same reason. On /fun the bubble over Gary's
     head is the conversation, so the panel would be a second copy of it. And
     wherever StoryGary has claimed the conversation, the bubble beside him is
     the conversation, so the panel stands down there too: it comes back by
     itself when he is not on the board (narrow screens, reduced motion, or a
     missing atlas), because nothing claims it then. */
  if (!enabled || !open || claimed || pathname === "/" || pathname === "/fun")
    return null;

  return (
    <ThoughtBubble
      role="dialog"
      ariaLabel="Chat with Gary"
      /* Pointing up and to the left, roughly where he is: on /story he is
         somewhere out on the board above this corner. */
      tail="up"
      tailX={44}
      seed={23}
      style={{
        /* Set here rather than with a class. ThoughtBubble applies
           position: relative inline as its own default, and an inline style
           beats a class, so a `fixed` utility would be silently ignored and
           the panel would drift to wherever the flow put it. */
        position: "fixed",
        zIndex: 50,
        right: PANEL_MARGIN,
        bottom: PANEL_MARGIN,
        width: `min(${PANEL_W}px, calc(100vw - ${PANEL_MARGIN * 2}px))`,
        height: `min(${Math.round((PANEL_W * 9) / 16)}px, calc(100svh - ${PANEL_MARGIN * 2}px))`,
      }}
    >
      <header className="flex items-center justify-between" style={{ paddingBottom: "0.35rem" }}>
        <span
          style={{
            color: F.ink,
            fontFamily: "var(--font-hand)",
            fontSize: "1.15rem",
            lineHeight: 1,
          }}
        >
          Gary
        </span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          style={{ color: F.inkFaint, fontSize: "1rem", lineHeight: 1 }}
        >
          ×
        </button>
      </header>

      <GaryConversation />
    </ThoughtBubble>
  );
}

/**
 * Gary writes markdown links. Only the link form is rendered, and the text is
 * escaped first, so a reply can never inject markup into the page.
 */
function linkify(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped.replace(
    /\[([^\]]+)\]\((\/[A-Za-z0-9\-/]*|https?:\/\/[^\s)]+)\)/g,
    (_all, label, href) =>
      `<a href="${href}" style="color:${F.accent};text-decoration:underline">${label}</a>`,
  );
}
