import type { MessageDetail } from '../../domain/entities/Conversation.js';
import type { MessageBroadcaster } from '../../modules/messaging/ports/MessageBroadcaster.js';

/** Remembers what would have been pushed, so tests can assert the fan-out without sockets. */
export class RecordingBroadcaster implements MessageBroadcaster {
  readonly published: { recipientIds: string[]; message: MessageDetail }[] = [];

  publish(recipientIds: string[], message: MessageDetail): void {
    this.published.push({ recipientIds, message });
  }
}
