import type { Agents } from 'librechat-data-provider';
import type { StandardGraph } from '@librechat/agents';

/**
 * Job status enum
 */
export type JobStatus = 'running' | 'complete' | 'error' | 'aborted';

/**
 * Serializable job data - no object references, suitable for Redis/external storage
 */
export interface SerializableJobData {
  streamId: string;
  userId: string;
  tenantId?: string;
  status: JobStatus;
  createdAt: number;
  completedAt?: number;
  conversationId?: string;
  error?: string;

  /** User message metadata */
  userMessage?: {
    messageId: string;
    parentMessageId?: string;
    conversationId?: string;
    text?: string;
  };

  /** Response message ID for reconnection */
  responseMessageId?: string;

  /** Sender name for UI display */
  sender?: string;

  /** Whether sync has been sent to a client */
  syncSent: boolean;

  /** Serialized final event for replay */
  finalEvent?: string;

  /** Endpoint metadata for abort handling - avoids storing functions */
  endpoint?: string;
  iconURL?: string;
  model?: string;
  promptTokens?: number;
}

/**
 * Usage metadata for token spending across different LLM providers.
 *
 * This interface supports two cache token formats. They differ not only in WHERE the cache
 * counts live, but in whether `input_tokens` ALREADY INCLUDES them — which is what actually
 * matters when pricing them.
 *
 * **Normalized (LangChain) format** — `input_token_details.cache_creation` / `.cache_read`,
 * nested. `input_tokens` is INCLUSIVE: per the `@langchain/core` contract it is the "sum of all
 * input token types" and `input_token_details` its "breakdown". Cache counts must therefore be
 * SUBTRACTED from `input_tokens` to obtain the non-cached portion.
 *
 * **Raw provider format** — `cache_creation_input_tokens` / `cache_read_input_tokens`, top-level.
 * `input_tokens` is EXCLUSIVE, so cache counts must be ADDED to obtain the total prompt size.
 *
 * Vermeer (issue #158) — two corrections to what this block used to claim:
 *  1. The two formats are NOT "mutually exclusive" per provider, and the nested one is NOT
 *     "OpenAI-only". Anthropic and Bedrock reach us through LangChain, which emits the NESTED,
 *     INCLUSIVE form (`@langchain/anthropic` → `buildUsageMetadata` sums cache into
 *     `input_tokens`, on the streaming and non-streaming paths alike).
 *  2. Reading a value from either container is therefore not enough — inclusivity has to be
 *     decided from the SHAPE. Assuming "Anthropic ⇒ additive" double-billed every cached token.
 *     See `inputTokensIncludesCache` in `packages/api/src/agents/usage.ts`.
 */
export interface UsageMetadata {
  /** Logical usage bucket for accounting/reporting. Defaults to model response usage. */
  usage_type?: 'message' | 'summarization';
  /** Total input tokens (prompt tokens) */
  input_tokens?: number;
  /** Total output tokens (completion tokens) */
  output_tokens?: number;
  /** Total billed tokens when provided by the model/runtime */
  total_tokens?: number;
  /** Model identifier that generated this usage */
  model?: string;
  /** Provider identifier that generated this usage */
  provider?: string;
  /**
   * Normalized (LangChain) cache token details — a BREAKDOWN of `input_tokens`, which already
   * includes these counts. Emitted for OpenAI models AND for Anthropic/Bedrock via LangChain.
   */
  input_token_details?: {
    /** Tokens written to cache */
    cache_creation?: number;
    /** Tokens read from cache */
    cache_read?: number;
  };
  /**
   * Raw provider cache creation tokens, NOT included in `input_tokens` (add to get the total).
   * Not emitted by `@langchain/anthropic` — Claude arrives via `input_token_details`.
   */
  cache_creation_input_tokens?: number;
  /**
   * Raw provider cache read tokens, NOT included in `input_tokens` (add to get the total).
   * Not emitted by `@langchain/anthropic` — Claude arrives via `input_token_details`.
   */
  cache_read_input_tokens?: number;
}

/**
 * Result returned from aborting a job - contains all data needed
 * for token spending and message saving without storing callbacks
 */
