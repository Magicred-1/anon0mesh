/**
 * useMessageQueue - React hook for offline message queuing
 * Automatically queues messages when no peers available and sends when connected
 */

import {
    getMessageQueue,
    QueuedMessage,
} from "@/src/infrastructure/cache/MessageQueue";
import { useEffect, useState } from "react";

export interface UseMessageQueueOptions {
  autoStart?: boolean; // Auto-start queue processing (default: true)
  processingInterval?: number; // Processing interval in ms (default: 5000)
}

export function useMessageQueue(options: UseMessageQueueOptions = {}) {
  const { autoStart = true, processingInterval = 5000 } = options;

  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [queueSize, setQueueSize] = useState(0);

  const messageQueue = getMessageQueue();

  useEffect(() => {
    // Subscribe to queue changes
    const unsubscribe = messageQueue.subscribe((updatedQueue) => {
      setQueue(updatedQueue);
      setQueueSize(updatedQueue.length);
    });

    return () => {
      unsubscribe();
    };
  }, [messageQueue]);

  useEffect(() => {
    if (autoStart) {
      messageQueue.startProcessing(processingInterval);
    }

    return () => {
      if (autoStart) {
        messageQueue.stopProcessing();
      }
    };
  }, [autoStart, processingInterval, messageQueue]);

  const enqueue = async (
    content: string,
    targetPeer: string | null = null,
    type: "message" | "payment" | "data" = "message",
    metadata?: Record<string, any>,
  ) => {
    return await messageQueue.enqueue(content, targetPeer, type, metadata);
  };

  const clearQueue = async () => {
    await messageQueue.clearQueue();
  };

  const getStats = () => {
    return messageQueue.getStats();
  };

  const setSendCallback = (
    callback: (msg: QueuedMessage) => Promise<boolean>,
  ) => {
    messageQueue.setSendCallback(callback);
  };

  const processNow = async () => {
    await messageQueue.processQueue();
  };

  return {
    queue,
    queueSize,
    enqueue,
    clearQueue,
    getStats,
    setSendCallback,
    processNow,
  };
}
