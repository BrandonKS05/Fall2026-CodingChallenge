/** How a code leaves the building. */
export interface EmailSender {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}
