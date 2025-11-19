import MeshZoneScreen from '@/components/screens/MeshZoneScreen';
import { useRouter } from 'expo-router';

export default function MeshZonePage() {
  const router = useRouter();

  return (
    <MeshZoneScreen
            onNavigateToMessages={() => router.push('/chat')}
            onNavigateToWallet={() => router.push('/wallet')}
            onNavigateToHistory={() => router.push('/wallet/history')}
            onNavigateToMeshZone={() => router.push('/zone')}
            onNavigateToProfile={() => router.push('/profile')}
            onDisconnect={() => {
            console.log('Disconnect requested');
            router.push('/landing');
            }}
      onCreateZone={() => router.push('/zone/create')}
    />
  );
}
