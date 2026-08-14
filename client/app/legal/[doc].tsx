import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchLegalDoc, type LegalDocId } from '@/api/legal';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton, SkeletonGroup } from '@/components/Skeleton';
import { useTheme } from '@/theme';

/**
 * Privacy policy and terms of service, one screen for both — reachable
 * pre-login from the register screen and post-login from settings, so it
 * sits outside the `(auth)`/`(app)` route groups where neither layout's
 * status-based redirect can gate it.
 *
 * No markdown library: the two documents this renders (`legal.controller.ts`
 * on the server) only ever use `#`/`##` headers, `- ` bullets and `**bold**`
 * spans, so a full parser would be a dependency for three cases. `renderLine`
 * below is the whole of it, and it is meant to stay that small — a document
 * that needs a table or a nested list should get a real parser instead of
 * this one growing to fake it.
 */
export default function LegalDocScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc: LegalDocId }>();

  const query = useQuery({
    queryKey: ['legal', doc],
    queryFn: () => fetchLegalDoc(doc),
    staleTime: Infinity, // Static copy — no reason to refetch within a session.
  });

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: theme.spacing.xl,
        paddingTop: insets.top + theme.spacing.xl,
        paddingBottom: insets.bottom + theme.spacing.xxl,
        gap: theme.spacing.lg,
      }}
    >
      {query.isPending ? (
        <SkeletonGroup label="Loading document" fill>
          <Skeleton height={32} width="60%" />
          <Skeleton height={16} width="40%" />
          <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.md }}>
            <Skeleton height={16} />
            <Skeleton height={16} />
            <Skeleton height={16} width="80%" />
          </View>
        </SkeletonGroup>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} onDismiss={() => router.back()} />
      ) : (
        <>
          <View style={{ gap: theme.spacing.xs }}>
            <Text
              style={{
                fontFamily: theme.families.ui,
                fontSize: theme.fontSize.heading,
                lineHeight: theme.lineHeight.heading,
                color: theme.colors.ink,
              }}
            >
              {query.data.title}
            </Text>
            <Text
              style={{
                fontFamily: theme.families.ui,
                fontSize: theme.fontSize.small,
                color: theme.colors.inkSoft,
              }}
            >
              {`Effective ${query.data.effectiveDate}`}
            </Text>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            {query.data.content
              .trim()
              .split('\n')
              .map((line, index) => (
                <Fragment key={index}>{renderLine(line, theme)}</Fragment>
              ))}
          </View>

          <Button label="Back" variant="secondary" onPress={() => router.back()} />
        </>
      )}
    </ScrollView>
  );
}

function renderLine(line: string, theme: ReturnType<typeof useTheme>): React.ReactNode {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('## ')) {
    return (
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.title,
          lineHeight: theme.lineHeight.title,
          color: theme.colors.ink,
          fontWeight: '700',
          paddingTop: theme.spacing.md,
        }}
      >
        {trimmed.slice(3)}
      </Text>
    );
  }

  if (trimmed.startsWith('# ')) {
    return (
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.title,
          lineHeight: theme.lineHeight.title,
          color: theme.colors.ink,
          fontWeight: '700',
        }}
      >
        {trimmed.slice(2)}
      </Text>
    );
  }

  const isBullet = trimmed.startsWith('- ');
  const text = isBullet ? trimmed.slice(2) : trimmed;

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
      {isBullet ? (
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            lineHeight: theme.lineHeight.body,
            color: theme.colors.inkSoft,
          }}
        >
          {'•'}
        </Text>
      ) : null}
      <Text
        style={{
          flex: 1,
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          lineHeight: theme.lineHeight.body,
          color: theme.colors.inkSoft,
        }}
      >
        {renderBold(text)}
      </Text>
    </View>
  );
}

/** Splits `**bold**` spans out of an otherwise-plain line. */
function renderBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  if (parts.length === 1) return text;

  return parts.map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <Text key={index} style={{ fontWeight: '700' }}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}
