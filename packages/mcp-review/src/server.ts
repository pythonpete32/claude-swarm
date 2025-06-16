#!/usr/bin/env node

/**
 * MCP Review Server - Tools for review agents
 * 
 * Provides tools for review agents to:
 * - save_review: Save review feedback and inject into coding agent
 * - create_pull_request: Create GitHub PR when code is approved
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { saveReviewTool } from "./tools/save-review.js";
import { createPullRequestTool } from "./tools/create-pr.js";
import type { MCPContext, SaveReviewInput, CreatePRInput } from "./types.js";

// Parse command line arguments to get agent context
const args = process.argv.slice(2);
const context: MCPContext = {
  agentId: getArgValue("--agent-id"),
  agentType: "review",
  workspace: getArgValue("--workspace"),
  parentInstanceId: getArgValue("--parent-instance-id"),
  parentTmuxSession: getArgValue("--parent-tmux-session"),
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
    name: "review-workflow-mcp",
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
        name: "save_review",
        description: "Save review feedback to database and inject into coding agent's session",
        inputSchema: {
          type: "object",
          properties: {
            review: {
              type: "string",
              description: "The review feedback text",
            },
            decision: {
              type: "string",
              enum: ["request_changes", "approve"],
              description: "Whether to request changes or approve the code",
            },
          },
          required: ["review", "decision"],
        },
      },
      {
        name: "create_pull_request",
        description: "Create a GitHub pull request for approved code",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Pull request title",
            },
            description: {
              type: "string",
              description: "Pull request description",
            },
            draft: {
              type: "boolean",
              description: "Whether to create as draft PR",
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
      case "save_review": {
        if (!args || typeof args !== "object" || !("review" in args) || !("decision" in args)) {
          throw new Error("Invalid arguments for save_review tool");
        }
        const result = await saveReviewTool(args as unknown as SaveReviewInput, context);
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
        const result = await createPullRequestTool(args as unknown as CreatePRInput, context);
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
const transport = new StdioServerTransport();
server.connect(transport);

console.error(`MCP Review Server started for agent ${context.agentId}`);