export interface AbortResult {
  /** Whether the abort was successful */
  success: boolean;
  /** The job data at time of abort */
  jobData: SerializableJobData | null;
  /** Aggregated content from the stream */
  content: Agents.MessageContentComplex[];
  /** Final event to send to client */
  finalEvent: unknown;
  /** Concatenated text from all content parts for token counting fallback */
  text: string;
  /** Collected usage metadata from all models for token spending */
  collectedUsage: UsageMetadata[];
}

/**
 * Resume state for reconnecting clients
 */
export interface ResumeState {
  runSteps: Agents.RunStep[];
  aggregatedContent: Agents.MessageContentComplex[];
  userMessage?: SerializableJobData['userMessage'];
  responseMessageId?: string;
  conversationId?: string;
  sender?: string;
}

/**
 * Interface for job storage backend.
 * Implementations can use in-memory Map, Redis, KV store, etc.
 *
 * Content state is tied to jobs:
 * - In-memory: Holds WeakRef to graph for live content/run steps access
 * - Redis: Persists chunks, reconstructs content on reconnect
 *
 * This consolidates job metadata + content state into a single interface.
 */
export interface IJobStore {
  /** Initialize the store (e.g., connect to Redis, start cleanup intervals) */
  initialize(): Promise<void>;

  /** Create a new job */
  createJob(
    streamId: string,
    userId: string,
    conversationId?: string,
    tenantId?: string,
  ): Promise<SerializableJobData>;

  /** Get a job by streamId (streamId === conversationId) */
  getJob(streamId: string): Promise<SerializableJobData | null>;

  /** Update job data */
  updateJob(streamId: string, updates: Partial<SerializableJobData>): Promise<void>;

  /** Delete a job */
  deleteJob(streamId: string): Promise<void>;

  /** Check if job exists */
  hasJob(streamId: string): Promise<boolean>;

  /** Get all running jobs (for cleanup) */
  getRunningJobs(): Promise<SerializableJobData[]>;

  /** Cleanup expired jobs */
  cleanup(): Promise<number>;

  /** Get total job count */
  getJobCount(): Promise<number>;

  /** Get job count by status */
  getJobCountByStatus(status: JobStatus): Promise<number>;

  /** Destroy the store and release resources */
  destroy(): Promise<void>;

  /**
   * Get active job IDs for a user.
   * Returns conversation IDs of running jobs belonging to the user.
   * Also performs self-healing cleanup of stale entries.
   *
   * @param userId - The user ID to query
   * @returns Array of conversation IDs with active jobs
   */
  getActiveJobIdsByUser(userId: string, tenantId?: string): Promise<string[]>;

  // ===== Content State Methods =====
  // These methods manage volatile content state tied to each job.
  // In-memory: Uses WeakRef to graph for live access
  // Redis: Persists chunks and reconstructs on demand

  /**
   * Set the graph reference for a job (in-memory only).
   * The graph provides live access to contentParts and contentData (run steps).
   *
   * In-memory: Stores WeakRef to graph
   * Redis: No-op (graph not transferable, uses chunks instead)
   *
   * @param streamId - The stream identifier
   * @param graph - The StandardGraph instance
   */
  setGraph(streamId: string, graph: StandardGraph): void;

  /**
   * Set content parts reference for a job.
   *
   * In-memory: Stores direct reference to content array
   * Redis: No-op (content built from chunks)
   *
   * @param streamId - The stream identifier
   * @param contentParts - The content parts array
   */
  setContentParts(streamId: string, contentParts: Agents.MessageContentComplex[]): void;

  /**
   * Get aggregated content for a job.
   *
   * In-memory: Returns live content from graph.contentParts or stored reference
   * Redis: Reconstructs from stored chunks
   *
   * @param streamId - The stream identifier
   * @returns Content parts or null if not available
   */
  getContentParts(streamId: string): Promise<{
    content: Agents.MessageContentComplex[];
  } | null>;

