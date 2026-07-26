import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  blockUser,
  fetchMessages,
  REPORT_REASONS,
  reportUser,
  sendMessage,
  type ReportReason,
} from '@/api/social';
import { ChatBubble } from '@/components/ChatBubble';
import { ChatComposer } from '@/components/ChatComposer';
import { ErrorState } from '@/components/ErrorState';
import { FormError } from '@/components/FormError';
import { errorText } from '@/lib/errors';
import { tapFeedback } from '@/lib/haptics';
import { useTheme } from '@/theme';

/**
 * One conversation with one friend.
 *
 * Reuses `ChatBubble` and `ChatComposer` from the AI tutor screen — a message
 * bubble is a message bubble, and the two screens looking identical is correct
 * rather than lazy.
 *
 * **Block and report live here**, not buried in a profile screen. The moment
 * someone needs them is the moment they are reading something they did not want
 * to read, and making them navigate away to find the control is how those
 * controls end up unused.
 */
export default function DirectMessages() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const [draft, setDraft] = useState('');

  const messages = useQuery({
    queryKey: ['dm', userId],
    queryFn: () => fetchMessages(userId),
    // A conversation moves while you are looking at it. Refetching on focus is
    // the closest thing to live without opening a socket.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const send = useMutation({
    mutationFn: (text: string) => sendMessage(userId, text),
    onSuccess: () => {
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: ['dm', userId] });
    },
  });

  const block = useMutation({
    mutationFn: () => blockUser(userId),
    onSuccess: () => {
      // Blocking removes the friendship server-side, so both lists are stale.
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
      void queryClient.invalidateQueries({ queryKey: ['dm', userId] });
      router.back();
    },
  });

  const report = useMutation({
    mutationFn: (reason: ReportReason) => reportUser({ userId, reason }),
    onSuccess: () =>
      Alert.alert(
        'Report sent',
        'Thanks — this has been recorded. Block them too if you would rather not hear from them again.',
      ),
  });

  function submit() {
    const text = draft.trim();
    if (text.length === 0 || send.isPending) return;
    tapFeedback();
    send.mutate(text);
  }

  function confirmBlock() {
    Alert.alert(
      'Block this person?',
      'They will not be able to message you, and you will stop being friends. You can undo this in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => block.mutate() },
      ],
    );
  }

  function chooseReportReason() {
    Alert.alert('Report this person', 'What is the problem?', [
      ...REPORT_REASONS.map((reason) => ({
        text: reason.label,
        onPress: () => report.mutate(reason.value),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.paper }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.xl,
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: theme.spacing.md,
          borderBottomWidth: theme.hairlineWidth,
          borderBottomColor: theme.colors.hairline,
        }}
      >
        <HeaderLink label="← Back" onPress={() => router.back()} />
        <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
          <HeaderLink label="Report" onPress={chooseReportReason} />
          <HeaderLink label="Block" onPress={confirmBlock} danger />
        </View>
      </View>

      {messages.isPending ? (
        <Centered>
          <Text style={mutedStyle(theme)}>Loading…</Text>
        </Centered>
      ) : messages.isError ? (
        <Centered>
          <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />
        </Centered>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: theme.spacing.xl,
            gap: theme.spacing.md,
            flexGrow: 1,
            justifyContent: messages.data.length === 0 ? 'center' : 'flex-end',
          }}
        >
          {messages.data.length === 0 ? (
            <Text style={[mutedStyle(theme), { textAlign: 'center' }]}>
              No messages yet. Say hello — in Japanese, if you are feeling brave.
            </Text>
          ) : (
            messages.data.map((message) => (
              <ChatBubble
                key={message.id}
                // `mine` maps onto the tutor screen's user/assistant split, so
                // the same component lays both conversations out.
                role={message.mine ? 'user' : 'assistant'}
                text={message.text}
              />
            ))
          )}
        </ScrollView>
      )}

      <View
        style={{
          paddingHorizontal: theme.spacing.xl,
          paddingBottom: insets.bottom + theme.spacing.md,
          gap: theme.spacing.sm,
        }}
      >
        {send.isError ? <FormError message={errorText(send.error)} /> : null}
        <ChatComposer
          value={draft}
          onChangeText={setDraft}
          onSend={submit}
          sending={send.isPending}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function HeaderLink({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label.replace('← ', '')}
      hitSlop={theme.spacing.md}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          color: danger ? theme.colors.danger : theme.colors.ai,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xl,
        gap: theme.spacing.lg,
      }}
    >
      {children}
    </View>
  );
}

function mutedStyle(theme: ReturnType<typeof useTheme>) {
  return {
    fontFamily: theme.families.ui,
    fontSize: theme.fontSize.body,
    lineHeight: theme.lineHeight.body,
    color: theme.colors.inkSoft,
  };
}
