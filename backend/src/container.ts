/**
 * Composition root.
 *
 * The only module that imports from infrastructure/. It builds each concrete
 * dependency once and exposes it through its port interface, so the rest of
 * the app depends on abstractions rather than implementations.
 */
import path from 'node:path';
import type { RequestHandler } from 'express';
import pkg from '../package.json' with { type: 'json' };
import type { Env } from './config/env.js';
import { SESSION_TTL_SECONDS } from './config/session.js';
import { Argon2PasswordHasher } from './modules/auth/adapters/Argon2PasswordHasher.js';
import { createEmailSender } from './modules/auth/adapters/emailSenderFactory.js';
import type { EmailSender } from './modules/auth/ports/CodeSender.js';
import { VerificationService } from './modules/auth/VerificationService.js';
import { GoogleOAuthProvider } from './modules/auth/adapters/GoogleOAuthProvider.js';
import { JoseTokenService } from './modules/auth/adapters/JoseTokenService.js';
import { createDatabase, type Database } from './infrastructure/db/client.js';
import { DatabaseHealthIndicator } from './infrastructure/db/DatabaseHealthIndicator.js';

import { InMemoryEventBus } from './infrastructure/events/InMemoryEventBus.js';
import { CachedImageProvider } from './modules/images/adapters/CachedImageProvider.js';
import { PixabayImageProvider } from './modules/images/adapters/pixabay/PixabayImageProvider.js';
import {
  asLogger,
  createPinoLogger,
  createRequestLogger,
} from './infrastructure/logging/pinoLogger.js';
import { createStorage } from './modules/images/adapters/storage/storageFactory.js';
import { StorageHealthIndicator } from './modules/images/adapters/storage/StorageHealthIndicator.js';
import type { EventBus } from './infrastructure/events/EventBus.js';
import type { HealthIndicator } from './modules/health/ports/HealthIndicator.js';
import type { FetchFn } from './infrastructure/http/fetch.js';
import type { ImageProvider } from './modules/images/ports/ImageProvider.js';
import type { Logger } from './infrastructure/logging/Logger.js';
import type { OAuthProvider } from './modules/auth/ports/OAuthProvider.js';
import type { PasswordHasher } from './modules/auth/ports/PasswordHasher.js';
import { createDrizzleRepositories, type Repositories } from './infrastructure/db/repositories.js';
import type { StorageBackend } from './modules/images/ports/StorageBackend.js';
import type { TokenService } from './modules/auth/ports/TokenService.js';
import { AccountExportService } from './modules/auth/AccountExportService.js';
import { AuthService } from './modules/auth/AuthService.js';
import { CollectionService } from './modules/collections/CollectionService.js';
import { ImageService } from './modules/images/ImageService.js';
import { ItemService } from './modules/items/ItemService.js';
import { MessagingService } from './modules/messaging/MessagingService.js';
import { noBroadcast } from './modules/messaging/ports/MessageBroadcaster.js';
import { NotificationService } from './modules/notifications/NotificationService.js';
import { EmbeddingService } from './modules/recommendations/EmbeddingService.js';
import { OpenAIEmbeddingClient } from './modules/recommendations/adapters/OpenAIEmbeddingClient.js';
import { ShareService } from './modules/sharing/ShareService.js';
import { SocialService } from './modules/social/SocialService.js';

export interface Services {
  auth: AuthService;
  accountExport: AccountExportService;
  collections: CollectionService;
  images: ImageService;
  items: ItemService;
  messaging: MessagingService;
  /**
   * Null without an embeddings key: the recommender is the one feature that
   * cannot be faked locally, and a clone without a key should still run.
   */
  embeddings: EmbeddingService | null;
  share: ShareService;
  social: SocialService;
  notifications: NotificationService;
}

/** Identity providers that are configured. Absent means the button is hidden. */
export interface OAuthProviders {
  google?: OAuthProvider | undefined;
}

export interface Container {
  env: Env;
  logger: Logger;
  /** HTTP access-log middleware. Built here because it needs the concrete pino instance. */
  requestLogger: RequestHandler;
  version: string;
  healthIndicators: HealthIndicator[];
  repositories: Repositories;
  passwordHasher: PasswordHasher;
  tokens: TokenService;
  oauth: OAuthProviders;
  services: Services;
  /** Releases pooled connections. Called once on shutdown. */
  dispose(): Promise<void>;
}

/** Test seams: replace any piece of infrastructure without touching the wiring. */
export interface ContainerOverrides {
  database?: Database;
  healthIndicators?: HealthIndicator[];
  repositories?: Partial<Repositories>;
  passwordHasher?: PasswordHasher;
  emailSender?: EmailSender;
  tokens?: TokenService;
  storage?: StorageBackend;
  imageProvider?: ImageProvider;
  fetchFn?: FetchFn;
  eventBus?: EventBus;
  oauth?: OAuthProviders;
}

