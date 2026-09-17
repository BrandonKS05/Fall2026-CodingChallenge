import { HourglassIcon } from 'lucide-react';

/**
 * Your side of a request you have already spent: the one message you were
 * allowed is sent, and nothing more can go until they accept. That is the whole
 * state of the conversation, so it is said across the conversation rather than
 * hidden in a line of placeholder text inside a box you cannot type in.
 */
export function AwaitingAccept({ name }: { name?: string }) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-stage/70 px-6 text-center backdrop-blur-[2px]">
      <div className="max-w-sm">
        <HourglassIcon className="mx-auto size-7 text-stage-ink/40" aria-hidden />
        <p className="mt-4 font-hand text-5xl leading-none text-stage-ink">
          Waiting for {name ?? 'them'} to accept.
        </p>
        <p className="mt-4 text-[11px] tracking-[0.2em] text-stage-ink/60 uppercase">
          Your message is in their requests. You can write again once they let you.
        </p>
      </div>
    </div>
  );
}
