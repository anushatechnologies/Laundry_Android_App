import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '@/ui/components';
import { COLORS } from '@/ui/theme';

interface FAQItem {
  id: string;
  category: 'PICKUP' | 'PRICING' | 'CARE' | 'GUARANTEE';
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    id: 'f1',
    category: 'PICKUP',
    question: 'How does doorstep weighing work for bulk laundry?',
    answer:
      'Our executive carries calibrated digital hanging scales. When collecting your clothes, they weigh the laundry bag right in front of you and enter the exact weight in the app.',
  },
  {
    id: 'f2',
    category: 'PICKUP',
    question: 'Can I reschedule my pickup slot?',
    answer:
      'Yes! You can reschedule your pickup date or time window at any time before the rider arrives directly from the Orders tab or via WhatsApp support.',
  },
  {
    id: 'f3',
    category: 'CARE',
    question: 'How do you handle delicate Silk Sarees & Zari embroidery?',
    answer:
      'We use certified organic, non-solvent solutions that do not strip natural silk luster. Zari borders receive specialized roll polishing and are packed in acid-free breathable covers.',
  },
  {
    id: 'f4',
    category: 'GUARANTEE',
    question: 'What is the 100% Free Re-wash Guarantee?',
    answer:
      'If you are not 100% satisfied with the cleanliness, aroma, or crispness of your garments, report it within 24 hours of delivery and we will re-clean and steam-press your clothes completely free.',
  },
  {
    id: 'f5',
    category: 'PRICING',
    question: 'Are there any hidden delivery or convenience fees?',
    answer:
      'No! Doorstep collection and delivery is 100% FREE on all standard orders. We provide itemized GST-compliant invoices with full transparency.',
  },
];

