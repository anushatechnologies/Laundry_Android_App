import { useState, useCallback } from 'react';
import React from 'react';
import { CustomAlert } from '@/components/CustomAlert';

interface AlertOptions {
  title: string;
  message: string;
  icon?: keyof typeof import('@expo/vector-icons').MaterialCommunityIcons.glyphMap;
  iconColor?: string;
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
}

export function useCustomAlert() {
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    options: AlertOptions;
  }>({
    visible: false,
    options: {
      title: '',
      message: '',
    },
  });

  const showAlert = useCallback((options: AlertOptions) => {
    setAlertState({
      visible: true,
      options,
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, visible: false }));
  }, []);

  const AlertComponent = useCallback(
    () => (
      <CustomAlert
        visible={alertState.visible}
        title={alertState.options.title}
        message={alertState.options.message}
        icon={alertState.options.icon}
        iconColor={alertState.options.iconColor}
        buttons={alertState.options.buttons}
        onDismiss={hideAlert}
      />
    ),
    [alertState, hideAlert]
  );

  return {
    showAlert,
    hideAlert,
    AlertComponent,
  };
}
