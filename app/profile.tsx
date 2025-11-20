import ProfileScreen from '@/components/screens/ProfileScreen';
import { useRouter } from 'expo-router';

export default function ProfilePage() {
  const router = useRouter();

  return (
    <ProfileScreen
      onNavigateToWallet={() => router.push('/wallet')}
      onNavigateToHistory={() => router.push('/wallet/history')}
      onNavigateToMeshZone={() => router.push('/zone')}
      onNavigateToProfile={() => router.push('/profile')}
      onDisconnect={() => {
          console.log('Disconnect requested');
          router.push('/landing' as any);
      }}
    />
  );
}

