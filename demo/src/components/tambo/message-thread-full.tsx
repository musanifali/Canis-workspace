"use client";

import type { messageVariants } from "@/components/tambo/message";
import {
  MessageInput,
  MessageInputError,
  MessageInputFileButton,
  MessageInputMcpConfigButton,
  MessageInputMcpPromptButton,
  MessageInputMcpResourceButton,
  MessageInputSubmitButton,
  MessageInputTextarea,
  MessageInputToolbar,
} from "@/components/tambo/message-input";
import {
  MessageSuggestions,
  MessageSuggestionsList,
  MessageSuggestionsStatus,
} from "@/components/tambo/message-suggestions";
import { ScrollableMessageContainer } from "@/components/tambo/scrollable-message-container";
import { ThreadContainer, useThreadContainerContext } from "./thread-container";
import {
  ThreadContent,
  ThreadContentMessages,
} from "@/components/tambo/thread-content";
import {
  ThreadHistory,
  ThreadHistoryHeader,
  ThreadHistoryList,
  ThreadHistoryNewButton,
  ThreadHistorySearch,
} from "@/components/tambo/thread-history";
import { useMergeRefs } from "@/lib/thread-hooks";
import type { Suggestion } from "@tambo-ai/react";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

/**
 * Props for the MessageThreadFull component
 */
export interface MessageThreadFullProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Controls the visual styling of messages in the thread.
   * Possible values include: "default", "compact", etc.
   * These values are defined in messageVariants from "@/components/tambo/message".
   * @example variant="compact"
   */
  variant?: VariantProps<typeof messageVariants>["variant"];
  /**
   * Input placeholder text. Defaults to the generic chat template copy; the
   * /create surface overrides it with a domain-appropriate prompt (#78).
   */
  placeholder?: string;
  /**
   * Show the built-in "Get started / Learn more / Examples" suggestion footer.
   * Defaults to true (template behavior). /create turns it off (#78) — it has
   * its own domain cold-start chips (ColdStartSuggestions).
   */
  showDefaultSuggestions?: boolean;
  /**
   * Show the input affordances (attach-image, MCP prompt/resource/config, and
   * dictation buttons). Defaults to true (template behavior). /create turns
   * them off (#78) — they're irrelevant to a workspace generator and read as
   * unfinished template chrome.
   */
  showInputAffordances?: boolean;
}

/**
 * A full-screen chat thread component with message history, input, and suggestions
 */
export const MessageThreadFull = React.forwardRef<
  HTMLDivElement,
  MessageThreadFullProps
>(
  (
    {
      className,
      variant,
      placeholder = "Type your message or paste images...",
      showDefaultSuggestions = true,
      showInputAffordances = true,
      ...props
    },
    ref,
  ) => {
  const { containerRef, historyPosition } = useThreadContainerContext();
  const mergedRef = useMergeRefs<HTMLDivElement | null>(ref, containerRef);

  const threadHistorySidebar = (
    <ThreadHistory position={historyPosition}>
      <ThreadHistoryHeader />
      <ThreadHistoryNewButton />
      <ThreadHistorySearch />
      <ThreadHistoryList />
    </ThreadHistory>
  );

  const defaultSuggestions: Suggestion[] = [
    {
      id: "suggestion-1",
      title: "Get started",
      description: "What can you help me with?",
      detailedSuggestion: "What can you help me with?",
      messageId: "welcome-query",
    },
    {
      id: "suggestion-2",
      title: "Learn more",
      description: "Tell me about your capabilities.",
      detailedSuggestion: "Tell me about your capabilities.",
      messageId: "capabilities-query",
    },
    {
      id: "suggestion-3",
      title: "Examples",
      description: "Show me some example queries I can try.",
      detailedSuggestion: "Show me some example queries I can try.",
      messageId: "examples-query",
    },
  ];

  return (
    <div className="flex h-full w-full">
      {/* Thread History Sidebar - rendered first if history is on the left */}
      {historyPosition === "left" && threadHistorySidebar}

      <ThreadContainer
        ref={mergedRef}
        disableSidebarSpacing
        className={className}
        {...props}
      >
        <ScrollableMessageContainer className="p-4">
          <ThreadContent variant={variant}>
            <ThreadContentMessages />
          </ThreadContent>
        </ScrollableMessageContainer>

        {/* Message suggestions status */}
        <MessageSuggestions autoGenerate={false}>
          <MessageSuggestionsStatus />
        </MessageSuggestions>

        {/* Message input */}
        <div className="px-4 pb-4">
          <MessageInput>
            <MessageInputTextarea placeholder={placeholder} />
            {showInputAffordances ? (
              <MessageInputToolbar>
                <MessageInputFileButton />
                <MessageInputMcpPromptButton />
                <MessageInputMcpResourceButton />
                {/* Uncomment this to enable client-side MCP config modal button */}
                <MessageInputMcpConfigButton />
                <MessageInputSubmitButton />
              </MessageInputToolbar>
            ) : (
              // Focused mode (#78): no attach/MCP/dictation affordances — just
              // send. MessageInputToolbar hardcodes the dictation button, so a
              // minimal toolbar is the way to drop it without editing the
              // shared input component.
              <div className="mt-2 flex justify-end p-1">
                <MessageInputSubmitButton />
              </div>
            )}
            <MessageInputError />
          </MessageInput>
        </div>

        {/* Message suggestions */}
        {showDefaultSuggestions && (
          <MessageSuggestions initialSuggestions={defaultSuggestions} autoGenerate={false}>
            <MessageSuggestionsList />
          </MessageSuggestions>
        )}
      </ThreadContainer>

      {/* Thread History Sidebar - rendered last if history is on the right */}
      {historyPosition === "right" && threadHistorySidebar}
    </div>
  );
  },
);
MessageThreadFull.displayName = "MessageThreadFull";
