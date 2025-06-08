import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import type { Repository } from '../mocks/mock-data';

export interface DownloadScreenProps {
  repo: Repository;
  onComplete: () => void;
}

export default function DownloadScreen({ repo, onComplete }: DownloadScreenProps): JSX.Element {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(p + 10, 100);
        if (next === 100) {
          clearInterval(id);
          setTimeout(onComplete, 500);
        }
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [onComplete]);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue" height="100%">
      <Box justifyContent="center" paddingY={1}>
        <Text bold color="blue">Setting up: {repo.name}</Text>
      </Box>
      <Box flexGrow={1} justifyContent="center" alignItems="center">
        <Text>{`Cloning repository... ${progress}%`}</Text>
      </Box>
    </Box>
  );
}
