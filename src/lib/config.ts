import Constants from 'expo-constants';

const configuredUrl = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl;

export const API_BASE_URL = String(configuredUrl || 'https://laundry.anushatechnologies.com/api').replace(/\/$/, '');

export const APP_NAME = 'LaundryFresh';
