import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/ui/theme';
import { api } from '@/lib/api';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';

interface ChatMessage {
  id: string;
  roomId?: string;
  senderId: string;
  senderType: 'CUSTOMER' | 'AGENT';
  message: string;
  messageType?: 'TEXT' | 'IMAGE' | 'FILE';
  attachmentUrl?: string;
  createdAt: string;
  time?: string;
  isRead?: boolean;
}

const CHAT_ROOM_KEY = (id?: string) => `@laundryfresh_chat_room_${id || 'anon'}`;
const CHAT_MSGS_KEY = (id?: string) => `@laundryfresh_chat_msgs_${id || 'anon'}`;



interface LiveChatSupportScreenProps {
  onBack?: () => void;
}

export function LiveChatSupportScreen({ onBack }: LiveChatSupportScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const { session } = useApp();
  const { colors, isDark } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [agentOnline, setAgentOnline] = useState(true);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const customerId = session?.user?.id;

  // Track keyboard visibility for smooth padding bottom
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const normalizeMessage = (msg: any): ChatMessage => {
    const createdAt = msg.createdAt || msg.created_at || new Date().toISOString();
    const rawType = String(msg.senderType || msg.sender_type || 'CUSTOMER').toUpperCase();
    const senderType = (rawType.includes('AGENT') || rawType.includes('ADMIN')) ? 'AGENT' : 'CUSTOMER';
    return {
      ...msg,
      id: String(msg.id || `msg-${Date.now()}-${Math.random()}`),
      roomId: msg.roomId || msg.room_id,
      senderId: String(msg.senderId || msg.sender_id || ''),
      senderType,
      message: msg.message || '',
      messageType: msg.messageType || msg.message_type || 'TEXT',
      attachmentUrl: msg.attachmentUrl || msg.attachment_url,
      isRead: Boolean(msg.isRead ?? msg.is_read),
      createdAt,
      time: msg.time || (createdAt ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''),
    };
  };

  // Instant 0ms cache hydration + silent background sync (never blocks the screen)
  useEffect(() => {
    if (!customerId) return;

    let isMounted = true;

    // 1. Instant 0ms hydration from local cache
    const hydrateLocalCache = async () => {
      try {
        const [savedRoom, savedMsgs] = await Promise.all([
          AsyncStorage.getItem(CHAT_ROOM_KEY(customerId)),
          AsyncStorage.getItem(CHAT_MSGS_KEY(customerId)),
        ]);
        if (savedRoom && isMounted) {
          setRoomId(savedRoom);
        }
        if (savedMsgs && isMounted) {
          const parsed = JSON.parse(savedMsgs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        }
      } catch (err) {
        console.warn('[Chat] Failed to read local chat cache:', err);
      }
    };

    void hydrateLocalCache();

    // 2. Silently sync room & messages in the background without blocking the UI
    const syncChatBackground = async () => {
      try {
        setIsInitializing(true);
        const roomResponse = await api.createChatRoom(customerId, 'Customer Support');
        const room = (roomResponse as any)?.data || roomResponse;
        
        if (room && room.id && isMounted) {
          setRoomId(room.id);
          void AsyncStorage.setItem(CHAT_ROOM_KEY(customerId), room.id);

          const messagesResponse = await api.getChatMessages(room.id, 50, 0);
          const rawList = Array.isArray(messagesResponse)
            ? messagesResponse
            : (messagesResponse as any)?.data || [];
          
          if (Array.isArray(rawList) && isMounted) {
            const formatted = rawList.map(normalizeMessage);
            if (formatted.length > 0) {
              setMessages(formatted);
              void AsyncStorage.setItem(CHAT_MSGS_KEY(customerId), JSON.stringify(formatted));
            }
          }
        }
      } catch (error) {
        console.warn('[Chat] Background sync error:', error);
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    };

    void syncChatBackground();

    return () => {
      isMounted = false;
    };
  }, [customerId]);

  // Poll for new messages every 4 seconds in the background
  useEffect(() => {
    if (!roomId) return;

    const pollMessages = async () => {
      try {
        const messagesResponse = await api.getChatMessages(roomId, 50, 0);
        const rawList = Array.isArray(messagesResponse)
          ? messagesResponse
          : (messagesResponse as any)?.data || [];

        if (Array.isArray(rawList)) {
          const formattedMessages = rawList.map(normalizeMessage);
          
          if (
            formattedMessages.length !== messagesRef.current.length ||
            JSON.stringify(formattedMessages) !== JSON.stringify(messagesRef.current)
          ) {
            setMessages(formattedMessages);
            if (customerId) {
              void AsyncStorage.setItem(CHAT_MSGS_KEY(customerId), JSON.stringify(formattedMessages));
            }
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        }
      } catch (error) {
        // silent polling error
      }
    };

    const interval = setInterval(pollMessages, 4000);
    return () => clearInterval(interval);
  }, [roomId, customerId]);

  const handleClearChat = () => {
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to clear all messages in this chat? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              setClearing(true);
              setMessages([]);
              if (customerId) {
                await AsyncStorage.removeItem(CHAT_MSGS_KEY(customerId));
              }
              if (roomId) {
                await api.clearChatMessages(roomId).catch(() => {});
              }
            } catch (err: any) {
              console.error('Error clearing messages:', err);
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    if (!customerId) {
      Alert.alert('Sign In Required', 'Please sign in to chat with our Care Support team.');
      return;
    }

    const messageText = text.trim();
    setInputText('');

    // Instant optimistic user message in 0ms!
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      senderId: customerId,
      senderType: 'CUSTOMER',
      message: messageText,
      createdAt: new Date().toISOString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = [...messagesRef.current, userMsg];
    setMessages(updated);
    if (customerId) {
      void AsyncStorage.setItem(CHAT_MSGS_KEY(customerId), JSON.stringify(updated));
    }

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    // Background asynchronous delivery to server (never freezes the user)
    void (async () => {
      try {
        let currentRoomId = roomId;
        if (!currentRoomId) {
          const roomRes = await api.createChatRoom(customerId, 'Customer Support');
          const room = (roomRes as any)?.data || roomRes;
          if (room && room.id) {
            const newRoomId = String(room.id);
            currentRoomId = newRoomId;
            setRoomId(newRoomId);
            void AsyncStorage.setItem(CHAT_ROOM_KEY(customerId), newRoomId);
          }
        }

        if (currentRoomId) {
          await api.saveChatMessage({
            roomId: currentRoomId,
            senderId: customerId,
            senderType: 'CUSTOMER',
            message: messageText,
            messageType: 'TEXT',
          });
        }
      } catch (err) {
        console.warn('[Chat] Background send message error:', err);
      }
    })();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 80}
    >
      {/* 1. AGENT STATUS & NAVIGATION HEADER */}
      <View style={[styles.agentHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {onBack && (
          <Pressable
            style={styles.backBtn}
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Back"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textHeading} />
          </Pressable>
        )}

        <View style={styles.agentAvatarBox}>
          <MaterialCommunityIcons name="face-agent" size={22} color="#16A34A" />
          <View style={[styles.onlineBadge, !agentOnline && styles.offlineBadge]} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.agentName, { color: colors.textHeading }]}>RAMYA. • Fabric Specialist</Text>
          <View style={styles.statusRow}>
            <View style={styles.connectedDot} />
            <Text style={styles.agentStatus}>
              {agentOnline ? 'Active Now' : 'Away • We\'ll respond soon'}
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.clearChatBtn}
          onPress={handleClearChat}
          disabled={clearing}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Clear chat messages"
        >
          {clearing ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#EF4444" />
          )}
        </Pressable>

        <Pressable
          style={styles.whatsAppEscalateBtn}
          onPress={() => Linking.openURL('whatsapp://send?phone=+919121999999')}
          accessibilityLabel="Chat on WhatsApp"
        >
          <MaterialCommunityIcons name="whatsapp" size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* 2. CHAT STREAM */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isUser = item.senderType === 'CUSTOMER';
          return (
            <View style={[styles.bubbleWrap, isUser ? styles.bubbleWrapUser : styles.bubbleWrapAgent]}>
              <View
                style={[
                  styles.bubble,
                  isUser
                    ? styles.bubbleUser
                    : [styles.bubbleAgent, { backgroundColor: colors.surface, borderColor: colors.border }],
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    isUser ? styles.bubbleTextUser : [styles.bubbleTextAgent, { color: colors.textHeading }],
                  ]}
                >
                  {item.message}
                </Text>
                <View style={styles.bubbleFooter}>
                  <Text
                    style={[
                      styles.bubbleTime,
                      isUser ? styles.bubbleTimeUser : [styles.bubbleTimeAgent, { color: colors.textCaption }],
                    ]}
                  >
                    {item.time}
                  </Text>
                  {isUser && item.isRead && (
                    <MaterialCommunityIcons name="check-all" size={14} color="rgba(255, 255, 255, 0.7)" style={{ marginLeft: 4 }} />
                  )}
                </View>
              </View>
            </View>
          );
        }}

        ListEmptyComponent={
          isInitializing ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={[styles.emptySubtitle, { color: colors.textCaption, marginTop: 8 }]}>
                Connecting with Ramya...
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="chat-processing-outline" size={48} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.textHeading }]}>Chat with Care Support</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textCaption }]}>
                Send a message or select a prompt below. Our team is here to help!
              </Text>
            </View>
          )
        }
      />

      {/* 3. TEXT INPUT BAR */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <TextInput
          style={[
            styles.textInput,
            { backgroundColor: isDark ? colors.section : '#FAF5EF', borderColor: colors.border, color: colors.textHeading },
          ]}
          placeholder="Ask a question about your garments..."
          placeholderTextColor={colors.textCaption}
          value={inputText}
          onChangeText={handleInputChange}
          onFocus={() => {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 250);
          }}
          onSubmitEditing={() => sendMessage(inputText)}
        />
        <Pressable 
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]} 
          onPress={() => sendMessage(inputText)}
          disabled={!inputText.trim()}
          accessibilityLabel="Send message"
        >
          <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FCF9F7',
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#F3E8DF',
    gap: 10,
  },
  backBtn: {
    paddingRight: 6,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentAvatarBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  offlineBadge: {
    backgroundColor: '#9CA3AF',
  },
  agentName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C0B18',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  agentStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  clearChatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsAppEscalateBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  bubbleWrap: {
    width: '100%',
    flexDirection: 'row',
  },
  bubbleWrapUser: {
    justifyContent: 'flex-end',
  },
  bubbleWrapAgent: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: '#16A34A',
    borderBottomRightRadius: 4,
  },
  bubbleAgent: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#F3E8DF',
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  bubbleTextUser: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bubbleTextAgent: {
    color: '#1C0B18',
    fontWeight: '500',
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  bubbleTime: {
    fontSize: 10,
    fontWeight: '600',
  },
  bubbleTimeUser: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  bubbleTimeAgent: {
    color: '#8A7A84',
  },
  typingBox: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  typingText: {
    fontSize: 11,
    color: '#8A7A84',
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C0B18',
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#8A7A84',
    textAlign: 'center',
    maxWidth: 240,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#F3E8DF',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#FAF5EF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 13,
    color: '#1C0B18',
    borderWidth: 1,
    borderColor: '#E8DED6',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#D1D5DB',
    opacity: 0.5,
  },
});
