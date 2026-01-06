/**
 * Code Execution MCP Server - Opinionated scaffolding for code execution pattern
 *
 * This implements the principles from https://www.anthropic.com/engineering/code-execution-with-mcp:
 * 1. Progressive tool disclosure through filesystem-like organization
 * 2. Data filtering in the execution environment (not through the model)
 * 3. State persistence through file-based storage
 */

import type {
    CallToolResult,
    Implementation,
    RequestHandlerExtra,
    ServerNotification,
    ServerRequest
} from '@modelcontextprotocol/core';
import * as z from 'zod/v4';

import { McpServer } from '../server/mcp.js';
import type { ServerOptions } from '../server/server.js';

/**
 * A module represents a collection of related functionality (like a directory of code)
 */
export interface CodeModule {
    /**
     * Module name (e.g., "google-drive", "salesforce")
     */
    name: string;

    /**
     * Human-readable description of what this module does
     */
    description: string;

    /**
     * Functions available in this module
     */
    functions: Record<string, ModuleFunction<any>>;

    /**
     * Optional: Submodules for nested organization
     */
    submodules?: Record<string, CodeModule>;
}

/**
 * A function within a module
 */
export interface ModuleFunction<TInput = any> {
    /**
     * Function name
     */
    name: string;

    /**
     * Description of what this function does
     */
    description: string;

    /**
     * Input schema (Zod schema)
     */
    inputSchema?: z.ZodType<TInput>;

    /**
     * The actual implementation
     */
    execute: (
        input: TInput,
        context: ExecutionContext
    ) => Promise<any> | any;
}

/**
 * Context available during function execution
 */
export interface ExecutionContext {
    /**
     * Session ID (may be undefined for stateless servers)
     */
    sessionId: string | undefined;

    /**
     * Filter large datasets before returning to model
     */
    filter: DataFilter;

    /**
     * Persistent state storage
     */
    state: StateStore;

    /**
     * Send progress notifications
     */
    notify: (message: string, level?: 'debug' | 'info' | 'warning' | 'error') => Promise<void>;

    /**
     * Full request handler extra (for advanced usage)
     */
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>;
}

/**
 * Data filtering utilities to process data in execution environment
 */
export class DataFilter {
    /**
     * Filter array based on predicate
     */
    filter<T>(data: T[], predicate: (item: T) => boolean): T[] {
        return data.filter(predicate);
    }

    /**
     * Take first N items
     */
    take<T>(data: T[], count: number): T[] {
        return data.slice(0, count);
    }

    /**
     * Skip first N items
     */
    skip<T>(data: T[], count: number): T[] {
        return data.slice(count);
    }

    /**
     * Map and transform data
     */
    map<T, U>(data: T[], mapper: (item: T) => U): U[] {
        return data.map(mapper);
    }

    /**
     * Reduce data to summary
     */
    reduce<T, U>(data: T[], reducer: (acc: U, item: T) => U, initial: U): U {
        return data.reduce(reducer, initial);
    }

    /**
     * Group by key
     */
    groupBy<T>(data: T[], keyFn: (item: T) => string): Record<string, T[]> {
        return data.reduce(
            (acc, item) => {
                const key = keyFn(item);
                if (!acc[key]) acc[key] = [];
                acc[key]!.push(item);
                return acc;
            },
            {} as Record<string, T[]>
        );
    }

