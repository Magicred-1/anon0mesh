/**
 * NostrChatPresenter (MVVM Pattern)
 * 
 * Presentation layer coordinator that manages UI state and orchestrates use cases.
 * Acts as ViewModel in MVVM architecture.
 * 
 * Responsibilities:
 * - Manage UI state (loading, errors, messages)
 * - Coordinate use cases
 * - Format data for view
 * - Handle user actions
 */

import { SendNostrMessageUseCase } from '../application/use-cases/messaging/SendNostrMessageUseCase';
import { SubscribeToNostrMessagesUseCase } from '../application/use-cases/messaging/SubscribeToNostrMessagesUseCase';
import { NostrChatMessage } from '../domain/entities/NostrChatMessage';
import { NostrChatRepository } from '../infrastructure/nostr/NostrChatRepository';

export interface NostrChatState {
  // Connection state
  initialized: boolean;
  connecting: boolean;
  connected: boolean;
  connectedRelays: number;
  status: string;

  // Message state
  messages: NostrChatMessage[];
  sending: boolean;

  // User identity
  myNostrPubkey: string;
  mySolanaPubkey: string | null;

  // Input state
  recipientPubkey: string;
  inputText: string;

  // Error state
  error: string | null;
}

export type NostrChatStateListener = (state: NostrChatState) => void;

export class NostrChatPresenter {
  private state: NostrChatState = {
    initialized: false,
    connecting: false,
    connected: false,
    connectedRelays: 0,
    status: 'Disconnected',
    messages: [],
    sending: false,
    myNostrPubkey: '',
    mySolanaPubkey: null,
    recipientPubkey: '',
    inputText: '',
    error: null,
  };

  private listeners: Set<NostrChatStateListener> = new Set();
  private repository: NostrChatRepository;
  private sendMessageUseCase: SendNostrMessageUseCase;
  private subscribeUseCase: SubscribeToNostrMessagesUseCase;
  private subscriptionId: string | null = null;

  constructor(
    walletAdapter: any, // IWalletAdapter
    relayUrls: string[] = [
      'wss://relay.damus.io',
      'wss://relay.nostr.band',
      'wss://nos.lol',
      'wss://relay.snort.social',
      'wss://nostr.wine',
    ]
  ) {
    // Initialize clean architecture layers
    this.repository = new NostrChatRepository();
    this.sendMessageUseCase = new SendNostrMessageUseCase(this.repository);
    this.subscribeUseCase = new SubscribeToNostrMessagesUseCase(this.repository);

    // Auto-initialize
    this.initialize(relayUrls, walletAdapter);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: NostrChatStateListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.state);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current state (for non-reactive access)
   */
  getState(): NostrChatState {
    return { ...this.state };
  }

  /**
   * Initialize connection
   */
  private async initialize(relayUrls: string[], walletAdapter: any): Promise<void> {
    try {
      this.updateState({
        connecting: true,
        status: 'Initializing...',
        error: null,
      });

      // Initialize repository
      await this.repository.initialize(relayUrls, walletAdapter);

      // Get identity info
      const myNostrPubkey = this.repository.getMyPubkey();
      const mySolanaPubkey = this.repository.getMySolanaPubkey();
      const connectedRelays = this.repository.getConnectedRelayCount();

      console.log('[Presenter] Initialized:', {
        nostr: myNostrPubkey.slice(0, 8),
        solana: mySolanaPubkey?.slice(0, 8),
        relays: connectedRelays,
      });

      this.updateState({
        myNostrPubkey,
        mySolanaPubkey,
        connectedRelays,
        status: 'Subscribing...',
      });

      // Subscribe to messages
      const subscribeResult = await this.subscribeUseCase.execute(
        { lookbackHours: 24 },
        (message) => this.handleNewMessage(message),
        () => this.handleSyncComplete()
      );

      if (subscribeResult.success) {
        this.subscriptionId = subscribeResult.subscriptionId!;
        this.updateState({
          initialized: true,
          connecting: false,
          connected: true,
          status: 'Connected',
        });
      } else {
        throw new Error(subscribeResult.error);
      }
    } catch (error) {
      console.error('[Presenter] Initialization failed:', error);
      this.updateState({
        connecting: false,
        connected: false,
        status: 'Error',
        error: error instanceof Error ? error.message : 'Initialization failed',
      });
    }
  }

  /**
   * Handle new message from subscription
   */
  private handleNewMessage(message: NostrChatMessage): void {
    console.log('[Presenter] New message:', message.id.slice(0, 8));
    console.log('[Presenter] Current message count:', this.state.messages.length);

    // Add to messages and sort (create new array to ensure React detects change)
    const messages = [...this.state.messages, message].sort(
      NostrChatMessage.compareByTimestamp
    );

    console.log('[Presenter] New message count:', messages.length);
    this.updateState({ messages });
  }

  /**
   * Handle sync complete
   */
  private handleSyncComplete(): void {
    console.log('[Presenter] Initial sync complete');
  }

  /**
   * Send a message
   */
  async sendMessage(): Promise<void> {
    if (this.state.sending) {
      return; // Prevent double-send
    }

    try {
      this.updateState({ sending: true, error: null });

      const result = await this.sendMessageUseCase.execute({
        recipientPubkey: this.state.recipientPubkey,
        content: this.state.inputText,
      });

      if (result.success && result.message) {
        // Add sent message to local state
        const messages = [...this.state.messages, result.message].sort(
          NostrChatMessage.compareByTimestamp
        );

        this.updateState({
          messages,
          inputText: '', // Clear input
          sending: false,
        });

        console.log('[Presenter] Message sent successfully');
      } else {
        this.updateState({
          sending: false,
          error: result.error || 'Failed to send message',
        });
      }
    } catch (error) {
      console.error('[Presenter] Send failed:', error);
      this.updateState({
        sending: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
      });
    }
  }

  /**
   * Update recipient pubkey
   */
  setRecipientPubkey(pubkey: string): void {
    this.updateState({ recipientPubkey: pubkey });
  }

  /**
   * Update input text
   */
  setInputText(text: string): void {
    this.updateState({ inputText: text });
  }

  /**
   * Clear error
   */
  clearError(): void {
    this.updateState({ error: null });
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    if (this.subscriptionId) {
      await this.subscribeUseCase.unsubscribe(this.subscriptionId);
    }
    await this.repository.shutdown();
    this.listeners.clear();
    console.log('[Presenter] Disposed');
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<NostrChatState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('[Presenter] Listener error:', error);
      }
    });
  }
}