export function HelpScreen() {
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'PICKUP' | 'PRICING' | 'CARE' | 'GUARANTEE'>('ALL');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('f1');
  const [issueText, setIssueText] = useState('');
  const [submittingIssue, setSubmittingIssue] = useState(false);

  const filteredFaqs = FAQS.filter((f) => {
    if (activeCategory === 'ALL') return true;
    return f.category === activeCategory;
  });

  const openWhatsApp = () => {
    const msg = 'Hi LaundryFresh Support, I have a question regarding my fabric care service.';
    void Linking.openURL(`whatsapp://send?phone=+919121999999&text=${encodeURIComponent(msg)}`);
  };

  const callSupport = () => {
    void Linking.openURL('tel:+919121999999');
  };

  const emailSupport = () => {
    void Linking.openURL('mailto:support@anushatechnologies.com?subject=LaundryFresh Support Request');
  };

  const handleTicketSubmit = () => {
    if (!issueText.trim()) {
      Alert.alert('Required', 'Please describe your query or issue.');
      return;
    }
    setSubmittingIssue(true);
    setTimeout(() => {
      setSubmittingIssue(false);
      setIssueText('');
      Alert.alert(
        'Ticket Created! 🎫',
        'Ticket #TCK-2026 has been registered. Our Quality Care Manager will contact you on WhatsApp within 15 minutes.'
      );
    }, 600);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* 1. TOP CONTACT CARDS */}
      <View style={styles.contactGrid}>
        <Pressable style={styles.contactTileWhatsApp} onPress={openWhatsApp}>
          <View style={styles.contactIconCircleWhatsApp}>
            <MaterialCommunityIcons name="whatsapp" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.contactTileTitleWhatsApp}>WhatsApp Chat</Text>
          <Text style={styles.contactTileSubWhatsApp}>Instant Reply • 7am-10pm</Text>
        </Pressable>

        <Pressable style={styles.contactTileCall} onPress={callSupport}>
          <View style={styles.contactIconCircleCall}>
            <MaterialCommunityIcons name="phone" size={22} color="#F97316" />
          </View>
          <Text style={styles.contactTileTitleCall}>Call Helpline</Text>
          <Text style={styles.contactTileSubCall}>+91 8522918866</Text>
        </Pressable>
      </View>

      {/* 2. QUALITY PROMISES BANNER */}
      <Card style={styles.guaranteeCard}>
        <View style={styles.guaranteeRow}>
          <MaterialCommunityIcons name="shield-check" size={24} color="#16A34A" />
          <View style={{ flex: 1 }}>
            <Text style={styles.guaranteeTitle}>LaundryFresh 100% Care Promise</Text>
            <Text style={styles.guaranteeSub}>
              Zero Color Bleed • Free Re-wash Guarantee • Safe Fabric Insurance
            </Text>
          </View>
        </View>
      </Card>

      {/* 3. FAQ SECTION */}
      <View style={styles.faqSection}>
        <Text style={styles.sectionHeaderTitle}>Frequently Asked Questions</Text>

        {/* Category Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
          {[
            { key: 'ALL', label: 'All FAQs' },
            { key: 'PICKUP', label: '🚚 Pickup & Delivery' },
            { key: 'CARE', label: '🧼 Fabric Care' },
            { key: 'PRICING', label: '💰 Pricing & Bill' },
            { key: 'GUARANTEE', label: '🛡️ Guarantee' },
          ].map((c) => {
            const isSelected = activeCategory === c.key;
            return (
              <Pressable
                key={c.key}
                style={[styles.catPill, isSelected && styles.catPillActive]}
                onPress={() => setActiveCategory(c.key as any)}
              >
                <Text style={[styles.catPillText, isSelected && styles.catPillTextActive]}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* FAQ Accordions */}
        <View style={styles.accordionStack}>
          {filteredFaqs.map((faq) => {
            const isExpanded = expandedFaqId === faq.id;
            return (
              <Card key={faq.id} style={styles.faqCard}>
                <Pressable
                  style={styles.faqQuestionRow}
                  onPress={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                >
                  <Text style={styles.faqQuestionText}>{faq.question}</Text>
                  <MaterialCommunityIcons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#F97316"
                  />
                </Pressable>

                {isExpanded && (
                  <View style={styles.faqAnswerBox}>
                    <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      </View>

      {/* 4. REPORT ISSUE / RE-WASH REQUEST FORM */}
      <Card style={styles.ticketCard}>
        <Text style={styles.ticketTitle}>Need a Free Re-Wash or Have a Feedback?</Text>
        <Text style={styles.ticketSubtitle}>
          Let our Master Garment Specialists resolve any stain or press quality concern.
        </Text>

        <TextInput
          style={styles.ticketInput}
          placeholder="Describe your issue or order ID (e.g. Collar crease on order #1042)..."
          placeholderTextColor="#A1A1AA"
          value={issueText}
          onChangeText={setIssueText}
          multiline
        />

        <Pressable
          style={[styles.submitTicketBtn, submittingIssue && { opacity: 0.7 }]}
          onPress={handleTicketSubmit}
          disabled={submittingIssue}
        >
          <MaterialCommunityIcons name="send" size={16} color="#FFFFFF" />
          <Text style={styles.submitTicketBtnText}>
            {submittingIssue ? 'Submitting...' : 'Submit Support Request'}
          </Text>
        </Pressable>
      </Card>

      {/* Email Link */}
      <Pressable style={styles.emailRow} onPress={emailSupport}>
        <MaterialCommunityIcons name="email-outline" size={18} color="#8A7A84" />
        <Text style={styles.emailText}>Email: support@anushatechnologies.com</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FCF9F7',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  contactGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  contactTileWhatsApp: {
    flex: 1,
    backgroundColor: '#16A34A',
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  contactIconCircleWhatsApp: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactTileTitleWhatsApp: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  contactTileSubWhatsApp: {
    fontSize: 12,
    color: '#DCFCE7',
    fontWeight: '700',
  },
  contactTileCall: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 6,
  },
  contactIconCircleCall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactTileTitleCall: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1C0B18',
  },
  contactTileSubCall: {
    fontSize: 12,
    color: '#8A7A84',
    fontWeight: '700',
  },
  guaranteeCard: {
    backgroundColor: '#FAF5EF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3E8DF',
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  guaranteeTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1C0B18',
  },
  guaranteeSub: {
    fontSize: 11,
    color: '#4A3B45',
    marginTop: 2,
  },
  faqSection: {
    gap: 10,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1C0B18',
  },
  pillsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DED6',
  },
  catPillActive: {
    backgroundColor: '#1C0B18',
    borderColor: '#1C0B18',
  },
  catPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#8A7A84',
  },
  catPillTextActive: {
    color: '#FFFFFF',
  },
  accordionStack: {
    gap: 8,
    marginTop: 6,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3E8DF',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#1C0B18',
    lineHeight: 21,
  },
  faqAnswerBox: {
    paddingTop: 12,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F7F2EE',
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#4A3B45',
    lineHeight: 21,
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 10,
  },
  ticketTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1C0B18',
  },
  ticketSubtitle: {
    fontSize: 11,
    color: '#8A7A84',
    lineHeight: 15,
  },
  ticketInput: {
    backgroundColor: '#FAF5EF',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#1C0B18',
    minHeight: 70,
    borderWidth: 1,
    borderColor: '#E8DED6',
    textAlignVertical: 'top',
  },
  submitTicketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  submitTicketBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  emailText: {
    fontSize: 12,
    color: '#8A7A84',
    fontWeight: '700',
  },
});
