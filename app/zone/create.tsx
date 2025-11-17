import CustomMeshZoneScreen from '@/components/screens/CustomMeshZoneScreen';
import { useRouter } from 'expo-router';

export default function CreateCustomZonePage() {
    const router = useRouter();

    const handleBack = () => {
        router.back();
    };

    const handleCreate = (zoneName: string, zoneRadius: string) => {
        console.log('Creating custom zone:', zoneName, zoneRadius);
        // TODO: Save custom zone to storage/state
        // TODO: Navigate back to zone screen
        router.back();
    };

    return (
        <CustomMeshZoneScreen
        onBack={handleBack}
        onCreate={handleCreate}
        />
    );
}
