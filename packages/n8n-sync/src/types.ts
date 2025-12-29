import { z } from 'zod';

// n8n Node schema
export const N8nNodeSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  type: z.string(),
  typeVersion: z.number().optional(),
  position: z.tuple([z.number(), z.number()]).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
  disabled: z.boolean().optional(),
  notes: z.string().optional(),
  notesInFlow: z.boolean().optional(),
});

export type N8nNode = z.infer<typeof N8nNodeSchema>;

// n8n Connection schema
export const N8nConnectionSchema = z.object({
  node: z.string(),
  type: z.string(),
  index: z.number(),
});

export type N8nConnection = z.infer<typeof N8nConnectionSchema>;

// n8n Workflow settings
export const N8nWorkflowSettingsSchema = z.object({
  saveDataErrorExecution: z.string().optional(),
  saveDataSuccessExecution: z.string().optional(),
  saveManualExecutions: z.boolean().optional(),
  saveExecutionProgress: z.boolean().optional(),
  executionTimeout: z.number().optional(),
  timezone: z.string().optional(),
  errorWorkflow: z.string().optional(),
});

export type N8nWorkflowSettings = z.infer<typeof N8nWorkflowSettingsSchema>;

// n8n Workflow schema
export const N8nWorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  nodes: z.array(N8nNodeSchema),
  connections: z.record(z.string(), z.record(z.string(), z.array(z.array(N8nConnectionSchema)))),
  settings: N8nWorkflowSettingsSchema.optional(),
  staticData: z.unknown().nullable().optional(),
  tags: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type N8nWorkflow = z.infer<typeof N8nWorkflowSchema>;

// API response schemas
export const WorkflowListResponseSchema = z.object({
  data: z.array(N8nWorkflowSchema),
  nextCursor: z.string().nullable().optional(),
});

export type WorkflowListResponse = z.infer<typeof WorkflowListResponseSchema>;

// Input schemas for create/update
export const CreateWorkflowInputSchema = N8nWorkflowSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  active: true,
  settings: true,
  staticData: true,
  tags: true,
});

export type CreateWorkflowInput = z.infer<typeof CreateWorkflowInputSchema>;

export const UpdateWorkflowInputSchema = CreateWorkflowInputSchema;
export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowInputSchema>;

// Client configuration
export interface N8nClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

// List options
export interface ListWorkflowsOptions {
  active?: boolean;
  limit?: number;
  cursor?: string;
}