    /**
     * Get unique values
     */
    unique<T>(data: T[], keyFn?: (item: T) => any): T[] {
        if (!keyFn) return [...new Set(data)];

        const seen = new Set();
        return data.filter(item => {
            const key = keyFn(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Sort data
     */
    sort<T>(data: T[], compareFn?: (a: T, b: T) => number): T[] {
        return [...data].sort(compareFn);
    }

    /**
     * Paginate data
     */
    paginate<T>(data: T[], page: number, pageSize: number): { items: T[]; total: number; pages: number } {
        const start = (page - 1) * pageSize;
        const items = data.slice(start, start + pageSize);
        return {
            items,
            total: data.length,
            pages: Math.ceil(data.length / pageSize)
        };
    }

    /**
     * Extract specific fields from objects
     */
    pluck<T, K extends keyof T>(data: T[], key: K): T[K][] {
        return data.map(item => item[key]);
    }

    /**
     * Find items matching criteria
     */
    find<T>(data: T[], predicate: (item: T) => boolean): T | undefined {
        return data.find(predicate);
    }

    /**
     * Count items matching criteria
     */
    count<T>(data: T[], predicate?: (item: T) => boolean): number {
        if (!predicate) return data.length;
        return data.filter(predicate).length;
    }

    /**
     * Aggregate numeric data
     */
    aggregate<T>(
        data: T[],
        field: keyof T
    ): {
        sum: number;
        avg: number;
        min: number;
        max: number;
        count: number;
    } {
        const values = data.map(item => Number(item[field])).filter(v => !isNaN(v));

        return {
            sum: values.reduce((a, b) => a + b, 0),
            avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
            min: Math.min(...values),
            max: Math.max(...values),
            count: values.length
        };
    }
}

/**
 * In-memory state store (can be extended for persistent storage)
 */
export class StateStore {
    private storage = new Map<string, any>();

    async get<T = any>(key: string): Promise<T | undefined> {
        return this.storage.get(key);
    }

    async set<T = any>(key: string, value: T): Promise<void> {
        this.storage.set(key, value);
    }

    async delete(key: string): Promise<void> {
        this.storage.delete(key);
    }

    async has(key: string): Promise<boolean> {
        return this.storage.has(key);
    }

    async keys(): Promise<string[]> {
        return Array.from(this.storage.keys());
    }

    async clear(): Promise<void> {
        this.storage.clear();
    }
}

/**
 * Code Execution MCP Server - optimized for the code execution pattern
 */
export class CodeExecutionServer {
    private server: McpServer;
    private modules = new Map<string, CodeModule>();
    private stateStore = new StateStore();

    constructor(serverInfo: Implementation, options?: ServerOptions) {
        this.server = new McpServer(serverInfo, options);
    }

    /**
     * Register a module (collection of related functions)
     */
    registerModule(module: CodeModule): void {
        this.modules.set(module.name, module);

        // Register each function as a tool
        this._registerModuleFunctions(module, [module.name]);
    }

    private _registerModuleFunctions(module: CodeModule, path: string[]): void {
        // Register functions in this module
        for (const [funcName, func] of Object.entries(module.functions)) {
            const toolName = [...path, funcName].join('.');

            this.server.registerTool(
                toolName,
                {
                    title: func.name,
                    description: func.description,
                    inputSchema: func.inputSchema
                },
                async (args, extra) => {
                    const context: ExecutionContext = {
                        sessionId: extra?.sessionId,
                        filter: new DataFilter(),
                        state: this.stateStore,
                        notify: async (message: string, level: 'debug' | 'info' | 'warning' | 'error' = 'info') => {
                            await this.server.sendLoggingMessage(
                                {
                                    level,
                                    data: message
                                },
                                extra?.sessionId
                            );
                        },
                        extra: extra!
                    };

                    try {
                        // Execute the function with proper argument handling
                        const input = func.inputSchema && args ? args : undefined;
                        const result = await Promise.resolve(func.execute(input as any, context));

                        // Format result
                        return this._formatResult(result);
                    } catch (error) {
                        return {
                            content: [
                                {
                                    type: 'text' as const,
                                    text: `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`
                                }
                            ],
                            isError: true
                        };
                    }
                }
            );
        }

        // Recursively register submodules
        if (module.submodules) {
            for (const [subName, submodule] of Object.entries(module.submodules)) {
                this._registerModuleFunctions(submodule, [...path, subName]);
            }
        }
    }

    private _formatResult(result: any): CallToolResult {
        if (result === null || result === undefined) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'Operation completed successfully'
                    }
                ]
            };
        }

        if (typeof result === 'string') {
            return {
                content: [
                    {
                        type: 'text',
                        text: result
                    }
                ]
            };
        }

        if (typeof result === 'object' && 'content' in result) {
            return result as CallToolResult;
        }

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    }

    /**
     * Register a simple resource for code discovery
     */
    registerCodeResource(name: string, path: string, code: string): void {
        this.server.registerResource(
            name,
            path,
            {
                title: name,
                description: `Code for ${name}`,
                mimeType: 'text/typescript'
            },
            async () => ({
                contents: [
                    {
                        uri: path,
                        text: code
                    }
                ]
            })
        );
    }

    /**
     * Get the underlying MCP server for advanced operations
     */
    get mcpServer(): McpServer {
        return this.server;
    }

    /**
     * Connect to transport
     */
    async connect(transport: any): Promise<void> {
        return this.server.connect(transport);
    }

    /**
     * Close the server
     */
    async close(): Promise<void> {
        return this.server.close();
    }
}
