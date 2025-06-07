import { Box, Text, useInput } from "ink";
import React from "react";

export default function GitHubLogin({
  onLogin,
}: {
  onLogin: () => void;
}): JSX.Element {
  useInput((input, key) => {
    if (key.return) {
      onLogin();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Text bold>Sign in with GitHub</Text>
      <Text dimColor>Press Enter to mock login</Text>
    </Box>
  );
}
