import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  acceptRequest,
  declineRequest,
  fetchFriends,
  fetchRequests,
  searchUsers,
  sendFriendRequest,
  type PublicProfile,
} from '@/api/social';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { FormError } from '@/components/FormError';
import { TextField } from '@/components/TextField';
import { errorText } from '@/lib/errors';
import { useTheme } from '@/theme';

/**
 * Friends: incoming requests, your friends, and a search to find more.
 *
 * Requests come first and only when there are any — an empty "Requests (0)"
 * heading is a permanent reminder of nothing. Search is last, because someone
 * opening this screen usually wants to message a friend they already have, not
 * find a new one.
 */
export default function Friends() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState<PublicProfile[] | null>(null);
  const [searchError, setSearchError] = useState<string>();

  const friends = useQuery({ queryKey: ['friends'], queryFn: fetchFriends, staleTime: 0 });
  const requests = useQuery({ queryKey: ['friendRequests'], queryFn: fetchRequests, staleTime: 0 });

  /**
   * Accepting or declining changes both lists, so both are invalidated. Not
   * optimistic: the row vanishing before the server agrees would be a lie if the
   * request had already been withdrawn.
   */
  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      accept ? acceptRequest(id) : declineRequest(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
      void queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
    },
  });

  const request = useMutation({
    mutationFn: (userId: string) => sendFriendRequest(userId),
    onSuccess: () => {
      // An immediate accept is possible when they had already asked you.
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
      void queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
    },
  });

  const search = useMutation({
    mutationFn: (q: string) => searchUsers(q),
    onSuccess: (results) => {
      setSearched(results);
      setSearchError(undefined);
    },
    onError: (error: unknown) => setSearchError(errorText(error)),
  });

  function runSearch() {
    const trimmed = query.trim();
    // Mirrors the server's floor so a one-character search does not cost a round
    // trip and one of the 20-per-minute the route allows.
    if (trimmed.length < 2) {
      setSearchError('Type at least two characters to search.');
      return;
    }
    search.mutate(trimmed);
  }

  const refreshing = friends.isRefetching || requests.isRefetching;

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: theme.spacing.xl,
        paddingTop: insets.top + theme.spacing.xl,
        paddingBottom: insets.bottom + theme.spacing.xl,
        gap: theme.spacing.xxl,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void friends.refetch();
            void requests.refetch();
          }}
          tintColor={theme.colors.inkSoft}
        />
      }
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.heading,
            lineHeight: theme.lineHeight.heading,
            color: theme.colors.ink,
          }}
        >
          Friends
        </Text>
        {/* The league lives behind the friends screen rather than on home: it is
            the same "other people" idea, and home already carries four cards. */}
        <Pressable
          onPress={() => router.push('/leaderboard')}
          accessibilityRole="button"
          accessibilityLabel="This week's league table"
          hitSlop={theme.spacing.md}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.body,
              color: theme.colors.ai,
            }}
          >
            League
          </Text>
        </Pressable>
      </View>

      {requests.data && requests.data.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeading label={`Requests (${requests.data.length})`} />
          {requests.data.map((item) => (
            <View
              key={item.requestId}
              style={{
                gap: theme.spacing.sm,
                paddingVertical: theme.spacing.lg,
                borderBottomWidth: theme.hairlineWidth,
                borderBottomColor: theme.colors.hairline,
              }}
            >
              <PersonLine person={item.from} />
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Accept"
                    onPress={() => respond.mutate({ id: item.requestId, accept: true })}
                    loading={respond.isPending}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Decline"
                    variant="secondary"
                    onPress={() => respond.mutate({ id: item.requestId, accept: false })}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        <SectionHeading label="Your friends" />
        {friends.isPending ? (
          <Muted>Loading…</Muted>
        ) : friends.isError ? (
          <ErrorState error={friends.error} onRetry={() => void friends.refetch()} />
        ) : friends.data.length === 0 ? (
          <Muted>
            No friends yet. Search for someone below — you can only message people who accept.
          </Muted>
        ) : (
          friends.data.map((person) => (
            <Pressable
              key={person.id}
              onPress={() => router.push(`/dm/${person.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Message ${person.displayName}`}
              style={({ pressed }) => ({
                paddingVertical: theme.spacing.lg,
                borderBottomWidth: theme.hairlineWidth,
                borderBottomColor: theme.colors.hairline,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <PersonLine person={person} />
            </Pressable>
          ))
        )}
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <SectionHeading label="Find someone" />
        <TextField
          label="Search by name"
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            if (searchError) setSearchError(undefined);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={runSearch}
          editable={!search.isPending}
        />
        <Button label="Search" onPress={runSearch} loading={search.isPending} />

        {searchError ? <FormError message={searchError} /> : null}

        {searched !== null && searched.length === 0 && !searchError ? (
          <Muted>Nobody by that name. Names are matched from the start.</Muted>
        ) : null}

        {searched?.map((person) => (
          <View
            key={person.id}
            style={{
              gap: theme.spacing.sm,
              paddingVertical: theme.spacing.md,
              borderBottomWidth: theme.hairlineWidth,
              borderBottomColor: theme.colors.hairline,
            }}
          >
            <PersonLine person={person} />
            <Button
              label="Add friend"
              variant="secondary"
              onPress={() => request.mutate(person.id)}
              loading={request.isPending}
            />
          </View>
        ))}

        {request.isError ? <FormError message={errorText(request.error)} /> : null}
      </View>
    </ScrollView>
  );
}

/** Name, plus the two numbers that make a stranger feel like a real learner. */
function PersonLine({ person }: { person: PublicProfile }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.bodyLarge,
          color: theme.colors.ink,
        }}
      >
        {person.displayName}
      </Text>
      <Text
        style={[
          {
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.small,
            color: theme.colors.inkSoft,
          },
          theme.tabularFigures,
        ]}
      >
        Level {person.level} · {person.xp} XP
        {person.streakDays > 0 ? ` · ${person.streakDays} day streak` : ''}
      </Text>
    </View>
  );
}

function SectionHeading({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <Text
      style={{
        fontFamily: theme.families.ui,
        fontSize: theme.fontSize.caption,
        color: theme.colors.inkSoft,
        textTransform: 'uppercase',
        letterSpacing: 1,
      }}
    >
      {label}
    </Text>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <Text
      style={{
        fontFamily: theme.families.ui,
        fontSize: theme.fontSize.body,
        lineHeight: theme.lineHeight.body,
        color: theme.colors.inkSoft,
      }}
    >
      {children}
    </Text>
  );
}