  /**
   * Get run steps for a job (for resume state).
   *
   * In-memory: Returns live run steps from graph.contentData
   * Redis: Fetches from persistent storage
   *
   * @param streamId - The stream identifier
   * @returns Run steps or empty array
   */
  getRunSteps(streamId: string): Promise<Agents.RunStep[]>;

  /**
   * Append a streaming chunk for later reconstruction.
   *
   * In-memory: No-op (content available via graph reference)
   * Redis: Uses XADD for append-only log efficiency
   *
   * @param streamId - The stream identifier
   * @param event - The SSE event to append
   */
  appendChunk(streamId: string, event: unknown): Promise<void>;

  /**
   * Clear all content state for a job.
   * Called on job completion/cleanup.
   *
   * @param streamId - The stream identifier
   */
  clearContentState(streamId: string): void;

  /**
   * Save run steps to persistent storage.
   * In-memory: No-op (run steps accessed via graph reference)
   * Redis: Persists for resume across instances
   *
   * @param streamId - The stream identifier
   * @param runSteps - Run steps to save
   */
  saveRunSteps?(streamId: string, runSteps: Agents.RunStep[]): Promise<void>;

  /**
   * Set collected usage reference for a job.
   * This array accumulates token usage from all models during generation.
   *
   * @param streamId - The stream identifier
   * @param collectedUsage - Array of usage metadata from all models
   */
  setCollectedUsage(streamId: string, collectedUsage: UsageMetadata[]): void;

  /**
   * Get collected usage for a job.
   *
   * @param streamId - The stream identifier
   * @returns Array of usage metadata or empty array
   */
  getCollectedUsage(streamId: string): UsageMetadata[];
}

/**
 * Interface for pub/sub event transport.
 * Implementations can use EventEmitter, Redis Pub/Sub, etc.
 */
export interface IEventTransport {
  /** Subscribe to events for a stream. `ready` resolves once the transport can receive messages. */
  subscribe(
    streamId: string,
    handlers: {
      onChunk: (event: unknown) => void;
      onDone?: (event: unknown) => void;
      onError?: (error: string) => void;
    },
  ): { unsubscribe: () => void; ready?: Promise<void> };

  /** Publish a chunk event - returns Promise in Redis mode for ordered delivery */
  emitChunk(streamId: string, event: unknown): void | Promise<void>;

  /** Publish a done event - returns Promise in Redis mode for ordered delivery */
  emitDone(streamId: string, event: unknown): void | Promise<void>;

  /** Publish an error event - returns Promise in Redis mode for ordered delivery */
  emitError(streamId: string, error: string): void | Promise<void>;

  /**
   * Publish an abort signal to all replicas (Redis mode).
   * Enables cross-replica abort: user aborts on Replica B,
   * generating Replica A receives signal and stops.
   * Optional - only implemented in Redis transport.
   */
  emitAbort?(streamId: string): void;

  /**
   * Register callback for abort signals from any replica (Redis mode).
   * Called when abort is triggered from any replica.
   * Optional - only implemented in Redis transport.
   */
  onAbort?(streamId: string, callback: () => void): void;

  /** Get subscriber count for a stream */
  getSubscriberCount(streamId: string): number;

  /** Check if this is the first subscriber (for ready signaling) */
  isFirstSubscriber(streamId: string): boolean;

  /** Listen for all subscribers leaving */
  onAllSubscribersLeft(streamId: string, callback: () => void): void;

  /**
   * Advance subscriber reorder buffer to match publisher sequence (cross-replica safe).
   * @param earlyReplayCount - Number of events replayed from earlyEventBuffer (same-replica).
   *   Pending entries with seq < earlyReplayCount are duplicates and are pruned; entries at or
   *   above are live chunks that arrived during the async GET window and are preserved.
   *   When 0/undefined (cross-replica), all pending entries are treated as live.
   */
  syncReorderBuffer?(streamId: string, earlyReplayCount?: number): void | Promise<void>;

  /** Cleanup transport resources for a specific stream */
  cleanup(streamId: string): void;

  /** Get all tracked stream IDs (for orphan cleanup) */
  getTrackedStreamIds(): string[];

  /** Destroy all transport resources */
  destroy(): void;
}
