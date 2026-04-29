import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTED_PROMPTS = [
  "How do I book a class?",
  "How much are tickets?",
  "What's your refund policy?",
  "Where are you located?",
];

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = trpc.chatbot.chat.useMutation({
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.reply },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I'm having a little trouble right now. Please email us at afropuppyyogaofficial@gmail.com and we'll get back to you quickly!",
        },
      ]);
    },
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, chatMutation.isPending]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = (content: string) => {
    if (!content.trim() || chatMutation.isPending) return;
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: content.trim() },
    ];
    setMessages(newMessages);
    setInput("");
    chatMutation.mutate({ messages: newMessages });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div
          className="fixed z-50 flex flex-col shadow-2xl"
          style={{
            bottom: "90px",
            right: "20px",
            width: "min(380px, calc(100vw - 40px))",
            height: "min(520px, calc(100vh - 120px))",
            borderRadius: "16px",
            background: "#FEFAF4",
            border: "1px solid #E8D5B0",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #2D1B0E 0%, #4A2C1A 100%)",
              borderRadius: "16px 16px 0 0",
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-base"
                style={{ background: "#C8873A" }}
              >
                🐶
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">
                  APY Assistant
                </p>
                <p className="text-xs" style={{ color: "#C8873A" }}>
                  Ask me anything!
                </p>
              </div>
            </div>
            <button
              onClick={() => { setIsOpen(false); setMessages([]); setInput(""); }}
              className="text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="text-center">
                  <p className="text-3xl mb-2">🐶🧘🏾</p>
                  <p
                    className="font-semibold text-sm"
                    style={{ color: "#2D1B0E" }}
                  >
                    Hey there! I'm the APY Assistant.
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#7A5C3A" }}>
                    Ask me about classes, pricing, booking, and more!
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-left text-xs px-3 py-2 rounded-lg border transition-colors hover:opacity-80"
                      style={{
                        borderColor: "#C8873A",
                        color: "#4A2C1A",
                        background: "#FFF8EE",
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mr-2 mt-1"
                        style={{ background: "#C8873A" }}
                      >
                        🐶
                      </div>
                    )}
                    <div
                      className="max-w-[80%] px-3 py-2 rounded-2xl text-sm"
                      style={
                        msg.role === "user"
                          ? {
                              background: "#2D1B0E",
                              color: "#FEFAF4",
                              borderBottomRightRadius: "4px",
                            }
                          : {
                              background: "#FFF8EE",
                              color: "#2D1B0E",
                              border: "1px solid #E8D5B0",
                              borderBottomLeftRadius: "4px",
                            }
                      }
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none text-inherit">
                          <Streamdown>{msg.content}</Streamdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex justify-start">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mr-2 mt-1"
                      style={{ background: "#C8873A" }}
                    >
                      🐶
                    </div>
                    <div
                      className="px-3 py-2 rounded-2xl"
                      style={{
                        background: "#FFF8EE",
                        border: "1px solid #E8D5B0",
                        borderBottomLeftRadius: "4px",
                      }}
                    >
                      <div className="flex gap-1 items-center py-1">
                        <span
                          className="w-2 h-2 rounded-full animate-bounce"
                          style={{
                            background: "#C8873A",
                            animationDelay: "0ms",
                          }}
                        />
                        <span
                          className="w-2 h-2 rounded-full animate-bounce"
                          style={{
                            background: "#C8873A",
                            animationDelay: "150ms",
                          }}
                        />
                        <span
                          className="w-2 h-2 rounded-full animate-bounce"
                          style={{
                            background: "#C8873A",
                            animationDelay: "300ms",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div
            className="flex gap-2 p-3 flex-shrink-0"
            style={{
              borderTop: "1px solid #E8D5B0",
              background: "#FEFAF4",
              borderRadius: "0 0 16px 16px",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              rows={1}
              className="flex-1 resize-none text-sm px-3 py-2 rounded-xl outline-none"
              style={{
                background: "#FFF8EE",
                border: "1px solid #E8D5B0",
                color: "#2D1B0E",
                maxHeight: "80px",
                fontFamily: "inherit",
              }}
              disabled={chatMutation.isPending}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || chatMutation.isPending}
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-opacity disabled:opacity-40"
              style={{ background: "#C8873A" }}
            >
              {chatMutation.isPending ? (
                <Loader2 size={16} className="text-white animate-spin" />
              ) : (
                <Send size={16} className="text-white" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => {
          setIsOpen((prev) => {
            if (prev) { setMessages([]); setInput(""); }
            return !prev;
          });
        }}
        className="fixed z-50 flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{
          bottom: "20px",
          right: "20px",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: isOpen
            ? "#2D1B0E"
            : "linear-gradient(135deg, #C8873A 0%, #A06828 100%)",
          border: "none",
          cursor: "pointer",
        }}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? (
          <X size={22} className="text-white" />
        ) : (
          <MessageCircle size={22} className="text-white" />
        )}
      </button>
    </>
  );
}
