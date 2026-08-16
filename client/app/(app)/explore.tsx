import { useRouter } from 'expo-router';
import { ScrollView, Text, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

type Destination = { title: string; detail: string; route?: '/review' | '/chat' | '/combined-test' | '/friends' | '/leaderboard' | '/settings' };
const groups: { title: string; items: Destination[] }[] = [
  { title: 'LEARN & PRACTISE', items: [
    { title: 'Lessons & Courses', detail: 'Continue the structured Japanese path', route: '/settings' },
    { title: 'Spaced Review', detail: 'Complete cards scheduled by the API', route: '/review' },
    { title: 'AI Tutor', detail: 'Ask questions in an authenticated study chat', route: '/chat' },
    { title: 'Combined Tests', detail: 'Assess completed learning units', route: '/combined-test' },
  ] },
  { title: 'PROGRESS & COMMUNITY', items: [
    { title: 'Leaderboard', detail: 'View weekly learning activity', route: '/leaderboard' },
    { title: 'Friends & Messages', detail: 'Connect with other learners', route: '/friends' },
    { title: 'Learning Settings', detail: 'Appearance, notifications, privacy, and export', route: '/settings' },
  ] },
  { title: 'EXPANDING MOBILE PARITY', items: [
    { title: 'JLPT, Exams & Dictionary', detail: 'Mobile API and screen contracts are being added.' },
    { title: 'Reading, Listening & Writing', detail: 'Dedicated mobile experiences are being added.' },
    { title: 'Billing, Certificates & Advanced Analytics', detail: 'These remain server-authorized and will appear once mobile contracts are available.' },
  ] },
];

export default function Explore() {
  const theme = useTheme(); const insets = useSafeAreaInsets(); const router = useRouter();
  return <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, paddingTop: insets.top + theme.spacing.xl, paddingBottom: insets.bottom + theme.spacing.xl, gap: theme.spacing.xl, backgroundColor: theme.colors.paper }}>
    <View><Text style={{ fontFamily: theme.families.ui, color: theme.colors.inkSoft, fontSize: theme.fontSize.caption, letterSpacing: 1 }}>MOBILE LEARNING HUB</Text><Text style={{ marginTop: 4, fontFamily: theme.families.ui, color: theme.colors.ink, fontSize: theme.fontSize.heading, fontWeight: '700' }}>Explore GENKŌ</Text><Text style={{ marginTop: 6, fontFamily: theme.families.ui, color: theme.colors.inkSoft, fontSize: theme.fontSize.small, lineHeight: theme.lineHeight.small }}>Your mobile experience uses the same authenticated learning API as the web app.</Text></View>
    {groups.map(group => <View key={group.title} style={{ gap: theme.spacing.sm }}><Text style={{ fontFamily: theme.families.ui, color: theme.colors.inkSoft, fontSize: theme.fontSize.caption, letterSpacing: .8 }}>{group.title}</Text>{group.items.map(item => <Pressable key={item.title} disabled={!item.route} onPress={() => item.route && router.push(item.route)} style={({ pressed }) => ({ opacity: pressed ? .75 : item.route ? 1 : .64, padding: theme.spacing.lg, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: theme.hairlineWidth, borderColor: theme.colors.hairline })}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}><View style={{ flex: 1 }}><Text style={{ color: theme.colors.ink, fontFamily: theme.families.ui, fontSize: theme.fontSize.body, fontWeight: '700' }}>{item.title}</Text><Text style={{ marginTop: 4, color: theme.colors.inkSoft, fontFamily: theme.families.ui, fontSize: theme.fontSize.small, lineHeight: theme.lineHeight.small }}>{item.detail}</Text></View><Text style={{ color: item.route ? theme.colors.ink : theme.colors.inkSoft, fontSize: 20 }}>{item.route ? '›' : '○'}</Text></View></Pressable>)}</View>)}
  </ScrollView>;
}
