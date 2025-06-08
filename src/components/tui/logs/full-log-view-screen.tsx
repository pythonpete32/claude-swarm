import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { LogEntry, TaskInfoForLog, LogLevel, logLevels as allLogLevels } from './mocks/log-data';

export interface FullLogViewScreenProps {
  taskInfo: TaskInfoForLog;
  logEntries: LogEntry[];
  initialFilterLevel?: LogLevel;
  initialSearchTerm?: string;
  initialAutoScroll?: boolean;
  onBack: () => void;
  // These would be used if filtering/searching logic is lifted up
  // onSetFilterLevel: (level: LogLevel) => void;
  // onToggleAutoScroll: () => void;
  // onSetSearchTerm: (term: string) => void;
  // onCopyLogs?: () => void; // Full copy action
}

const LOG_VIEW_HEIGHT = 20; // Number of log lines visible at once

const getLevelColor = (level: LogLevel): string => {
  switch (level) {
    case 'ERROR': return 'red';
    case 'WARN': return 'yellow';
    case 'INFO': return 'blue';
    case 'DEBUG': return 'gray';
    case 'USER': return 'cyan';
    case 'AGENT': return 'green';
    case 'GIT': return 'magenta';
    case 'PR': return 'magenta';
    case 'REVIEW': return 'magenta';
    case 'TEST': return 'yellowBright';
    default: return 'white';
  }
};

const FullLogViewScreen: React.FC<FullLogViewScreenProps> = ({
  taskInfo,
  logEntries,
  initialFilterLevel = 'ALL',
  initialSearchTerm = '',
  initialAutoScroll = true,
  onBack,
  // onCopyLogs,
}) => {
  const [filterLevel, setFilterLevel] = useState<LogLevel>(initialFilterLevel);
  const [searchTerm, setSearchTerm] = useState<string>(initialSearchTerm);
  const [isAutoScroll, setIsAutoScroll] = useState<boolean>(initialAutoScroll);
  const [scrollIndex, setScrollIndex] = useState<number>(0); // Index of the top visible log entry
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [isFilterFocused, setIsFilterFocused] = useState<boolean>(false);

  const filteredLogEntries = logEntries.filter(entry => {
    const levelMatch = filterLevel === 'ALL' || entry.level === filterLevel;
    const termMatch = searchTerm === '' || entry.message.toLowerCase().includes(searchTerm.toLowerCase());
    return levelMatch && termMatch;
  });

  useEffect(() => {
    if (isAutoScroll) {
      setScrollIndex(Math.max(0, filteredLogEntries.length - LOG_VIEW_HEIGHT));
    }
  }, [filteredLogEntries.length, isAutoScroll]);

  useInput((input, key) => {
    if (isSearchFocused) {
      if (key.escape) setIsSearchFocused(false);
      // Let TextInput handle other inputs
      return;
    }
    if (isFilterFocused) {
        if (key.escape) setIsFilterFocused(false);
        else if (key.return || key.space) { // Cycle through filters
            const currentIndex = allLogLevels.indexOf(filterLevel);
            const nextIndex = (currentIndex + 1) % allLogLevels.length;
            setFilterLevel(allLogLevels[nextIndex]);
        } else if (key.leftArrow) {
            const currentIndex = allLogLevels.indexOf(filterLevel);
            const prevIndex = (currentIndex - 1 + allLogLevels.length) % allLogLevels.length;
            setFilterLevel(allLogLevels[prevIndex]);
        } else if (key.rightArrow) {
             const currentIndex = allLogLevels.indexOf(filterLevel);
            const nextIndex = (currentIndex + 1) % allLogLevels.length;
            setFilterLevel(allLogLevels[nextIndex]);
        }
        return;
    }

    // Global key handlers
    if (key.escape) { onBack(); return; }
    if (input === 'f') { setIsFilterFocused(true); return; }
    if (input === '/') { setIsSearchFocused(true); return; }
    if (input === 'a') { setIsAutoScroll(prev => !prev); return; }
    // if (input === 'c' && onCopyLogs) { onCopyLogs(); return; }

    if (key.upArrow) setScrollIndex(prev => Math.max(0, prev - 1));
    if (key.downArrow) setScrollIndex(prev => Math.min(Math.max(0, filteredLogEntries.length - LOG_VIEW_HEIGHT), prev + 1));
    if (key.pageUp) setScrollIndex(prev => Math.max(0, prev - LOG_VIEW_HEIGHT));
    if (key.pageDown) setScrollIndex(prev => Math.min(Math.max(0, filteredLogEntries.length - LOG_VIEW_HEIGHT), prev + LOG_VIEW_HEIGHT));
    if (key.home) setScrollIndex(0);
    if (key.end) setScrollIndex(Math.max(0, filteredLogEntries.length - LOG_VIEW_HEIGHT));
  });

  const visibleLogEntries = filteredLogEntries.slice(scrollIndex, scrollIndex + LOG_VIEW_HEIGHT);

  return (
    <Box flexDirection="column" padding={1} borderStyle="single" width="100%" height="100%">
      {/* Header */}
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Text bold color="blue">Full Log: #{taskInfo.id} {taskInfo.title}</Text>
        <Text>[Esc] Back</Text>
      </Box>

      {/* Filter/Search Bar */}
      <Box flexDirection="row" alignItems="center" marginBottom={1} paddingX={1}>
        <Text>Filter: </Text>
        <Box borderStyle={isFilterFocused ? "round" : undefined} borderColor={isFilterFocused ? "cyan" : undefined} paddingX={isFilterFocused ? 1 : 0}>
            <Text color={isFilterFocused ? "cyan" : "white"}>[{filterLevel.padEnd(6)}▼]</Text>
        </Box>
        <Text> [{isAutoScroll ? '●' : '○'}] Auto-scroll (a) </Text>
        <Text>Search: </Text>
        {isSearchFocused ? (
          <Box borderStyle="round" borderColor="cyan" paddingX={1}>
            <TextInput
              value={searchTerm}
              onChange={setSearchTerm}
              onSubmit={() => setIsSearchFocused(false)}
              placeholder="Type to search..."
            />
          </Box>
        ) : (
          <Box borderStyle="round" paddingX={1} borderColor="grey">
            <Text dimColor>{searchTerm || "/"}</Text>
          </Box>
        )}
      </Box>

      {/* Log Content Area */}
      <Box flexDirection="column" flexGrow={1} borderStyle="round" padding={1} minHeight={LOG_VIEW_HEIGHT}>
        {visibleLogEntries.map(entry => (
          <Box key={entry.id} flexDirection="row" flexShrink={0}>
            <Text dimColor>{entry.timestamp} </Text>
            <Text bold color={getLevelColor(entry.level)}>{entry.level.padEnd(6)}</Text>
            <Text>: {entry.message}</Text>
          </Box>
        ))}
        {filteredLogEntries.length === 0 && <Text dimColor>No log entries match filters.</Text>}
      </Box>

      {/* Footer */}
      <Box marginTop={1} justifyContent="space-between" paddingX={1}>
        <Text dimColor>[↑↓] Scroll [PgUp/Dn] Page [Home/End] Top/Bottom</Text>
        <Text dimColor>[f] Filter [a] Auto-scroll [/] Search [c] Copy (NYI)</Text>
      </Box>
    </Box>
  );
};

export default FullLogViewScreen;
