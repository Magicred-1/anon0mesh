import IndexScreen from "@/components/screens/IndexScreen"
import { useRouter } from 'expo-router';

export const LandingPage: React.FC = () => {
    const router = useRouter();
    
    return (
        <IndexScreen onEnter={() => router.back()} />
    )
}

export default LandingPage;