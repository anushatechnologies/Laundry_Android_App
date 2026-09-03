import React, { useState } from 'react';
import {
  Alert,
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

interface RatingScreenProps {
  orderId?: string;
  onComplete: () => void;
}

const COMPLIMENT_TAGS = [
  { id: 'c1', label: '👔 Crisp Steam Press' },
  { id: 'c2', label: '🌸 Fresh Scent' },
  { id: 'c3', label: '🧼 Deep Stain Removal' },
  { id: 'c4', label: '🚚 Punctual Rider' },
  { id: 'c5', label: '😊 Polite Behavior' },
  { id: 'c6', label: '🛡️ Safe Fabric Packaging' },
];

const TIP_OPTIONS = [0, 20, 50, 100];

export function RatingScreen({ orderId = 'ORD-1042', onComplete }: RatingScreenProps) {
  const [stars, setStars] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(['c1', 'c2']);
  const [selectedTip, setSelectedTip] = useState(20);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (id: string) => {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const getStarHeadline = (s: number) => {
    switch (s) {
      case 5:
        return 'Exceptional 5-Star Service! 🌟';
      case 4:
        return 'Very Good Quality & Care! 👍';
      case 3:
        return 'Good & Satisfactory 🙂';
      case 2:
        return 'Could Be Better 😕';
      default:
        return 'Needs Serious Improvement ⚠️';
    }
  };

  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      Alert.alert(
        'Feedback Submitted! 🎉',
        `Thank you for rating your experience ${stars} stars! ${
          selectedTip > 0 ? `Your ₹${selectedTip} tip has been sent directly to the rider.` : ''
        }`,
        [{ text: 'Done', onPress: onComplete }]
      );
    }, 600);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* 1. ORDER SUMMARY CARD */}
      <Card style={styles.orderCard}>
        <Text style={styles.orderLabel}>RATING ORDER</Text>
        <Text style={styles.orderId}>#{orderId}</Text>
        <Text style={styles.orderDesc}>Delivered by Ramesh K. (Executive)</Text>
      </Card>

      {/* 2. STAR RATING SECTION */}
      <Card style={styles.starCard}>
        <Text style={styles.starHeadline}>{getStarHeadline(stars)}</Text>
        <Text style={styles.starSub}>Tap a star to rate your garment cleanliness and delivery</Text>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => setStars(star)} hitSlop={10}>
              <MaterialCommunityIcons
                name={stars >= star ? 'star' : 'star-outline'}
                size={40}
                color="#F59E0B"
              />
            </Pressable>
          ))}
        </View>
      </Card>

      {/* 3. COMPLIMENT CHIPS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What did you like most?</Text>

        <View style={styles.tagsGrid}>
          {COMPLIMENT_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag.id);
            return (
              <Pressable
                key={tag.id}
                style={[styles.tagChip, isSelected && styles.tagChipActive]}
                onPress={() => toggleTag(tag.id)}
              >
                <Text style={[styles.tagChipText, isSelected && styles.tagChipTextActive]}>
                  {tag.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 4. RIDER TIP SELECTOR */}
      <Card style={styles.tipCard}>
        <View style={styles.tipHeaderRow}>
          <View>
            <Text style={styles.tipTitle}>Tip Your Delivery Executive</Text>
            <Text style={styles.tipSub}>100% of your tip goes directly to Ramesh</Text>
          </View>
          <MaterialCommunityIcons name="heart-circle" size={32} color="#EF4444" />
        </View>

        <View style={styles.tipPillsRow}>
          {TIP_OPTIONS.map((tip) => {
            const isSelected = selectedTip === tip;
            return (
              <Pressable
                key={tip}
                style={[styles.tipPill, isSelected && styles.tipPillActive]}
                onPress={() => setSelectedTip(tip)}
              >
                <Text style={[styles.tipPillText, isSelected && styles.tipPillTextActive]}>
                  {tip === 0 ? 'No Tip' : `₹${tip}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* 5. WRITTEN REVIEW INPUT */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Write a Review (Optional)</Text>
        <TextInput
          style={styles.reviewInput}
          placeholder="Share details about your fabric feel, scent, or ironing quality..."
          placeholderTextColor="#A1A1AA"
          value={reviewText}
          onChangeText={setReviewText}
          multiline
        />
      </View>

      {/* 6. SUBMIT BUTTON */}
      <Pressable
        style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.submitBtnText}>
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </Text>
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
  orderCard: {
    backgroundColor: '#1C0B18',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    gap: 2,
  },
  orderLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D6B36A',
    letterSpacing: 0.5,
  },
  orderId: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  orderDesc: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  starCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    alignItems: 'center',
    gap: 6,
  },
  starHeadline: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1C0B18',
  },
  starSub: {
    fontSize: 11,
    color: '#8A7A84',
    textAlign: 'center',
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1C0B18',
    letterSpacing: -0.2,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F3E8DF',
  },
  tagChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#F97316',
    borderWidth: 1.5,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4A3B45',
  },
  tagChipTextActive: {
    color: '#EA580C',
  },
  tipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 14,
  },
  tipHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  tipSub: {
    fontSize: 11,
    color: '#8A7A84',
    marginTop: 2,
  },
  tipPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tipPill: {
    flex: 1,
    backgroundColor: '#FAF5EF',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8DED6',
  },
  tipPillActive: {
    backgroundColor: '#1C0B18',
    borderColor: '#1C0B18',
  },
  tipPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C0B18',
  },
  tipPillTextActive: {
    color: '#FFFFFF',
  },
  reviewInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    fontSize: 13,
    color: '#1C0B18',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#F97316',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
