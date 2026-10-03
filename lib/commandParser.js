/**
 * Command Parser & Handler
 * Parses chat comments into structured game commands with rate limiting and validation.
 */
import logger from './logger.js';
import { chatCommandLimiter, sanitizeText } from './security.js';

export class CommandParser {
  constructor() {
    this.commands = new Map();
    this.initDefaultCommands();
  }

  initDefaultCommands() {
    this.register('join', {
      aliases: ['!join', 'join', 'انضمام', 'تم', 'دخول', '!دخول', '!انضمام'],
      description: 'تسجيل المشاهد في الجولة الحالية للمسابقة والسحب',
      permission: 'ALL',
      enabled: true
    });

    this.register('answer', {
      aliases: ['!answer', '!a', '!اجابة', '!إجابة', 'answer'],
      description: 'تقديم إجابة على السؤال الحالي بالأرقام 1 أو 2 أو 3 أو 4',
      permission: 'ALL',
      enabled: true
    });

    this.register('score', {
      aliases: ['!score', '!نقاط', '!نقاطي', 'score'],
      description: 'عرض الرصيد الحالي للنقاط والإحصائيات',
      permission: 'ALL',
      enabled: true
    });

    this.register('rank', {
      aliases: ['!rank', '!ترتيبي', '!الترتيب', 'rank'],
      description: 'عرض الترتيب في لوحة الشرف المباشرة',
      permission: 'ALL',
      enabled: true
    });

    this.register('help', {
      aliases: ['!help', '!مساعدة', '!اوامر', '!أوامر', 'help'],
      description: 'عرض قائمة الأوامر المتاحة في الشات',
      permission: 'ALL',
      enabled: true
    });

    this.register('start', {
      aliases: ['!start', '!ابدأ', '!بدء'],
      description: 'بدء الجولة (للمشرفين فقط)',
      permission: 'OPERATOR',
      enabled: true
    });
  }

  register(name, config) {
    this.commands.set(name.toLowerCase(), {
      name: name.toLowerCase(),
      aliases: (config.aliases || [name]).map(a => a.toLowerCase()),
      description: config.description || '',
      permission: config.permission || 'ALL',
      enabled: config.enabled !== undefined ? config.enabled : true
    });
  }

  parse(rawComment, user = {}) {
    if (!rawComment || typeof rawComment !== 'string') return null;
    const clean = sanitizeText(rawComment.trim(), 200);
    if (!clean) return null;

    const lower = clean.toLowerCase();
    const parts = clean.split(/\s+/);
    const firstWord = parts[0].toLowerCase();
    const args = parts.slice(1);

    const userId = user.id || user.uniqueId || 'anon';
    const rateCheck = chatCommandLimiter.check(userId);
    if (!rateCheck.allowed) {
      logger.warn('Chat command rate limited', { userId, comment: clean });
      return { isCommand: false, error: 'RATE_LIMITED' };
    }

    const numericAnswer = this.parseStandaloneAnswer(clean);
    if (numericAnswer) {
      return {
        isCommand: true,
        commandName: 'answer',
        action: 'ANSWER',
        args: [numericAnswer],
        value: numericAnswer,
        rawComment: clean,
        user
      };
    }

    const joinAliases = ['تم', 'انضمام', 'دخول', '!join', '!دخول', '!انضمام'];
    if (joinAliases.includes(lower)) {
      return {
        isCommand: true,
        commandName: 'join',
        action: 'JOIN',
        args: [],
        rawComment: clean,
        user
      };
    }

    for (const [cmdName, cmd] of this.commands.entries()) {
      if (!cmd.enabled) continue;
      const matchedAlias = cmd.aliases.find(alias => {
        return firstWord === alias || (alias.startsWith('!') && lower === alias);
      });

      if (matchedAlias) {
        return {
          isCommand: true,
          commandName: cmdName,
          action: cmdName.toUpperCase(),
          args,
          value: args.join(' '),
          rawComment: clean,
          user
        };
      }
    }

    return { isCommand: false, rawComment: clean, user };
  }

  parseStandaloneAnswer(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    const numericMap = {
      '1': '1',
      '2': '2',
      '3': '3',
      '4': '4'
    };

    return numericMap[trimmed] || null;
    return null;
  }

  getCommandList() {
    return Array.from(this.commands.values());
  }

  updateCommand(name, patch) {
    const cmd = this.commands.get(name.toLowerCase());
    if (!cmd) return null;
    Object.assign(cmd, patch);
    return cmd;
  }
}

export const commandParser = new CommandParser();
export default commandParser;

// Load the automatic participant collection/preparation flow after parser initialization.
import './autoParticipantFlow.js';
