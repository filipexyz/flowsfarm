import {
  type N8nClientConfig,
  type N8nWorkflow,
  type CreateWorkflowInput,
  type UpdateWorkflowInput,
  type ListWorkflowsOptions,
  N8nWorkflowSchema,
  WorkflowListResponseSchema,
} from './types';
import { logger } from '@flowsfarm/core';

export class N8nClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(config: N8nClientConfig) {
    // Normalize base URL (remove trailing slash)
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30000;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-N8N-API-KEY': this.apiKey,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new N8nApiError(
          `API request failed: ${response.status} ${response.statusText}`,
          response.status,
          errorBody
        );
      }

      // Handle empty responses (e.g., DELETE)
      const text = await response.text();
      if (!text) {
        return undefined as T;
      }

      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Test the connection to the n8n instance.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.listWorkflows({ limit: 1 });
      return true;
    } catch (error) {
      logger.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * List all workflows from the n8n instance.
   */
  async listWorkflows(options: ListWorkflowsOptions = {}): Promise<N8nWorkflow[]> {
    const params = new URLSearchParams();

    if (options.active !== undefined) {
      params.set('active', String(options.active));
    }
    if (options.limit !== undefined) {
      params.set('limit', String(options.limit));
    }
    if (options.cursor) {
      params.set('cursor', options.cursor);
    }

    const queryString = params.toString();
    const endpoint = `/api/v1/workflows${queryString ? `?${queryString}` : ''}`;

    const response = await this.request<unknown>(endpoint);
    const parsed = WorkflowListResponseSchema.parse(response);

    return parsed.data;
  }

  /**
   * List all workflows, handling pagination automatically.
   */
  async listAllWorkflows(options: Omit<ListWorkflowsOptions, 'cursor'> = {}): Promise<N8nWorkflow[]> {
    const allWorkflows: N8nWorkflow[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams();

      if (options.active !== undefined) {
        params.set('active', String(options.active));
      }
      if (options.limit !== undefined) {
        params.set('limit', String(options.limit));
      }
      if (cursor) {
        params.set('cursor', cursor);
      }

      const queryString = params.toString();
      const endpoint = `/api/v1/workflows${queryString ? `?${queryString}` : ''}`;

      const response = await this.request<unknown>(endpoint);
      const parsed = WorkflowListResponseSchema.parse(response);

      allWorkflows.push(...parsed.data);
      cursor = parsed.nextCursor ?? undefined;
    } while (cursor);

    return allWorkflows;
  }

  /**
   * Get a single workflow by ID.
   */
  async getWorkflow(id: string): Promise<N8nWorkflow> {
    const response = await this.request<unknown>(`/api/v1/workflows/${id}`);
    return N8nWorkflowSchema.parse(response);
  }

  /**
   * Create a new workflow.
   */
  async createWorkflow(workflow: CreateWorkflowInput): Promise<N8nWorkflow> {
    const response = await this.request<unknown>('/api/v1/workflows', {
      method: 'POST',
      body: JSON.stringify(workflow),
    });
    return N8nWorkflowSchema.parse(response);
  }

  /**
   * Update an existing workflow.
   */
  async updateWorkflow(
    id: string,
    workflow: UpdateWorkflowInput
  ): Promise<N8nWorkflow> {
    const response = await this.request<unknown>(`/api/v1/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(workflow),
    });
    return N8nWorkflowSchema.parse(response);
  }

  /**
   * Activate or deactivate a workflow.
   */
  async setWorkflowActive(id: string, active: boolean): Promise<N8nWorkflow> {
    const response = await this.request<unknown>(`/api/v1/workflows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    });
    return N8nWorkflowSchema.parse(response);
  }

  /**
   * Delete a workflow.
   */
  async deleteWorkflow(id: string): Promise<void> {
    await this.request(`/api/v1/workflows/${id}`, {
      method: 'DELETE',
    });
  }
}

export class N8nApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody: string
  ) {
    super(message);
    this.name = 'N8nApiError';
  }
}
