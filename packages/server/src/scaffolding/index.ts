/**
 * MCP Server Scaffolding - Dead simple code execution servers
 *
 * This module provides opinionated scaffolding for creating MCP servers that follow
 * the code execution pattern described in:
 * https://www.anthropic.com/engineering/code-execution-with-mcp
 *
 * Key benefits:
 * - Progressive tool disclosure (98.7% token reduction)
 * - Data filtering in execution environment
 * - Built-in state management
 * - Filesystem-like tool organization
 *
 * @example
 * ```typescript
 * import { createServer } from '@modelcontextprotocol/server/scaffolding';
 * import { z } from 'zod';
 *
 * const server = createServer('my-api-server', '1.0.0')
 *   .module('salesforce', 'Salesforce CRM operations', m =>
 *     m.function('updateRecord', 'Update a CRM record',
 *       { inputSchema: z.object({ id: z.string(), data: z.any() }) },
 *       async ({ id, data }, ctx) => {
 *         // Data filtering happens here, not through the model
 *         const filtered = ctx.filter.take(data.history, 5);
 *         return `Updated record ${id}`;
 *       }
 *     )
 *   )
 *   .build();
 * ```
 */

export {
    CodeExecutionServer,
    DataFilter,
    StateStore,
    type CodeModule,
    type ModuleFunction,
    type ExecutionContext
} from './code-execution-server.js';

export {
    ServerBuilder,
    ModuleBuilder,
    createServer,
    createModule
} from './builder.js';
