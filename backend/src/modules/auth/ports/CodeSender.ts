/**
 * How a code leaves the building. Two ports rather than one, because an email
 * has a subject and an SMS has a length limit, and pretending otherwise would
 * only push the difference into the adapters.
 */
export interface EmailSender {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}

export interface SmsSender {
  send(message: { to: string; body: string }): Promise<void>;
}
