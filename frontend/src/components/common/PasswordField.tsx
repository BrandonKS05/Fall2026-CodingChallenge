import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { FormField } from './FormField';

type PasswordFieldProps = Omit<ComponentProps<typeof FormField>, 'type' | 'trailing'>;

/** A password field with the usual eye: hold the secret, but let people check what they typed. */
export function PasswordField(props: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false);
  // Named after its own field, so a form with two of them stays unambiguous.
  const action = `${revealed ? 'Hide' : 'Show'} ${props.label.toLowerCase()}`;
  return (
    <FormField
      {...props}
      type={revealed ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setRevealed((shown) => !shown)}
          aria-label={action}
          aria-pressed={revealed}
          aria-controls={props.id}
          className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {revealed ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      }
    />
  );
}
