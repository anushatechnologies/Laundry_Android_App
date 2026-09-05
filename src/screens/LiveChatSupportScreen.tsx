import React, { useState, useEffect, useRef } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '@/ui/components';
import { COLORS } from '@/ui/theme';
import { useChatSocket } from '@/lib/chatSocket';
import { api } from '@/lib/api';
import { useApp } from '@/context/AppContext';

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

const QUICK_PROMPTS = [
  'Where is my pickup rider?',
  'I need a free re-wash request',
  'Can I add more clothes to active bag?',
  'Talk to Care Manager on WhatsApp',
];

export function LiveChatSupportScreen() {
  const { session } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentOnline, setAgentOnline] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const customerId = session?.user?.id;

  // HTTP polling mode - no WebSocket needed
  const connectionStatus = { connected: true, reconnecting: false };

  // Initialize chat room automatically in background
  useEffect(() => {
    if (!customerId) return;

    const initializeChat = async () => {
      try {
        setLoading(true);
        
        // Silently create or get existing chat room in background
        const roomResponse = await api.createChatRoom(customerId, 'Customer Support');
        
        if (roomResponse.success && roomResponse.data) {
          const room = roomResponse.data;
          setRoomId(room.id);

          // Load message history if room exists
          const messagesResponse = await api.getChatMessages(room.id, 50, 0);
          
          if (messagesResponse.success && messagesResponse.data) {
            const formattedMessages = messagesResponse.data.map((msg: any) => ({
              ...msg,
              time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }));
            setMessages(formattedMessages);
          }
        }
      } catch (error) {
        console.error('[Chat] Error initializing:', error);
        // Don't show error to user - they can still type and send
      } finally {
        setLoading(false);
      }
    };

    initializeChat();
  }, [customerId]);

  // Poll for new messages every 3 seconds (HTTP polling instead of WebSocket)
  useEffect(() => {
    if (!roomId) return;

    const pollMessages = async () => {
      try {
        const messagesResponse = await api.getChatMessages(roomId, 50, 0);
        if (messagesResponse.success && messagesResponse.data) {
          const formattedMessages = messagesResponse.data.map((msg: any) => ({
            ...msg,
            time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }));
          
          // Only update if messages changed to avoid unnecessary re-renders
          if (JSON.stringify(formattedMessages) !== JSON.stringify(messages)) {
            setMessages(formattedMessages);
            // Scroll to bottom when new messages arrive
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        }
      } catch (error) {
        console.error('Error polling messages:', error);
      }
    };

    // Initial poll
    pollMessages();

    // Poll every 3 seconds
    const interval = setInterval(pollMessages, 3000);

    return () => clearInterval(interval);
  }, [roomId, messages]);

  const handleInputChange = (text: string) => {
    setInputText(text);
  };

  const sendMessage = async (text: string) => {
    // Validation
    if (!text.trim()) {
      return; // Just ignore empty messages
    }
    
    if (!customerId) {
      Alert.alert('Error', 'Please sign in to send messages');
      return;
    }

    const messageText = text.trim();
    setInputText('');

    // If no roomId yet, create one now
    let currentRoomId = roomId;
    if (!currentRoomId) {
      try {
        const roomResponse = await api.createChatRoom(customerId, 'Customer Support');
        if (roomResponse.success && roomResponse.data) {
          currentRoomId = roomResponse.data.id;
          setRoomId(currentRoomId);
        } else {
          Alert.alert('Error', 'Could not create chat session. Please try again.');
          setInputText(messageText);
          return;
        }
      } catch (error) {
        Alert.alert('Error', 'Could not create chat session. Please try again.');
        setInputText(messageText);
        return;
      }
    }

    // Show message immediately (optimistic UI)
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      senderId: customerId,
      senderType: 'CUSTOMER',
      message: messageText,
      createdAt: new Date().toISOString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Send to backend - admin will see it immediately
    try {
      await api.saveChatMessage({
        roomId: currentRoomId,
        senderId: customerId,
        senderType: 'CUSTOMER',
        message: messageText,
        messageType: 'TEXT',
      });
      
      // Refresh to get real message from server
      const messagesResponse = await api.getChatMessages(currentRoomId, 50, 0);
      if (messagesResponse.success && messagesResponse.data) {
        const formattedMessages = messagesResponse.data.map((msg: any) => ({
          ...msg,
          time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
        setMessages(formattedMessages);
      }
      
    } catch (error: any) {
      // Remove optimistic message and restore text on error
      setMessages((prev) => prev.filter(msg => msg.id !== userMsg.id));
      setInputText(messageText);
      Alert.alert('Failed to Send', 'Please check your connection and try again.');
      return;
    }

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Handle WhatsApp trigger
    if (messageText.toLowerCase().includes('whatsapp') || messageText.toLowerCase().includes('manager')) {
      void Linking.openURL('whatsapp://send?phone=+919121999999&text=Hi%20LaundryFresh%20Care%20Manager');
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    
    // Trigger typing indicator
    if (text.length > 0) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Connecting to support...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ADMIN PANEL ACCESS BUTTON */}
      {__DEV__ && (
        <Pressable
          style={styles.adminAccessButton}
          onPress={() => {
            Linking.openURL('https://laundry-adminpanel.vercel.app/chat')
              .catch(() => Alert.alert('Error', 'Could not open admin panel'));
          }}
        >
          <MaterialCommunityIcons name="cog" size={16} color="#FFFFFF" />
          <Text style={styles.adminAccessText}>Open Admin Chat</Text>
        </Pressable>
      )}

      {/* 1. AGENT STATUS HEADER */}
      <View style={styles.agentHeader}>
        <View style={styles.agentAvatarBox}>
          <MaterialCommunityIcons name="face-agent" size={24} color="#16A34A" />
          <View style={[styles.onlineBadge, !agentOnline && styles.offlineBadge]} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.agentName}>Priya M. • Fabric Specialist</Text>
          <View style={styles.statusRow}>
            <View style={styles.connectedDot} />
            <Text style={styles.agentStatus}>
              {agentOnline ? 'Active Now • Messages syncing every 3s' : 'Away • We\'ll respond soon'}
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.whatsAppEscalateBtn}
          onPress={() => Linking.openURL('whatsapp://send?phone=+919121999999')}
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
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isUser = item.senderType === 'CUSTOMER';
          return (
            <View style={[styles.bubbleWrap, isUser ? styles.bubbleWrapUser : styles.bubbleWrapAgent]}>
              <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAgent]}>
                <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAgent]}>
                  {item.message}
                </Text>
                <View style={styles.bubbleFooter}>
                  <Text style={[styles.bubbleTime, isUser ? styles.bubbleTimeUser : styles.bubbleTimeAgent]}>
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
        ListFooterComponent={
          agentTyping ? (
            <View style={styles.typingBox}>
              <Text style={styles.typingText}>Priya is typing a response...</Text>
            </View>
          ) : null
        }
      />

      {/* 3. QUICK CHIPS */}
      <View style={styles.quickPromptsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
          {QUICK_PROMPTS.map((prompt, idx) => (
            <Pressable
              key={idx}
              style={styles.promptChip}
              onPress={() => sendMessage(prompt)}
            >
              <Text style={styles.promptChipText}>{prompt}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* 4. TEXT INPUT BAR */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask a question about your garments..."
          placeholderTextColor="#A1A1AA"
          value={inputText}
          onChangeText={handleInputChange}
          onSubmitEditing={() => sendMessage(inputText)}
          onBlur={stopTyping}
          editable={connectionStatus.connected}
        />
        <Pressable 
          style={[styles.sendBtn, !connectionStatus.connected && styles.sendBtnDisabled]} 
          onPress={() => sendMessage(inputText)}
          disabled={!connectionStatus.connected}
        >
          <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FCF9F7',
  },
  adminAccessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 8,
  },
  adminAccessText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8A7A84',
    fontWeight: '600',
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F3E8DF',
    gap: 12,
  },
  agentAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: 15,
    fontWeight: '900',
    color: '#1C0B18',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    marginRight: 6,
  },
  agentStatus: {
    fontSize: 13,
    color: '#16A34A',
    fontWeight: '700',
  },
  reconnectingStatus: {
    fontSize: 13,
    color: '#F97316',
    fontWeight: '700',
  },
  disconnectedStatus: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '700',
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
    padding: 16,
    gap: 12,
  },
  bubbleWrap: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bubbleWrapUser: {
    justifyContent: 'flex-end',
  },
  bubbleWrapAgent: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    padding: 14,
    borderRadius: 18,
    gap: 4,
  },
  bubbleUser: {
    backgroundColor: '#F97316',
    borderBottomRightRadius: 4,
  },
  bubbleAgent: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3E8DF',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextUser: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bubbleTextAgent: {
    color: '#1C0B18',
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  bubbleTime: {
    fontSize: 11,
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
  quickPromptsRow: {
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#F3E8DF',
  },
  quickScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  promptChip: {
    backgroundColor: '#FAF5EF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E8DED6',
  },
  promptChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1C0B18',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
