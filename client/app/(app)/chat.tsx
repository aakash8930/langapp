import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createChatSession,
  sendChatMessage,
  type ChatMessage,
  type ChatSession,
} from '@/api/chat';
import { Button } from '@/components/Button';
import { ChatBubble, CorrectionNote } from '@/components/ChatBubble';
import { ChatComposer } from '@/components/ChatComposer';
import { JapaneseSpeechButton } from '@/components/JapaneseSpeechButton';
import { ChatStartSkeleton, PendingReplySkeleton } from '@/components/ChatSkeletons';
import { ErrorState } from '@/components/ErrorState';
import { FormError } from '@/components/FormError';
import { chatErrorCopy, localMessageId, type ChatErrorCopy } from '@/lib/chat';
import { tapFeedback } from '@/lib/haptics';
import { useTheme } from '@/theme';

const SESSION_KEY = ['chat', 'session'] as const;

/**
 * The AI conversation — §14 step 7, and the one screen where the app talks back.
 *
 * The unusual thing here is where the transcript lives. There is no `GET` for
 * chat history by design (§9 lists exactly two chat routes), so React Query's
 * cache is not a cache of server state — it *is* the store. That is why the
 * conversation survives a trip to the home screen and back, and why an
 * in-flight turn whose screen was unmounted still lands: the `.then` writes
 * into the cache, not into component state.
 *
 * Sends are serialised — the composer is disabled while a turn is in flight —
 * so the concurrent-mutation trap of overlapping writes cannot arise
 * here. The plain async call is kept anyway, for the same reason: the ledger
 * below is the state, and `useMutation` would only offer a second, staler copy
 * of it.
 */
