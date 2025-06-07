import { Box, Text } from "ink";
import path from "node:path";
import React from "react";

export interface TerminalHeaderProps {
  terminalRows: number;
  version: string;
  PWD: string;
  model: string;
  provider?: string;
  approvalPolicy: string;
  colorsByPolicy: Record<string, string | undefined>;
}

const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  terminalRows,
  version,
  PWD,
  model,
  provider = "demo",
  approvalPolicy,
  colorsByPolicy,
}) => {
  const shortPwd = path.basename(PWD);
  const policyColor = colorsByPolicy[approvalPolicy] || "white";

  return (
    <Box
      borderStyle="single"
      borderColor="cyan" 
      paddingX={1}
      justifyContent="space-between"
    >
      <Box gap={2}>
        <Text bold color="cyan">
          🤖 Claude Swarm
        </Text>
        <Text dimColor>v{version}</Text>
        <Text>
          📁 <Text color="yellow">{shortPwd}</Text>
        </Text>
      </Box>
      
      <Box gap={2}>
        <Text>
          🤖 <Text color="magenta">{model}</Text>
        </Text>
        <Text>
          Mode: <Text color={policyColor}>{approvalPolicy}</Text>
        </Text>
      </Box>
    </Box>
  );
};

export default TerminalHeader;