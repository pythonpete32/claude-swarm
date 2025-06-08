#!/usr/bin/env node
import "dotenv/config";

// Exit early if on an older version of Node.js (< 22)
const major = process.versions.node.split(".").map(Number)[0]!;
if (major < 22) {
  throw new Error(
    "\n" +
      `Claude Swarm requires Node.js version 22 or newer.\n` +
      `You are running Node.js v${process.versions.node}.\n` +
      "Please upgrade Node.js: https://nodejs.org/en/download/\n",
  );
}

import App from "./app";
import OnboardingApp from "./components/onboarding/onboarding-app";
import { setInkRenderer, onExit } from "./utils/terminal";
import { isAlreadyOnboarded, shouldSkipOnboarding } from "./utils/onboarding";
import { render } from "ink";
import meow from "meow";
import React, { useState } from "react";

const cli = meow(
  `
  Usage
    $ ink-chat

  Options
    --help     Show help
    --version  Show version

  Examples
    $ ink-chat
`,
  {
    importMeta: import.meta,
    flags: {
      help: {
        type: "boolean",
        shortFlag: "h",
      },
      version: {
        type: "boolean",
        shortFlag: "v",
      },
    },
  },
);

// Show help if requested
if (cli.flags.help) {
  cli.showHelp();
}

// Show version if requested
if (cli.flags.version) {
  cli.showVersion();
}

// Create the main app component with onboarding logic
function MainApp() {
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  
  const shouldOnboard = !shouldSkipOnboarding() && !isAlreadyOnboarded() && !onboardingComplete;
  
  if (shouldOnboard) {
    return <OnboardingApp onComplete={() => setOnboardingComplete(true)} />;
  }
  
  return <App />;
}

// Start the app and capture the Ink renderer instance
const renderer = render(<MainApp />);

// Register the renderer with our terminal utilities for proper cleanup
// This enables:
// - Performance debugging (FPS monitoring when CODEX_FPS_DEBUG is set)
// - Safe terminal clearing without corruption
// - Proper terminal state management for tmux integration
setInkRenderer(renderer);

// Setup exit handlers to ensure clean terminal restoration
// Critical for multi-agent orchestration - prevents "frozen" terminal
// if the orchestrator crashes or exits unexpectedly
process.on("SIGINT", onExit); // Ctrl+C
process.on("SIGTERM", onExit); // Termination signal
process.on("exit", onExit); // Process exit