export default function Chat() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);

  const [draft, setDraft] = useState('');
  /** Local id of the message awaiting a reply, or null when idle. */
  const [pendingId, setPendingId] = useState<string | null>(null);
  /** The message that failed, kept so "Try again" can re-send the same text. */
  const [failed, setFailed] = useState<{ id: string; text: string } | null>(null);
  const [error, setError] = useState<ChatErrorCopy | null>(null);
  /** Set when the server says this session is finished — cap hit, or gone. */
  const [spent, setSpent] = useState(false);

  const session = useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => createChatSession(),
    // A POST behind a query, which is only defensible because creating a
    // session is free: the opener is scripted server-side, so no LLM call
    // happens here. These three settings are what stop it from ever firing a
    // second time and stranding the learner in a fresh, empty conversation.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
    // The transcript has nowhere else to live and the server caps it at 50
    // messages, so holding it for the life of the app costs a few kilobytes.
    gcTime: Infinity,
  });

  const messages = session.data?.messages ?? [];

  /** The only writer of the transcript. */
  const updateMessages = useCallback(
    (update: (current: ChatMessage[]) => ChatMessage[]) => {
      queryClient.setQueryData<ChatSession>(SESSION_KEY, (current) =>
        current ? { ...current, messages: update(current.messages) } : current,
      );
    },
    [queryClient],
  );

  const send = useCallback(
    async (text: string, messageId: string) => {
      const sessionId = queryClient.getQueryData<ChatSession>(SESSION_KEY)?.id;
      if (!sessionId) return;

      setPendingId(messageId);
      setError(null);

      try {
        const turn = await sendChatMessage(sessionId, text);

        updateMessages((current) => [
          // The corrections belong to the message that earned them, so they
          // are attached in place rather than appended as a third bubble.
          ...current.map((message) =>
            message.id === messageId ? { ...message, corrections: turn.corrections } : message,
          ),
          turn.reply,
        ]);
        setFailed(null);
      } catch (caught) {
        const copy = chatErrorCopy(caught);
        setError(copy);
        if (copy.needsNewSession) setSpent(true);
        // A failed turn persisted nothing server-side — the API writes both
        // messages only after the model answers — so re-sending the same text
        // cannot duplicate it.
        setFailed(copy.canRetry ? { id: messageId, text } : null);
      } finally {
        setPendingId(null);
      }
    },
    [queryClient, updateMessages],
  );

  function submit() {
    const text = draft.trim();
    if (!text || pendingId || spent) return;

    tapFeedback();
    const messageId = localMessageId();

    // Optimistic, and written to the cache rather than to component state:
    // leaving this screen mid-turn must not lose what was already said.
    updateMessages((current) => [
      ...current,
      {
        id: messageId,
        role: 'user',
        text,
        corrections: [],
        createdAt: new Date().toISOString(),
      },
    ]);
    setDraft('');
    void send(text, messageId);
  }

  function retry() {
    if (!failed) return;
    void send(failed.text, failed.id);
  }

  // `refetch` re-runs the POST and replaces the conversation wholesale — one
  // new session, exactly. Removing the query first would leave an observer with
  // no data under `refetchOnMount: false`, which either strands the screen
  // pending or races this call into creating a second session.
  const refetchSession = session.refetch;
  const startNew = useCallback(() => {
    setDraft('');
    setPendingId(null);
    setFailed(null);
    setError(null);
    setSpent(false);
    void refetchSession();
  }, [refetchSession]);

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, paddingTop: insets.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title={session.data?.title}
        titleJa={session.data?.titleJa}
        onNew={session.data ? startNew : undefined}
        onLeave={leave}
      />

      {session.isPending ? (
        <ChatStartSkeleton />
      ) : session.isError ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.xl }}>
          <ErrorState
            error={session.error}
            onRetry={() => void session.refetch()}
            onDismiss={leave}
          />
          {/* `describeError` reads a 503 as a transient server fault. Here it
              means the API has no key, which no retry will fix — so the real
              instruction is spelled out beneath it. */}
          {chatErrorCopy(session.error).canRetry ? null : (
            <View style={{ paddingTop: theme.spacing.lg }}>
              <FormError message={chatErrorCopy(session.error).message} />
            </View>
          )}
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{
              padding: theme.spacing.xl,
              gap: theme.spacing.lg,
            }}
            keyboardShouldPersistTaps="handled"
            // Anchored to the newest turn. Keyboard opening also changes the
            // content size, so this covers that too.
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: !reducedMotion })
            }
          >
            {messages.map((message) => (
              <View key={message.id} style={{ gap: theme.spacing.sm }}>
                <ChatBubble
                  role={message.role}
                  text={message.text}
                  pending={message.id === pendingId}
                />
                <CorrectionNote corrections={message.corrections} />
                {message.role === 'assistant' ? (
                  <JapaneseSpeechButton text={message.text} />
                ) : null}
              </View>
            ))}

            {pendingId ? <PendingReplySkeleton /> : null}
          </ScrollView>

          <View
            style={{
              paddingHorizontal: theme.spacing.xl,
              paddingBottom: insets.bottom + theme.spacing.md,
              gap: theme.spacing.md,
            }}
          >
            {error ? <FormError message={error.message} /> : null}

            {spent ? (
              <Button label="Start a new chat" onPress={startNew} />
            ) : failed ? (
              <Button label="Try again" variant="secondary" onPress={retry} />
            ) : null}

            <ChatComposer
              value={draft}
              onChangeText={setDraft}
              onSend={submit}
              disabled={spent}
              sending={pendingId !== null}
            />
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

function Header({
  title,
  titleJa,
  onNew,
  onLeave,
}: {
  title?: string;
  titleJa?: string;
  onNew?: () => void;
  onLeave: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: theme.hairlineWidth,
        borderBottomColor: theme.colors.hairline,
      }}
    >
      <Pressable
        onPress={onLeave}
        accessibilityRole="button"
        accessibilityLabel="Back to home"
        hitSlop={theme.spacing.md}
        style={({ pressed }) => ({
          paddingVertical: theme.spacing.sm,
          paddingRight: theme.spacing.lg,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            color: theme.colors.ai,
          }}
        >
          Done
        </Text>
      </Pressable>

      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            color: theme.colors.ink,
          }}
        >
          {title ?? 'Conversation'}
        </Text>
        {titleJa ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: theme.families.ja,
              fontSize: theme.fontSize.caption,
              color: theme.colors.inkSoft,
            }}
          >
            {titleJa}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={onNew}
        disabled={!onNew}
        accessibilityRole="button"
        accessibilityLabel="Start a new chat"
        hitSlop={theme.spacing.md}
        style={({ pressed }) => ({
          paddingVertical: theme.spacing.sm,
          paddingLeft: theme.spacing.lg,
          opacity: !onNew ? 0.4 : pressed ? 0.6 : 1,
        })}
      >
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            color: theme.colors.ai,
          }}
        >
          New
        </Text>
      </Pressable>
    </View>
  );
}
