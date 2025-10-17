import * as Font from 'expo-font';

export const loadFonts = async () => {
  await Font.loadAsync({
    // Satoshi fonts
    'Satoshi-Light': require('../assets/fonts/satoshi/Satoshi-Light.otf'),
    'Satoshi-Regular': require('../assets/fonts/satoshi/Satoshi-Regular.otf'),
    'Satoshi-Medium': require('../assets/fonts/satoshi/Satoshi-Medium.otf'),
    'Satoshi-Bold': require('../assets/fonts/satoshi/Satoshi-Bold.otf'),
    'Satoshi-Black': require('../assets/fonts/satoshi/Satoshi-Black.otf'),
    
    // Barlow fonts
    'Barlow-Thin': require('../assets/fonts/Barlow/Barlow-Thin.ttf'),
    'Barlow-ExtraLight': require('../assets/fonts/Barlow/Barlow-ExtraLight.ttf'),
    'Barlow-Light': require('../assets/fonts/Barlow/Barlow-Light.ttf'),
    'Barlow-Regular': require('../assets/fonts/Barlow/Barlow-Regular.ttf'),
    'Barlow-Medium': require('../assets/fonts/Barlow/Barlow-Medium.ttf'),
    'Barlow-SemiBold': require('../assets/fonts/Barlow/Barlow-SemiBold.ttf'),
    'Barlow-Bold': require('../assets/fonts/Barlow/Barlow-Bold.ttf'),
    'Barlow-ExtraBold': require('../assets/fonts/Barlow/Barlow-ExtraBold.ttf'),
    'Barlow-Black': require('../assets/fonts/Barlow/Barlow-Black.ttf'),
  });
};