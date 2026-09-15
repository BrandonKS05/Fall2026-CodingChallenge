/**
 * Domain errors. Thrown by services and repositories and mapped to HTTP
 * responses at the edge by the error handler. The domain never imports from
 * the api layer, so these carry a `kind` rather than a status code.
 */
export type DomainErrorKind =
  'not_found' | 'forbidden' | 'conflict' | 'invalid' | 'unauthenticated' | 'upstream';

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly kind = 'not_found';

  constructor(entity: string, id?: string) {
    super(id === undefined ? `${entity} not found` : `${entity} ${id} not found`);
  }
}

export class ForbiddenError extends DomainError {
  readonly kind = 'forbidden';

  constructor(message = 'You do not have permission to do this') {
    super(message);
  }
}

/** A uniqueness or state conflict, e.g. an email already registered. */
export class ConflictError extends DomainError {
  readonly kind = 'conflict';
}

/** A request that is well-formed but not allowed by the domain rules. */
export class InvalidOperationError extends DomainError {
  readonly kind = 'invalid';
}

/** Bad credentials or a session whose user no longer exists. Deliberately vague. */
export class AuthenticationError extends DomainError {
  readonly kind = 'unauthenticated';

  constructor(message = 'Invalid email or password') {
    super(message);
  }
}

/** A third-party dependency (image provider, storage) failed or misbehaved. */
export class UpstreamError extends DomainError {
  readonly kind = 'upstream';

  constructor(
    message = 'An upstream service failed',
    /** HTTP status the upstream returned, when there was one. */
    readonly status?: number,
  ) {
    super(message);
  }
}
