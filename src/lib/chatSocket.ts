import { io, Socket } from 'socket.io-client';
import { useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/lib/config';

// Get backend URL from environment or default
const SOCKET_URL = (process.env.EXPO_PUBLIC_API_URL || API_BASE_URL).replace(/\/api\/?$/, '');

interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderType: 'CUSTOMER' | 'AGENT';
  message: string;
  messageType: 'TEXT' | 'IMAGE' | 'FILE';
  attachmentUrl?: string;
  createdAt: string;
  isRead?: boolean;
}

interface ConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  error?: string;
}

interface TypingStatus {
  roomId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

interface UseChatSocketOptions {
  userId: string;
  userType: 'CUSTOMER' | 'AGENT';
  roomId?: string;
  onMessage?: (message: ChatMessage) => void;
  onTyping?: (status: TypingStatus) => void;
  onAgentStatus?: (status: { agentId: string; status: string }) => void;
}

export function useChatSocket({
  userId,
  userType,
  roomId,
  onMessage,
  onTyping,
  onAgentStatus,
}: UseChatSocketOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    reconnecting: false,
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Initialize socket connection
  useEffect(() => {
    if (!userId) return;

    console.log('[ChatSocket] Connecting to:', SOCKET_URL);

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('[ChatSocket] Connected');
      setConnectionStatus({ connected: true, reconnecting: false });

      // Authenticate
      socket.emit('authenticate', { userId, userType });
    });

    socket.on('authenticated', (data) => {
      console.log('[ChatSocket] Authenticated:', data);

      // Join room if provided
      if (roomId) {
        socket.emit('join_room', { roomId, userId });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[ChatSocket] Disconnected:', reason);
      setConnectionStatus({ connected: false, reconnecting: false });
    });

    socket.on('reconnect_attempt', () => {
      console.log('[ChatSocket] Reconnecting...');
      setConnectionStatus((prev) => ({ ...prev, reconnecting: true }));
    });

    socket.on('reconnect', () => {
      console.log('[ChatSocket] Reconnected');
      setConnectionStatus({ connected: true, reconnecting: false });

      // Re-authenticate and rejoin room
      socket.emit('authenticate', { userId, userType });
      if (roomId) {
        socket.emit('join_room', { roomId, userId });
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[ChatSocket] Connection error:', error.message);
      setConnectionStatus({
        connected: false,
        reconnecting: false,
        error: error.message,
      });
    });

    // Message events
    socket.on('new_message', (message: ChatMessage) => {
      console.log('[ChatSocket] New message received:', message);
      setMessages((prev) => [...prev, message]);
      onMessage?.(message);
    });

    // Typing events
    socket.on('user_typing', (status: TypingStatus) => {
      console.log('[ChatSocket] User typing:', status);
      setIsTyping(true);
      onTyping?.(status);

      // Auto-clear typing after 3 seconds
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
      }, 3000);
    });

    socket.on('user_typing_stopped', () => {
      setIsTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    });

    // Read receipt
    socket.on('message_read', (data: { messageId: string; roomId: string }) => {
      console.log('[ChatSocket] Message read:', data);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, isRead: true } : msg
        )
      );
    });

    // Agent status
    socket.on('agent_status_update', (status) => {
      console.log('[ChatSocket] Agent status update:', status);
      onAgentStatus?.(status);
    });

    // Room events
    socket.on('user_joined', (data) => {
      console.log('[ChatSocket] User joined:', data);
    });

    socket.on('user_left', (data) => {
      console.log('[ChatSocket] User left:', data);
    });

    socket.on('participants_update', (data) => {
      console.log('[ChatSocket] Participants update:', data);
    });

    // Cleanup
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (roomId) {
        socket.emit('leave_room', { roomId });
      }
      socket.disconnect();
    };
  }, [userId, userType, roomId]);

  // Send message
  const sendMessage = useCallback(
    (message: string, messageType: 'TEXT' | 'IMAGE' | 'FILE' = 'TEXT', attachmentUrl?: string) => {
      if (!socketRef.current || !roomId) {
        console.error('[ChatSocket] Cannot send message: not connected or no room');
        return;
      }

      const messageData = {
        roomId,
        senderId: userId,
        senderType: userType,
        message,
        messageType,
        attachmentUrl,
      };

      console.log('[ChatSocket] Sending message:', messageData);
      socketRef.current.emit('send_message', messageData);

      // Stop typing indicator
      stopTyping();
    },
    [roomId, userId, userType]
  );

  // Start typing
  const startTyping = useCallback(() => {
    if (!socketRef.current || !roomId) return;

    socketRef.current.emit('typing_start', {
      roomId,
      userId,
      userName: 'Customer', // You can pass actual name
    });
  }, [roomId, userId]);

  // Stop typing
  const stopTyping = useCallback(() => {
    if (!socketRef.current || !roomId) return;

    socketRef.current.emit('typing_stop', {
      roomId,
      userId,
    });
  }, [roomId, userId]);

  // Mark message as read
  const markMessageAsRead = useCallback(
    (messageId: string) => {
      if (!socketRef.current || !roomId) return;

      socketRef.current.emit('mark_read', { roomId, messageId });
    },
    [roomId]
  );

  // Join a new room
  const joinRoom = useCallback(
    (newRoomId: string) => {
      if (!socketRef.current) return;

      // Leave current room
      if (roomId) {
        socketRef.current.emit('leave_room', { roomId });
      }

      // Join new room
      socketRef.current.emit('join_room', { roomId: newRoomId, userId });
    },
    [roomId, userId]
  );

  return {
    connectionStatus,
    messages,
    isTyping,
    sendMessage,
    startTyping,
    stopTyping,
    markMessageAsRead,
    joinRoom,
  };
}

// Export socket instance for direct access if needed
export { Socket };
