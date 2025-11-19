import IndexScreen from '@/components/screens/IndexScreen';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export const LandingPage: React.FC = () => {
    const router = useRouter();
    
    const handleEnter = async () => {
        try {
            // Mark that user has seen the index
            await SecureStore.setItemAsync('hasSeenIndex', 'true');
            console.log('[Landing] User entered mesh - marked as seen');
            
            // Navigate to chat
            router.push('/chat');
        } catch (error) {
            console.error('[Landing] Error marking index as seen:', error);
            // Still navigate even if saving fails
            router.push('/chat');
        }
    };
    
    return (
        <IndexScreen 
            onEnter={handleEnter} 
            showBackButton={true}
        />
    );
};

export default LandingPage;