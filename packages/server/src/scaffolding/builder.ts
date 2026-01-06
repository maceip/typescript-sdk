/**
 * Fluent builder for creating code execution servers
 */

import type { Implementation } from '@modelcontextprotocol/core';
import * as z from 'zod/v4';

import type { ServerOptions } from '../server/server.js';
import type { CodeModule, ExecutionContext, ModuleFunction } from './code-execution-server.js';
import { CodeExecutionServer } from './code-execution-server.js';

/**
 * Builder for creating modules
 */
export class ModuleBuilder {
    private module: Partial<CodeModule> = {
        functions: {},
        submodules: {}
    };

    constructor(name: string, description: string) {
        this.module.name = name;
        this.module.description = description;
    }

    /**
     * Add a function to this module
     */
    function<TInput = void>(
        name: string,
        description: string,
        config?: {
            inputSchema?: z.ZodType<TInput>;
        },
        execute?: (input: TInput, context: ExecutionContext) => Promise<any> | any
    ): this;

    function<TInput = void>(
        name: string,
        description: string,
        execute: (input: TInput, context: ExecutionContext) => Promise<any> | any
    ): this;

    function<TInput = void>(
        name: string,
        description: string,
        configOrExecute?: z.ZodType<TInput> | ((input: TInput, context: ExecutionContext) => Promise<any> | any) | {
            inputSchema?: z.ZodType<TInput>;
        },
        maybeExecute?: (input: TInput, context: ExecutionContext) => Promise<any> | any
    ): this {
        let inputSchema: z.ZodType<TInput> | undefined;
        let execute: (input: TInput, context: ExecutionContext) => Promise<any> | any;

        // Parse overloaded arguments
        if (typeof configOrExecute === 'function') {
            // function(name, description, execute)
            execute = configOrExecute;
        } else if (configOrExecute && 'parse' in configOrExecute) {
            // function(name, description, schema, execute)
            inputSchema = configOrExecute;
            if (!maybeExecute) {
                throw new Error('Execute function is required when schema is provided');
            }
            execute = maybeExecute;
        } else if (configOrExecute && typeof configOrExecute === 'object') {
            // function(name, description, { inputSchema }, execute)
            inputSchema = configOrExecute.inputSchema;
            if (!maybeExecute) {
                throw new Error('Execute function is required when config is provided');
            }
            execute = maybeExecute;
        } else {
            throw new Error('Invalid function signature');
        }

        const func: ModuleFunction<TInput> = {
            name,
            description,
            inputSchema,
            execute
        };

        this.module.functions![name] = func;
        return this;
    }

    /**
     * Add a submodule
     */
    submodule(name: string, description: string, builder: (mb: ModuleBuilder) => void): this {
        const mb = new ModuleBuilder(name, description);
        builder(mb);
        this.module.submodules![name] = mb.build();
        return this;
    }

    /**
     * Build the module
     */
    build(): CodeModule {
        if (!this.module.name || !this.module.description) {
            throw new Error('Module must have name and description');
        }

        return this.module as CodeModule;
    }
}

/**
 * Builder for creating code execution servers
 */
export class ServerBuilder {
    private serverInfo: Implementation;
    private options?: ServerOptions;
    private modules: CodeModule[] = [];
    private codeResources: Array<{ name: string; path: string; code: string }> = [];

    constructor(name: string, version: string) {
        this.serverInfo = {
            name,
            version
        };
    }

    /**
     * Set server description
     */
    description(description: string): this {
        this.serverInfo.description = description;
        return this;
    }

    /**
     * Set server options
     */
    withOptions(options: ServerOptions): this {
        this.options = options;
        return this;
    }

    /**
     * Add a module using a builder
     */
    module(name: string, description: string, builder: (mb: ModuleBuilder) => void): this {
        const mb = new ModuleBuilder(name, description);
        builder(mb);
        this.modules.push(mb.build());
        return this;
    }

    /**
     * Add a pre-built module
     */
    addModule(module: CodeModule): this {
        this.modules.push(module);
        return this;
    }

    /**
     * Add a code resource for discovery
     */
    codeResource(name: string, path: string, code: string): this {
        this.codeResources.push({ name, path, code });
        return this;
    }

    /**
     * Build the server
     */
    build(): CodeExecutionServer {
        const server = new CodeExecutionServer(this.serverInfo, this.options);

        // Register all modules
        for (const module of this.modules) {
            server.registerModule(module);
        }

        // Register all code resources
        for (const resource of this.codeResources) {
            server.registerCodeResource(resource.name, resource.path, resource.code);
        }

        return server;
    }
}

/**
 * Create a new server builder
 */
export function createServer(name: string, version: string = '1.0.0'): ServerBuilder {
    return new ServerBuilder(name, version);
}

/**
 * Create a new module builder
 */
export function createModule(name: string, description: string): ModuleBuilder {
    return new ModuleBuilder(name, description);
}
