import { RESET, CYAN, MAGENTA, BOLD, GRAY, RED, GREEN, YELLOW, BLUE } from './table.js';

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

export const log = {
  info(msg: string, ...args: unknown[]) {
    console.log(`${GRAY}${timestamp()}${RESET} ${BLUE}INFO${RESET}  ${msg}`, ...args);
  },
  success(msg: string, ...args: unknown[]) {
    console.log(`${GRAY}${timestamp()}${RESET} ${GREEN}OK${RESET}    ${msg}`, ...args);
  },
  warn(msg: string, ...args: unknown[]) {
    console.warn(`${GRAY}${timestamp()}${RESET} ${YELLOW}WARN${RESET}  ${msg}`, ...args);
  },
  error(msg: string, ...args: unknown[]) {
    console.error(`${GRAY}${timestamp()}${RESET} ${RED}ERROR${RESET} ${msg}`, ...args);
  },
  debug(msg: string, ...args: unknown[]) {
    if (process.env.DEBUG) {
      console.log(`${GRAY}${timestamp()} DEBUG ${msg}${RESET}`, ...args);
    }
  },
  banner(text: string) {
    const line = '─'.repeat(text.length + 4);
    console.log(`\n${CYAN}┌${line}┐${RESET}`);
    console.log(`${CYAN}│${RESET}  ${BOLD}${text}${RESET}  ${CYAN}│${RESET}`);
    console.log(`${CYAN}└${line}┘${RESET}\n`);
  },
};
