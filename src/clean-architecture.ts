/**
 * Clean Architecture - Barrel Export
 * 
 * Convenient imports for the clean architecture layers
 */

// Domain Layer
export { NostrChatMessage } from './domain/entities/NostrChatMessage';
export type { INostrChatRepository } from './domain/repositories/INostrChatRepository';

// Application Layer
export {
    SendNostrMessageUseCase,
    type SendNostrMessageRequest,
    type SendNostrMessageResponse
} from './application/use-cases/messaging/SendNostrMessageUseCase';

export {
    SubscribeToNostrMessagesUseCase,
    type SubscribeToNostrMessagesRequest,
    type SubscribeToNostrMessagesResponse
} from './application/use-cases/messaging/SubscribeToNostrMessagesUseCase';

// Infrastructure Layer
export { NostrChatRepository } from './infrastructure/nostr/NostrChatRepository';

// Presentation Layer
export {
    NostrChatPresenter,
    type NostrChatState,
    type NostrChatStateListener
} from './presentation/NostrChatPresenter';

// Usage Example:
// import { NostrChatPresenter, NostrChatMessage } from '@/src/clean-architecture';
