/**
 * Chat Command Parser
 * 
 * Parses chat commands like:
 * - /send 1 SOL to @Alice
 * - /send 5 USDC to @Bob
 * - /send 0.5 ZEC to @Charlie
 * - /send 1 multi to @Alice (shows selector with SOL/USDC/ZEC)
 */

export type TokenType = 'SOL' | 'USDC' | 'ZEC' | 'multi';

export interface SendCommandResult {
  type: 'send';
  amount: number;
  token: TokenType;
  recipient: string;
  rawCommand: string;
}

export interface InvalidCommandResult {
  type: 'invalid';
  error: string;
  rawCommand: string;
}

export type CommandParseResult = SendCommandResult | InvalidCommandResult | null;

/**
 * Parse a chat message for commands
 * @param message The message to parse
 * @returns Command result or null if not a command
 */
export function parseCommand(message: string): CommandParseResult {
  const trimmed = message.trim();
  
  // Check if it's a command (starts with /)
  if (!trimmed.startsWith('/')) {
    return null;
  }

  // Parse /send command
  if (trimmed.toLowerCase().startsWith('/send')) {
    return parseSendCommand(trimmed);
  }

  // Unknown command
  return {
    type: 'invalid',
    error: 'Unknown command. Try: /send <amount> <token> to @<recipient>',
    rawCommand: trimmed,
  };
}

/**
 * Parse /send command
 * Format: /send <amount> <token> to @<recipient>
 * Examples:
 * - /send 1 SOL to @Alice
 * - /send 5 USDC to @Bob
 * - /send 1 multi to @Alice (shows all tokens)
 */
function parseSendCommand(command: string): SendCommandResult | InvalidCommandResult {
  // Pattern: /send <amount> <token> to @<recipient>
  const pattern = /^\/send\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|ZEC|multi)\s+to\s+@(\w+)/i;
  const match = command.match(pattern);

  if (!match) {
    return {
      type: 'invalid',
      error: 'Invalid format. Use: /send <amount> <token> to @<recipient>\nExample: /send 1 SOL to @Alice',
      rawCommand: command,
    };
  }

  const [, amountStr, tokenStr, recipient] = match;
  const amount = parseFloat(amountStr);
  const token = tokenStr.toUpperCase() as TokenType;

  // Validate amount
  if (isNaN(amount) || amount <= 0) {
    return {
      type: 'invalid',
      error: 'Amount must be a positive number',
      rawCommand: command,
    };
  }

  // Validate token
  if (!['SOL', 'USDC', 'ZEC', 'MULTI'].includes(token)) {
    return {
      type: 'invalid',
      error: 'Token must be SOL, USDC, ZEC, or multi',
      rawCommand: command,
    };
  }

  return {
    type: 'send',
    amount,
    token,
    recipient,
    rawCommand: command,
  };
}

/**
 * Format a send command result as a display string
 */
export function formatSendCommand(cmd: SendCommandResult): string {
  if (cmd.token === 'multi') {
    return `Send ${cmd.amount} (select token) to @${cmd.recipient}`;
  }
  return `Send ${cmd.amount} ${cmd.token} to @${cmd.recipient}`;
}

/**
 * Get command suggestions based on partial input
 */
export function getCommandSuggestions(partial: string): string[] {
  const lower = partial.toLowerCase().trim();
  
  if (!lower.startsWith('/')) {
    return [];
  }

  const suggestions: string[] = [];

  // /send suggestions
  if ('/send'.startsWith(lower) || lower === '/') {
    suggestions.push('/send <amount> <token> to @<recipient>');
  } else if (lower.startsWith('/send')) {
    suggestions.push(
      '/send 1 SOL to @Alice',
      '/send 5 USDC to @Bob',
      '/send 0.5 ZEC to @Charlie',
      '/send 1 multi to @Alice (select token)'
    );
  }

  return suggestions;
}
