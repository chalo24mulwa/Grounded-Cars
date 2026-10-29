import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

// Mirrors src/app/(public)/contact/page.tsx's TOPICS exactly, same
// WhatsApp/phone numbers from site config — no API, since the website's
// contact page itself has none (every "channel" is just a WhatsApp/tel
// deep link, not a form with a backend).
const WHATSAPP_NUMBER = '254727919076';
const CONTACT_PHONE = '+254727919076';

const TOPICS = [
  {
    title: 'Buy a grounded or salvage car',
    description: 'Looking to buy a grounded or salvage vehicle directly from Grounded Cars?',
    message: "Hi, I'd like to buy a grounded or salvage car from Grounded Cars.",
  },
  {
    title: 'Sell a grounded or salvage car',
    description: 'Grounded Cars buys grounded and salvage vehicles directly — tell us about yours.',
    message: "Hi, I have a grounded or salvage car I'd like to sell to Grounded Cars.",
  },
  {
    title: 'Auction vehicle enquiries',
    description: 'Questions about an auction car listed on the marketplace.',
    message: 'Hi, I have a question about an auction vehicle on Grounded Cars.',
  },
  {
    title: 'Old-school vehicle enquiries',
    description: 'Looking for, or have questions about, an old-school/classic car.',
    message: 'Hi, I have a question about an old-school car on Grounded Cars.',
  },
  {
    title: 'List your vehicle for free',
    description: 'Sell through the marketplace — listing a vehicle is free.',
    message: "Hi, I'd like help listing my vehicle for free on Grounded Cars.",
  },
  {
    title: 'General marketplace support',
    description: 'Anything else — account help, a listing question, or general support.',
    message: 'Hi, I need help with something on Grounded Cars.',
  },
];

export default function ContactScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Talk to Grounded Cars
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          Whether you want to buy or sell a grounded, salvage, auction, or old-school vehicle, list
          your car for free, or just need help — reach us directly below.
        </ThemedText>

        {TOPICS.map((topic) => (
          <View key={topic.title} style={[styles.card, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{topic.title}</ThemedText>
            <ThemedText themeColor="textSecondary" type="small" style={styles.cardDescription}>
              {topic.description}
            </ThemedText>
            <View style={styles.cardActions}>
              <Pressable
                style={[styles.chatButton, { backgroundColor: theme.brand }]}
                onPress={() =>
                  Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(topic.message)}`)
                }
              >
                <ThemedText style={styles.chatButtonText}>Chat on WhatsApp</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.callButton, { borderColor: theme.brand }]}
                onPress={() => Linking.openURL(`tel:${CONTACT_PHONE}`)}
              >
                <ThemedText themeColor="brand" type="small" style={styles.callButtonText}>
                  Call us
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ))}

        <View style={[styles.directCallBox, { borderColor: theme.brand, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">Prefer to call directly?</ThemedText>
          <ThemedText themeColor="brand" style={styles.directCallNumber}>
            {CONTACT_PHONE}
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, paddingBottom: Spacing.six },
  title: { fontSize: 26, marginBottom: Spacing.two },
  subtitle: { marginBottom: Spacing.five },
  card: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, marginBottom: Spacing.three },
  cardDescription: { marginTop: 2, marginBottom: Spacing.three },
  cardActions: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  chatButton: { borderRadius: 8, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  chatButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  callButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  callButtonText: { fontWeight: '700' },
  directCallBox: { borderWidth: 1, borderRadius: 12, padding: Spacing.four, alignItems: 'center', marginTop: Spacing.three },
  directCallNumber: { fontSize: 18, fontWeight: '700', marginTop: Spacing.one },
});
