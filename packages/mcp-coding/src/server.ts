#!/usr/bin/env node

/**
 * MCP Server for Coding Agents
 *
 * Provides tools for coding agents:
 * - request_review: Spawn a review agent
 * - create_pull_request: Create GitHub PR
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createPullRequestTool } from "./tools/create-pr.js";
import { requestReviewTool } from "./tools/request-review.js";
import type { CreatePullRequestInput, MCPContext, RequestReviewInput } from "./types.js";

// Parse command line arguments to get agent context
const args = process.argv.slice(2);
const context: MCPContext = {
  agentId: getArgValue("--agent-id"),
  agentType: "coding",
  workspace: getArgValue("--workspace"),
  issue: getArgValue("--issue"),
  branch: getArgValue("--branch"),
  session: getArgValue("--session"),
};

function getArgValue(argName: string): string {
  const index = args.indexOf(argName);
  if (index === -1 || index === args.length - 1) {
    throw new Error(`Missing required argument: ${argName}`);
  }
  return args[index + 1];
}

const server = new Server(
  {
    name: "coding-workflow-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "request_review",
        description: "Request code review from a review agent",
        inputSchema: {
          type: "object",
          properties: {
            description: {
              type: "string",
              description: "What you accomplished and want reviewed",
            },
          },
          required: ["description"],
        },
      },
      {
        name: "create_pull_request",
        description: "Create a pull request for your changes",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "PR title",
            },
            description: {
              type: "string",
              description: "PR description",
            },
            draft: {
              type: "boolean",
              description: "Create as draft PR",
              default: false,
            },
          },
          required: ["title", "description"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "request_review": {
        if (!args || typeof args !== "object" || !("description" in args)) {
          throw new Error("Invalid arguments for request_review tool");
        }
        const result = await requestReviewTool(args as unknown as RequestReviewInput, context);
        return {
          content: [
            {
              type: "text",
              text: result.message,
            },
          ],
        };
      }

      case "create_pull_request": {
        if (!args || typeof args !== "object" || !("title" in args) || !("description" in args)) {
          throw new Error("Invalid arguments for create_pull_request tool");
        }
        const result = await createPullRequestTool(
          args as unknown as CreatePullRequestInput,
          context,
        );
        return {
          content: [
            {
              type: "text",
              text: result.message,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Coding MCP Server running for agent ${context.agentId}`);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
