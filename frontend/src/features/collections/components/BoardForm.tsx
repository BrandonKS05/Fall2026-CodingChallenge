/**
 * Create and settings share this form. Validation comes from the shared
 * schema, so a title the server would reject never leaves the client.
 */
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { createCollectionRequestSchema, type CreateCollectionRequest } from '@trove/shared';
import type { z } from 'zod';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/features/auth/components/FormField';
import { VisibilityPicker } from './VisibilityPicker';

export type BoardFormValues = CreateCollectionRequest;
/** What the fields hold before defaults apply; the schema turns it into BoardFormValues on submit. */
type BoardFormInput = z.input<typeof createCollectionRequestSchema>;

interface BoardFormProps {
  defaultValues?: Partial<BoardFormValues>;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (values: BoardFormValues) => void | Promise<void>;
}

export function BoardForm({ defaultValues, submitLabel, pending, onSubmit }: BoardFormProps) {
  const form = useForm<BoardFormInput, unknown, BoardFormValues>({
    resolver: standardSchemaResolver<BoardFormInput, unknown, BoardFormValues>(createCollectionRequestSchema),
    defaultValues: { title: '', description: '', visibility: 'private', ...defaultValues },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormField
        id="board-title"
        label="Title"
        placeholder="Kitchen ideas"
        autoFocus
        error={form.formState.errors.title?.message}
        {...form.register('title')}
      />
      <div className="space-y-2">
        <Label htmlFor="board-description">Description</Label>
        <Textarea
          id="board-description"
          placeholder="What belongs here?"
          rows={2}
          {...form.register('description')}
        />
        {form.formState.errors.description && (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.description.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label>Who can see it</Label>
        <Controller
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <VisibilityPicker value={field.value ?? 'private'} onChange={field.onChange} disabled={pending} />
          )}
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