/** backend/ on disk, so relative paths in configuration resolve the same from any working directory. */
const BACKEND_ROOT = path.resolve(import.meta.dirname, '..');

export function createContainer(env: Env, overrides: ContainerOverrides = {}): Container {
  const pinoLogger = createPinoLogger(env);
  const logger = asLogger(pinoLogger);
  const database = overrides.database ?? createDatabase(env);

  const repositories: Repositories = {
    ...createDrizzleRepositories(database.db),
    ...overrides.repositories,
  };
  const passwordHasher = overrides.passwordHasher ?? new Argon2PasswordHasher();
  const tokens = overrides.tokens ?? new JoseTokenService(env.JWT_SECRET, SESSION_TTL_SECONDS);
  const fetchFn = overrides.fetchFn ?? fetch;
  const events = overrides.eventBus ?? new InMemoryEventBus(logger);
  const oauth: OAuthProviders =
    overrides.oauth ??
    (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: new GoogleOAuthProvider({
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            fetchFn,
          }),
        }
      : {});
  // Codes go out through whichever delivery is configured; with none, they go
  // to the log, which is a development convenience and nothing more.
  const emailSender = overrides.emailSender ?? createEmailSender(env, fetchFn, logger);
  const verification = new VerificationService({
    codes: repositories.verificationCodes,
    hasher: passwordHasher,
    email: emailSender,
    // Nowhere to send it and nowhere real to be: hand the code back instead, so
    // a local sign-up can be finished without a mailbox.
    revealCodes: env.NODE_ENV !== 'production' && !env.RESEND_API_KEY,
    logger,
  });

  const storage = overrides.storage ?? createStorage(env, BACKEND_ROOT);
  // Decorator: every provider call goes through the 24-hour cache Pixabay's terms require.
  const imageProvider =
    overrides.imageProvider ??
    new CachedImageProvider(
      new PixabayImageProvider({
        apiKey: env.PIXABAY_API_KEY,
        baseUrl: env.PIXABAY_BASE_URL,
        fetchFn,
      }),
    );

  const images = new ImageService({
    images: repositories.images,
    providers: { [imageProvider.name]: imageProvider },
    storage,
    fetchFn,
    logger,
  });
  const collections = new CollectionService({
    collections: repositories.collections,
    memberships: repositories.memberships,
    likes: repositories.likes,
    items: repositories.items,
    follows: repositories.follows,
    events,
    logger,
  });
  const notifications = new NotificationService({
    notifications: repositories.notifications,
    memberships: repositories.memberships,
    users: repositories.users,
    logger,
  });
  // Observer: notifications react to board events without the publishers knowing.
  notifications.register(events);
  const items = new ItemService({
    items: repositories.items,
    users: repositories.users,
    collectionRepository: repositories.collections,
    collectionService: collections,
    imageService: images,
    events,
    logger,
  });
  // The worker only exists where there is a model to call. It listens for
  // boards gaining pictures, but does no work on the request that added them.
  const embeddings = env.OPENAI_API_KEY
    ? new EmbeddingService({
        repository: repositories.embeddings,
        client: new OpenAIEmbeddingClient({ apiKey: env.OPENAI_API_KEY, fetchFn, logger }),
        logger,
      })
    : null;
  embeddings?.listen(events);

  const services: Services = {
    auth: new AuthService({
      users: repositories.users,
      passwordHasher,
      tokens,
      verification,
      logger,
    }),
    accountExport: new AccountExportService({
      users: repositories.users,
      collections: repositories.collections,
      items,
    }),
    collections,
    images,
    items,
    messaging: new MessagingService({
      conversations: repositories.conversations,
      messages: repositories.messages,
      users: repositories.users,
      follows: repositories.follows,
      // Swapped for the socket registry once the realtime layer is attached.
      broadcaster: noBroadcast,
      logger,
    }),
    share: new ShareService({
      collections: repositories.collections,
      memberships: repositories.memberships,
      users: repositories.users,
      collectionService: collections,
      events,
      logger,
    }),
    embeddings,
    social: new SocialService({
      users: repositories.users,
      follows: repositories.follows,
      collections: repositories.collections,
      logger,
    }),
    notifications,
  };

  return {
    env,
    logger,
    requestLogger: createRequestLogger(pinoLogger),
    version: pkg.version,
    healthIndicators: overrides.healthIndicators ?? [
      new DatabaseHealthIndicator(database.db),
      new StorageHealthIndicator(storage),
    ],
    repositories,
    passwordHasher,
    tokens,
    oauth,
    services,
    dispose: async () => {
      embeddings?.stop();
      await database.close();
    },
  };
}
