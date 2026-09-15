import type { MessageDetail } from '../../../domain/entities/Conversation.js';

/**
 * How a new message reaches people who are already looking. The service calls
 * it and does not care whether delivery is an in-process socket registry or,
 * once there is more than one app instance, a Redis channel that every
 * instance subscribes to: the port is the seam where that swap happens.
 */
export interface MessageBroadcaster {
  /** Fan a message out to the given members. Never throws: delivery is best effort. */
  publish(recipientIds: string[], message: MessageDetail): void;
}

/** The default until sockets are wired in: messages still persist, nothing is pushed. */
export const noBroadcast: MessageBroadcaster = { publish: () => {} };
