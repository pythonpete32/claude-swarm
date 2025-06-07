import SelectInput from "../select-input/select-input";
import { Box, Text } from "ink";
import React from "react";

export interface RepoItem {
  label: string;
  value: string;
}

export default function RepoPicker({
  repos,
  onSelect,
}: {
  repos: RepoItem[];
  onSelect: (repo: RepoItem) => void;
}): JSX.Element {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Text bold>Select a repository</Text>
      <SelectInput items={repos} onSelect={onSelect} />
    </Box>
  );
}
