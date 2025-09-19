import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

interface MagicLinkVerifyProps {
  magicLinkToken?: string;
}

export default function MagicLinkVerify({ magicLinkToken }: MagicLinkVerifyProps) {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const verifyMagicLink = React.useCallback(async () => {
    if (!signIn || !isLoaded) {
      setVerificationStatus('error');
      return;
    }

    try {
      setVerificationStatus('loading');

      // Get the URL that opened the app
      const url = await Linking.getInitialURL();
      console.log('Initial URL:', url);
      
      // Try to handle the magic link verification
      const signInAttempt = await signIn.attemptFirstFactor({
        strategy: 'email_code',
        code: magicLinkToken,
        redirectUrl: 'normalapp://verify-magic-link',
      });

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId });
        setVerificationStatus('success');
        
        setTimeout(() => {
          router.replace('/');
        }, 1500);
      } else {
        console.error('Sign-in not complete:', signInAttempt);
        setVerificationStatus('error');
      }
    } catch (error: any) {
      console.error('Magic link verification error:', error);
      setVerificationStatus('error');
      
      Alert.alert(
        'Verification Failed',
        error.errors?.[0]?.message || 'The magic link is invalid or has expired. Please try signing in again.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/sign-in'),
          },
        ]
      );
    } finally {
      // Cleanup if needed
    }
  }, [signIn, isLoaded, setActive, router]);

  useEffect(() => {
    if (isLoaded) {
      verifyMagicLink();
    }
  }, [isLoaded, verifyMagicLink]);

  if (verificationStatus === 'loading') {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: 20,
      }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ 
          marginTop: 20, 
          fontSize: 18, 
          textAlign: 'center',
          color: '#333'
        }}>
          Verifying magic link...
        </Text>
        <Text style={{ 
          marginTop: 10, 
          fontSize: 14, 
          textAlign: 'center',
          color: '#666'
        }}>
          Please wait while we sign you in.
        </Text>
      </View>
    );
  }

  if (verificationStatus === 'success') {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: 20,
      }}>
        <View style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: '#22c55e',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 20,
        }}>
          <Text style={{ color: 'white', fontSize: 30 }}>✓</Text>
        </View>
        <Text style={{ 
          fontSize: 24, 
          fontWeight: 'bold',
          textAlign: 'center',
          color: '#22c55e',
          marginBottom: 10,
        }}>
          Sign-in Successful!
        </Text>
        <Text style={{ 
          fontSize: 16, 
          textAlign: 'center',
          color: '#666'
        }}>
          Redirecting to the app...
        </Text>
      </View>
    );
  }

  if (verificationStatus === 'error') {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: 20,
      }}>
        <View style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: '#ef4444',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 20,
        }}>
          <Text style={{ color: 'white', fontSize: 30 }}>✗</Text>
        </View>
        <Text style={{ 
          fontSize: 24, 
          fontWeight: 'bold',
          textAlign: 'center',
          color: '#ef4444',
          marginBottom: 10,
        }}>
          Verification Failed
        </Text>
        <Text style={{ 
          fontSize: 16, 
          textAlign: 'center',
          color: '#666',
          marginBottom: 20,
        }}>
          The magic link is invalid or has expired.
        </Text>
        <Text style={{ 
          fontSize: 14, 
          textAlign: 'center',
          color: '#999'
        }}>
          You&apos;ll be redirected to sign in again.
        </Text>
      </View>
    );
  }

  return null;
}