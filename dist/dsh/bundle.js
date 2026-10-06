var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/picomatch/lib/constants.js
var require_constants = __commonJS({
  "node_modules/picomatch/lib/constants.js"(exports, module) {
    "use strict";
    var WIN_SLASH = "\\\\/";
    var WIN_NO_SLASH = `[^${WIN_SLASH}]`;
    var DEFAULT_MAX_EXTGLOB_RECURSION = 0;
    var DOT_LITERAL = "\\.";
    var PLUS_LITERAL = "\\+";
    var QMARK_LITERAL = "\\?";
    var SLASH_LITERAL = "\\/";
    var ONE_CHAR = "(?=.)";
    var QMARK = "[^/]";
    var END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
    var START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
    var DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
    var NO_DOT = `(?!${DOT_LITERAL})`;
    var NO_DOTS = `(?!${START_ANCHOR}${DOTS_SLASH})`;
    var NO_DOT_SLASH = `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`;
    var NO_DOTS_SLASH = `(?!${DOTS_SLASH})`;
    var QMARK_NO_DOT = `[^.${SLASH_LITERAL}]`;
    var STAR = `${QMARK}*?`;
    var SEP = "/";
    var POSIX_CHARS = {
      DOT_LITERAL,
      PLUS_LITERAL,
      QMARK_LITERAL,
      SLASH_LITERAL,
      ONE_CHAR,
      QMARK,
      END_ANCHOR,
      DOTS_SLASH,
      NO_DOT,
      NO_DOTS,
      NO_DOT_SLASH,
      NO_DOTS_SLASH,
      QMARK_NO_DOT,
      STAR,
      START_ANCHOR,
      SEP
    };
    var WINDOWS_CHARS = {
      ...POSIX_CHARS,
      SLASH_LITERAL: `[${WIN_SLASH}]`,
      QMARK: WIN_NO_SLASH,
      STAR: `${WIN_NO_SLASH}*?`,
      DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
      NO_DOT: `(?!${DOT_LITERAL})`,
      NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
      NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
      START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
      END_ANCHOR: `(?:[${WIN_SLASH}]|$)`,
      SEP: "\\"
    };
    var POSIX_REGEX_SOURCE = {
      __proto__: null,
      alnum: "a-zA-Z0-9",
      alpha: "a-zA-Z",
      ascii: "\\x00-\\x7F",
      blank: " \\t",
      cntrl: "\\x00-\\x1F\\x7F",
      digit: "0-9",
      graph: "\\x21-\\x7E",
      lower: "a-z",
      print: "\\x20-\\x7E ",
      punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
      space: " \\t\\r\\n\\v\\f",
      upper: "A-Z",
      word: "A-Za-z0-9_",
      xdigit: "A-Fa-f0-9"
    };
    module.exports = {
      DEFAULT_MAX_EXTGLOB_RECURSION,
      MAX_LENGTH: 1024 * 64,
      POSIX_REGEX_SOURCE,
      // regular expressions
      REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
      REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
      REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
      REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
      REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
      REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
      // Replace globs with equivalent patterns to reduce parsing time.
      REPLACEMENTS: {
        __proto__: null,
        "***": "*",
        "**/**": "**",
        "**/**/**": "**"
      },
      // Digits
      CHAR_0: 48,
      /* 0 */
      CHAR_9: 57,
      /* 9 */
      // Alphabet chars.
      CHAR_UPPERCASE_A: 65,
      /* A */
      CHAR_LOWERCASE_A: 97,
      /* a */
      CHAR_UPPERCASE_Z: 90,
      /* Z */
      CHAR_LOWERCASE_Z: 122,
      /* z */
      CHAR_LEFT_PARENTHESES: 40,
      /* ( */
      CHAR_RIGHT_PARENTHESES: 41,
      /* ) */
      CHAR_ASTERISK: 42,
      /* * */
      // Non-alphabetic chars.
      CHAR_AMPERSAND: 38,
      /* & */
      CHAR_AT: 64,
      /* @ */
      CHAR_BACKWARD_SLASH: 92,
      /* \ */
      CHAR_CARRIAGE_RETURN: 13,
      /* \r */
      CHAR_CIRCUMFLEX_ACCENT: 94,
      /* ^ */
      CHAR_COLON: 58,
      /* : */
      CHAR_COMMA: 44,
      /* , */
      CHAR_DOT: 46,
      /* . */
      CHAR_DOUBLE_QUOTE: 34,
      /* " */
      CHAR_EQUAL: 61,
      /* = */
      CHAR_EXCLAMATION_MARK: 33,
      /* ! */
      CHAR_FORM_FEED: 12,
      /* \f */
      CHAR_FORWARD_SLASH: 47,
      /* / */
      CHAR_GRAVE_ACCENT: 96,
      /* ` */
      CHAR_HASH: 35,
      /* # */
      CHAR_HYPHEN_MINUS: 45,
      /* - */
      CHAR_LEFT_ANGLE_BRACKET: 60,
      /* < */
      CHAR_LEFT_CURLY_BRACE: 123,
      /* { */
      CHAR_LEFT_SQUARE_BRACKET: 91,
      /* [ */
      CHAR_LINE_FEED: 10,
      /* \n */
      CHAR_NO_BREAK_SPACE: 160,
      /* \u00A0 */
      CHAR_PERCENT: 37,
      /* % */
      CHAR_PLUS: 43,
      /* + */
      CHAR_QUESTION_MARK: 63,
      /* ? */
      CHAR_RIGHT_ANGLE_BRACKET: 62,
      /* > */
      CHAR_RIGHT_CURLY_BRACE: 125,
      /* } */
      CHAR_RIGHT_SQUARE_BRACKET: 93,
      /* ] */
      CHAR_SEMICOLON: 59,
      /* ; */
      CHAR_SINGLE_QUOTE: 39,
      /* ' */
      CHAR_SPACE: 32,
      /*   */
      CHAR_TAB: 9,
      /* \t */
      CHAR_UNDERSCORE: 95,
      /* _ */
      CHAR_VERTICAL_LINE: 124,
      /* | */
      CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
      /* \uFEFF */
      /**
       * Create EXTGLOB_CHARS
       */
      extglobChars(chars) {
        return {
          "!": { type: "negate", open: "(?:(?!(?:", close: `))${chars.STAR})` },
          "?": { type: "qmark", open: "(?:", close: ")?" },
          "+": { type: "plus", open: "(?:", close: ")+" },
          "*": { type: "star", open: "(?:", close: ")*" },
          "@": { type: "at", open: "(?:", close: ")" }
        };
      },
      /**
       * Create GLOB_CHARS
       */
      globChars(win32) {
        return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
      }
    };
  }
});

// node_modules/picomatch/lib/utils.js
var require_utils = __commonJS({
  "node_modules/picomatch/lib/utils.js"(exports) {
    "use strict";
    var {
      REGEX_BACKSLASH,
      REGEX_REMOVE_BACKSLASH,
      REGEX_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_GLOBAL
    } = require_constants();
    exports.isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
    exports.hasRegexChars = (str) => REGEX_SPECIAL_CHARS.test(str);
    exports.isRegexChar = (str) => str.length === 1 && exports.hasRegexChars(str);
    exports.escapeRegex = (str) => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1");
    exports.toPosixSlashes = (str) => str.replace(REGEX_BACKSLASH, "/");
    exports.isWindows = () => {
      if (typeof navigator !== "undefined" && navigator.platform) {
        const platform = navigator.platform.toLowerCase();
        return platform === "win32" || platform === "windows";
      }
      if (typeof process !== "undefined" && process.platform) {
        return process.platform === "win32";
      }
      return false;
    };
    exports.removeBackslashes = (str) => {
      return str.replace(REGEX_REMOVE_BACKSLASH, (match) => {
        return match === "\\" ? "" : match;
      });
    };
    exports.escapeLast = (input, char, lastIdx) => {
      const idx = input.lastIndexOf(char, lastIdx);
      if (idx === -1) return input;
      if (input[idx - 1] === "\\") return exports.escapeLast(input, char, idx - 1);
      return `${input.slice(0, idx)}\\${input.slice(idx)}`;
    };
    exports.removePrefix = (input, state = {}) => {
      let output = input;
      if (output.startsWith("./")) {
        output = output.slice(2);
        state.prefix = "./";
      }
      return output;
    };
    exports.wrapOutput = (input, state = {}, options = {}) => {
      const prepend = options.contains ? "" : "^";
      const append = options.contains ? "" : "$";
      let output = `${prepend}(?:${input})${append}`;
      if (state.negated === true) {
        output = `(?:^(?!${output}).*$)`;
      }
      return output;
    };
    exports.basename = (path, { windows } = {}) => {
      const segs = path.split(windows ? /[\\/]/ : "/");
      const last = segs[segs.length - 1];
      if (last === "") {
        return segs[segs.length - 2];
      }
      return last;
    };
  }
});

// node_modules/picomatch/lib/scan.js
var require_scan = __commonJS({
  "node_modules/picomatch/lib/scan.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    var {
      CHAR_ASTERISK,
      /* * */
      CHAR_AT,
      /* @ */
      CHAR_BACKWARD_SLASH,
      /* \ */
      CHAR_COMMA,
      /* , */
      CHAR_DOT,
      /* . */
      CHAR_EXCLAMATION_MARK,
      /* ! */
      CHAR_FORWARD_SLASH,
      /* / */
      CHAR_LEFT_CURLY_BRACE,
      /* { */
      CHAR_LEFT_PARENTHESES,
      /* ( */
      CHAR_LEFT_SQUARE_BRACKET,
      /* [ */
      CHAR_PLUS,
      /* + */
      CHAR_QUESTION_MARK,
      /* ? */
      CHAR_RIGHT_CURLY_BRACE,
      /* } */
      CHAR_RIGHT_PARENTHESES,
      /* ) */
      CHAR_RIGHT_SQUARE_BRACKET
      /* ] */
    } = require_constants();
    var isPathSeparator = (code) => {
      return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
    };
    var depth = (token) => {
      if (token.isPrefix !== true) {
        token.depth = token.isGlobstar ? Infinity : 1;
      }
    };
    var scan = (input, options) => {
      const opts = options || {};
      const length = input.length - 1;
      const scanToEnd = opts.parts === true || opts.scanToEnd === true;
      const slashes = [];
      const tokens = [];
      const parts = [];
      let str = input;
      let index = -1;
      let start = 0;
      let lastIndex = 0;
      let isBrace = false;
      let isBracket = false;
      let isGlob = false;
      let isExtglob = false;
      let isGlobstar = false;
      let braceEscaped = false;
      let backslashes = false;
      let negated = false;
      let negatedExtglob = false;
      let finished = false;
      let braces = 0;
      let prev;
      let code;
      let token = { value: "", depth: 0, isGlob: false };
      const eos = () => index >= length;
      const peek = () => str.charCodeAt(index + 1);
      const advance = () => {
        prev = code;
        return str.charCodeAt(++index);
      };
      while (index < length) {
        code = advance();
        let next;
        if (code === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          code = advance();
          if (code === CHAR_LEFT_CURLY_BRACE) {
            braceEscaped = true;
          }
          continue;
        }
        if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
          braces++;
          while (eos() !== true && (code = advance())) {
            if (code === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (code === CHAR_LEFT_CURLY_BRACE) {
              braces++;
              continue;
            }
            if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (braceEscaped !== true && code === CHAR_COMMA) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (code === CHAR_RIGHT_CURLY_BRACE) {
              braces--;
              if (braces === 0) {
                braceEscaped = false;
                isBrace = token.isBrace = true;
                finished = true;
                break;
              }
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_FORWARD_SLASH) {
          slashes.push(index);
          tokens.push(token);
          token = { value: "", depth: 0, isGlob: false };
          if (finished === true) continue;
          if (prev === CHAR_DOT && index === start + 1) {
            start += 2;
            continue;
          }
          lastIndex = index + 1;
          continue;
        }
        if (opts.noext !== true) {
          const isExtglobChar = code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK;
          if (isExtglobChar === true && peek() === CHAR_LEFT_PARENTHESES) {
            isGlob = token.isGlob = true;
            isExtglob = token.isExtglob = true;
            finished = true;
            if (code === CHAR_EXCLAMATION_MARK && index === start) {
              negatedExtglob = true;
            }
            if (scanToEnd === true) {
              while (eos() !== true && (code = advance())) {
                if (code === CHAR_BACKWARD_SLASH) {
                  backslashes = token.backslashes = true;
                  code = advance();
                  continue;
                }
                if (code === CHAR_RIGHT_PARENTHESES) {
                  isGlob = token.isGlob = true;
                  finished = true;
                  break;
                }
              }
              continue;
            }
            break;
          }
        }
        if (code === CHAR_ASTERISK) {
          if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_QUESTION_MARK) {
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_LEFT_SQUARE_BRACKET) {
          while (eos() !== true && (next = advance())) {
            if (next === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (next === CHAR_RIGHT_SQUARE_BRACKET) {
              isBracket = token.isBracket = true;
              isGlob = token.isGlob = true;
              finished = true;
              break;
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
          negated = token.negated = true;
          start++;
          continue;
        }
        if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
          isGlob = token.isGlob = true;
          if (scanToEnd === true) {
            while (eos() !== true && (code = advance())) {
              if (code === CHAR_LEFT_PARENTHESES) {
                backslashes = token.backslashes = true;
                code = advance();
                continue;
              }
              if (code === CHAR_RIGHT_PARENTHESES) {
                finished = true;
                break;
              }
            }
            continue;
          }
          break;
        }
        if (isGlob === true) {
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
      }
      if (opts.noext === true) {
        isExtglob = false;
        isGlob = false;
      }
      let base = str;
      let prefix = "";
      let glob = "";
      if (start > 0) {
        prefix = str.slice(0, start);
        str = str.slice(start);
        lastIndex -= start;
      }
      if (base && isGlob === true && lastIndex > 0) {
        base = str.slice(0, lastIndex);
        glob = str.slice(lastIndex);
      } else if (isGlob === true) {
        base = "";
        glob = str;
      } else {
        base = str;
      }
      if (base && base !== "" && base !== "/" && base !== str) {
        if (isPathSeparator(base.charCodeAt(base.length - 1))) {
          base = base.slice(0, -1);
        }
      }
      if (opts.unescape === true) {
        if (glob) glob = utils.removeBackslashes(glob);
        if (base && backslashes === true) {
          base = utils.removeBackslashes(base);
        }
      }
      const state = {
        prefix,
        input,
        start,
        base,
        glob,
        isBrace,
        isBracket,
        isGlob,
        isExtglob,
        isGlobstar,
        negated,
        negatedExtglob
      };
      if (opts.tokens === true) {
        state.maxDepth = 0;
        if (!isPathSeparator(code)) {
          tokens.push(token);
        }
        state.tokens = tokens;
      }
      if (opts.parts === true || opts.tokens === true) {
        let prevIndex;
        for (let idx = 0; idx < slashes.length; idx++) {
          const n = prevIndex ? prevIndex + 1 : start;
          const i = slashes[idx];
          const value = input.slice(n, i);
          if (opts.tokens) {
            if (idx === 0 && start !== 0) {
              tokens[idx].isPrefix = true;
              tokens[idx].value = prefix;
            } else {
              tokens[idx].value = value;
            }
            depth(tokens[idx]);
            state.maxDepth += tokens[idx].depth;
          }
          if (idx !== 0 || value !== "") {
            parts.push(value);
          }
          prevIndex = i;
        }
        if (prevIndex && prevIndex + 1 < input.length) {
          const value = input.slice(prevIndex + 1);
          parts.push(value);
          if (opts.tokens) {
            tokens[tokens.length - 1].value = value;
            depth(tokens[tokens.length - 1]);
            state.maxDepth += tokens[tokens.length - 1].depth;
          }
        }
        state.slashes = slashes;
        state.parts = parts;
      }
      return state;
    };
    module.exports = scan;
  }
});

// node_modules/picomatch/lib/parse.js
var require_parse = __commonJS({
  "node_modules/picomatch/lib/parse.js"(exports, module) {
    "use strict";
    var constants = require_constants();
    var utils = require_utils();
    var {
      MAX_LENGTH,
      POSIX_REGEX_SOURCE,
      REGEX_NON_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_BACKREF,
      REPLACEMENTS
    } = constants;
    var expandRange = (args, options) => {
      if (typeof options.expandRange === "function") {
        return options.expandRange(...args, options);
      }
      args.sort();
      const value = `[${args.join("-")}]`;
      try {
        new RegExp(value);
      } catch (ex) {
        return args.map((v) => utils.escapeRegex(v)).join("..");
      }
      return value;
    };
    var syntaxError = (type, char) => {
      return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
    };
    var splitTopLevel = (input) => {
      const parts = [];
      let bracket = 0;
      let paren = 0;
      let quote = 0;
      let value = "";
      let escaped = false;
      for (const ch of input) {
        if (escaped === true) {
          value += ch;
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          value += ch;
          escaped = true;
          continue;
        }
        if (ch === '"') {
          quote = quote === 1 ? 0 : 1;
          value += ch;
          continue;
        }
        if (quote === 0) {
          if (ch === "[") {
            bracket++;
          } else if (ch === "]" && bracket > 0) {
            bracket--;
          } else if (bracket === 0) {
            if (ch === "(") {
              paren++;
            } else if (ch === ")" && paren > 0) {
              paren--;
            } else if (ch === "|" && paren === 0) {
              parts.push(value);
              value = "";
              continue;
            }
          }
        }
        value += ch;
      }
      parts.push(value);
      return parts;
    };
    var isPlainBranch = (branch) => {
      let escaped = false;
      for (const ch of branch) {
        if (escaped === true) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (/[?*+@!()[\]{}]/.test(ch)) {
          return false;
        }
      }
      return true;
    };
    var normalizeSimpleBranch = (branch) => {
      let value = branch.trim();
      let changed = true;
      while (changed === true) {
        changed = false;
        if (/^@\([^\\()[\]{}|]+\)$/.test(value)) {
          value = value.slice(2, -1);
          changed = true;
        }
      }
      if (!isPlainBranch(value)) {
        return;
      }
      return value.replace(/\\(.)/g, "$1");
    };
    var hasRepeatedCharPrefixOverlap = (branches) => {
      const values = branches.map(normalizeSimpleBranch).filter(Boolean);
      for (let i = 0; i < values.length; i++) {
        for (let j = i + 1; j < values.length; j++) {
          const a = values[i];
          const b = values[j];
          const char = a[0];
          if (!char || a !== char.repeat(a.length) || b !== char.repeat(b.length)) {
            continue;
          }
          if (a === b || a.startsWith(b) || b.startsWith(a)) {
            return true;
          }
        }
      }
      return false;
    };
    var parseRepeatedExtglob = (pattern, requireEnd = true) => {
      if (pattern[0] !== "+" && pattern[0] !== "*" || pattern[1] !== "(") {
        return;
      }
      let bracket = 0;
      let paren = 0;
      let quote = 0;
      let escaped = false;
      for (let i = 1; i < pattern.length; i++) {
        const ch = pattern[i];
        if (escaped === true) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          quote = quote === 1 ? 0 : 1;
          continue;
        }
        if (quote === 1) {
          continue;
        }
        if (ch === "[") {
          bracket++;
          continue;
        }
        if (ch === "]" && bracket > 0) {
          bracket--;
          continue;
        }
        if (bracket > 0) {
          continue;
        }
        if (ch === "(") {
          paren++;
          continue;
        }
        if (ch === ")") {
          paren--;
          if (paren === 0) {
            if (requireEnd === true && i !== pattern.length - 1) {
              return;
            }
            return {
              type: pattern[0],
              body: pattern.slice(2, i),
              end: i
            };
          }
        }
      }
    };
    var getStarExtglobSequenceOutput = (pattern) => {
      let index = 0;
      const chars = [];
      while (index < pattern.length) {
        const match = parseRepeatedExtglob(pattern.slice(index), false);
        if (!match || match.type !== "*") {
          return;
        }
        const branches = splitTopLevel(match.body).map((branch2) => branch2.trim());
        if (branches.length !== 1) {
          return;
        }
        const branch = normalizeSimpleBranch(branches[0]);
        if (!branch || branch.length !== 1) {
          return;
        }
        chars.push(branch);
        index += match.end + 1;
      }
      if (chars.length < 1) {
        return;
      }
      const source = chars.length === 1 ? utils.escapeRegex(chars[0]) : `[${chars.map((ch) => utils.escapeRegex(ch)).join("")}]`;
      return `${source}*`;
    };
    var repeatedExtglobRecursion = (pattern) => {
      let depth = 0;
      let value = pattern.trim();
      let match = parseRepeatedExtglob(value);
      while (match) {
        depth++;
        value = match.body.trim();
        match = parseRepeatedExtglob(value);
      }
      return depth;
    };
    var analyzeRepeatedExtglob = (body, options) => {
      if (options.maxExtglobRecursion === false) {
        return { risky: false };
      }
      const max = typeof options.maxExtglobRecursion === "number" ? options.maxExtglobRecursion : constants.DEFAULT_MAX_EXTGLOB_RECURSION;
      const branches = splitTopLevel(body).map((branch) => branch.trim());
      if (branches.length > 1) {
        if (branches.some((branch) => branch === "") || branches.some((branch) => /^[*?]+$/.test(branch)) || hasRepeatedCharPrefixOverlap(branches)) {
          return { risky: true };
        }
      }
      for (const branch of branches) {
        const safeOutput = getStarExtglobSequenceOutput(branch);
        if (safeOutput) {
          return { risky: true, safeOutput };
        }
        if (repeatedExtglobRecursion(branch) > max) {
          return { risky: true };
        }
      }
      return { risky: false };
    };
    var parse = (input, options) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected a string");
      }
      input = REPLACEMENTS[input] || input;
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      let len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      const bos = { type: "bos", value: "", output: opts.prepend || "" };
      const tokens = [bos];
      const capture = opts.capture ? "" : "?:";
      const PLATFORM_CHARS = constants.globChars(opts.windows);
      const EXTGLOB_CHARS = constants.extglobChars(PLATFORM_CHARS);
      const {
        DOT_LITERAL,
        PLUS_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOT_SLASH,
        NO_DOTS_SLASH,
        QMARK,
        QMARK_NO_DOT,
        STAR,
        START_ANCHOR
      } = PLATFORM_CHARS;
      const globstar = (opts2) => {
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const nodot = opts.dot ? "" : NO_DOT;
      const qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
      let star = opts.bash === true ? globstar(opts) : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      if (typeof opts.noext === "boolean") {
        opts.noextglob = opts.noext;
      }
      const state = {
        input,
        index: -1,
        start: 0,
        dot: opts.dot === true,
        consumed: "",
        output: "",
        prefix: "",
        backtrack: false,
        negated: false,
        brackets: 0,
        braces: 0,
        parens: 0,
        quotes: 0,
        globstar: false,
        tokens
      };
      input = utils.removePrefix(input, state);
      len = input.length;
      const extglobs = [];
      const braces = [];
      const stack = [];
      let prev = bos;
      let value;
      const eos = () => state.index === len - 1;
      const peek = state.peek = (n = 1) => input[state.index + n];
      const advance = state.advance = () => input[++state.index] || "";
      const remaining = () => input.slice(state.index + 1);
      const consume = (value2 = "", num = 0) => {
        state.consumed += value2;
        state.index += num;
      };
      const append = (token) => {
        state.output += token.output != null ? token.output : token.value;
        consume(token.value);
      };
      const negate = () => {
        let count = 1;
        while (peek() === "!" && (peek(2) !== "(" || peek(3) === "?")) {
          advance();
          state.start++;
          count++;
        }
        if (count % 2 === 0) {
          return false;
        }
        state.negated = true;
        state.start++;
        return true;
      };
      const increment = (type) => {
        state[type]++;
        stack.push(type);
      };
      const decrement = (type) => {
        state[type]--;
        stack.pop();
      };
      const push = (tok) => {
        if (prev.type === "globstar") {
          const isBrace = state.braces > 0 && (tok.type === "comma" || tok.type === "brace");
          const isExtglob = tok.extglob === true || extglobs.length && (tok.type === "pipe" || tok.type === "paren");
          if (tok.type !== "slash" && tok.type !== "paren" && !isBrace && !isExtglob) {
            state.output = state.output.slice(0, -prev.output.length);
            prev.type = "star";
            prev.value = "*";
            prev.output = star;
            state.output += prev.output;
          }
        }
        if (extglobs.length && tok.type !== "paren") {
          extglobs[extglobs.length - 1].inner += tok.value;
        }
        if (tok.value || tok.output) append(tok);
        if (prev && prev.type === "text" && tok.type === "text") {
          prev.output = (prev.output || prev.value) + tok.value;
          prev.value += tok.value;
          return;
        }
        tok.prev = prev;
        tokens.push(tok);
        prev = tok;
      };
      const extglobOpen = (type, value2) => {
        const token = { ...EXTGLOB_CHARS[value2], conditions: 1, inner: "" };
        token.prev = prev;
        token.parens = state.parens;
        token.output = state.output;
        token.startIndex = state.index;
        token.tokensIndex = tokens.length;
        const output = (opts.capture ? "(" : "") + token.open;
        increment("parens");
        push({ type, value: value2, output: state.output ? "" : ONE_CHAR });
        push({ type: "paren", extglob: true, value: advance(), output });
        extglobs.push(token);
      };
      const extglobClose = (token) => {
        const literal = input.slice(token.startIndex, state.index + 1);
        const body = input.slice(token.startIndex + 2, state.index);
        const analysis = analyzeRepeatedExtglob(body, opts);
        if ((token.type === "plus" || token.type === "star") && analysis.risky) {
          const safeOutput = analysis.safeOutput ? (token.output ? "" : ONE_CHAR) + (opts.capture ? `(${analysis.safeOutput})` : analysis.safeOutput) : void 0;
          const open = tokens[token.tokensIndex];
          open.type = "text";
          open.value = literal;
          open.output = safeOutput || utils.escapeRegex(literal);
          for (let i = token.tokensIndex + 1; i < tokens.length; i++) {
            tokens[i].value = "";
            tokens[i].output = "";
            delete tokens[i].suffix;
          }
          state.output = token.output + open.output;
          state.backtrack = true;
          push({ type: "paren", extglob: true, value, output: "" });
          decrement("parens");
          return;
        }
        let output = token.close + (opts.capture ? ")" : "");
        let rest;
        if (token.type === "negate") {
          let extglobStar = star;
          if (token.inner && token.inner.length > 1 && token.inner.includes("/")) {
            extglobStar = globstar(opts);
          }
          if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
            output = token.close = `)$))${extglobStar}`;
          }
          if (token.inner.includes("*") && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) {
            const expression = parse(rest, { ...options, fastpaths: false }).output;
            output = token.close = `)${expression})${extglobStar})`;
          }
          if (token.prev.type === "bos") {
            state.negatedExtglob = true;
          }
        }
        push({ type: "paren", extglob: true, value, output });
        decrement("parens");
      };
      if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
        let backslashes = false;
        let output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index) => {
          if (first === "\\") {
            backslashes = true;
            return m;
          }
          if (first === "?") {
            if (esc) {
              return esc + first + (rest ? QMARK.repeat(rest.length) : "");
            }
            if (index === 0) {
              return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : "");
            }
            return QMARK.repeat(chars.length);
          }
          if (first === ".") {
            return DOT_LITERAL.repeat(chars.length);
          }
          if (first === "*") {
            if (esc) {
              return esc + first + (rest ? star : "");
            }
            return star;
          }
          return esc ? m : `\\${m}`;
        });
        if (backslashes === true) {
          if (opts.unescape === true) {
            output = output.replace(/\\/g, "");
          } else {
            output = output.replace(/\\+/g, (m) => {
              return m.length % 2 === 0 ? "\\\\" : m ? "\\" : "";
            });
          }
        }
        if (output === input && opts.contains === true) {
          state.output = input;
          return state;
        }
        state.output = utils.wrapOutput(output, state, options);
        return state;
      }
      while (!eos()) {
        value = advance();
        if (value === "\0") {
          continue;
        }
        if (value === "\\") {
          const next = peek();
          if (next === "/" && opts.bash !== true) {
            continue;
          }
          if (next === "." || next === ";") {
            continue;
          }
          if (!next) {
            value += "\\";
            push({ type: "text", value });
            continue;
          }
          const match = /^\\+/.exec(remaining());
          let slashes = 0;
          if (match && match[0].length > 2) {
            slashes = match[0].length;
            state.index += slashes;
            if (slashes % 2 !== 0) {
              value += "\\";
            }
          }
          if (opts.unescape === true) {
            value = advance();
          } else {
            value += advance();
          }
          if (state.brackets === 0) {
            push({ type: "text", value });
            continue;
          }
        }
        if (state.brackets > 0 && (value !== "]" || prev.value === "[" || prev.value === "[^")) {
          if (opts.posix !== false && value === ":") {
            const inner = prev.value.slice(1);
            if (inner.includes("[")) {
              prev.posix = true;
              if (inner.includes(":")) {
                const idx = prev.value.lastIndexOf("[");
                const pre = prev.value.slice(0, idx);
                const rest2 = prev.value.slice(idx + 2);
                const posix = POSIX_REGEX_SOURCE[rest2];
                if (posix) {
                  prev.value = pre + posix;
                  state.backtrack = true;
                  advance();
                  if (!bos.output && tokens.indexOf(prev) === 1) {
                    bos.output = ONE_CHAR;
                  }
                  continue;
                }
              }
            }
          }
          if (value === "[" && peek() !== ":" || value === "-" && peek() === "]") {
            value = `\\${value}`;
          }
          if (value === "]" && (prev.value === "[" || prev.value === "[^")) {
            value = `\\${value}`;
          }
          if (opts.posix === true && value === "!" && prev.value === "[") {
            value = "^";
          }
          prev.value += value;
          append({ value });
          continue;
        }
        if (state.quotes === 1 && value !== '"') {
          value = utils.escapeRegex(value);
          prev.value += value;
          append({ value });
          continue;
        }
        if (value === '"') {
          state.quotes = state.quotes === 1 ? 0 : 1;
          if (opts.keepQuotes === true) {
            push({ type: "text", value });
          }
          continue;
        }
        if (value === "(") {
          increment("parens");
          push({ type: "paren", value });
          continue;
        }
        if (value === ")") {
          if (state.parens === 0 && opts.strictBrackets === true) {
            throw new SyntaxError(syntaxError("opening", "("));
          }
          const extglob = extglobs[extglobs.length - 1];
          if (extglob && state.parens === extglob.parens + 1) {
            extglobClose(extglobs.pop());
            continue;
          }
          push({ type: "paren", value, output: state.parens ? ")" : "\\)" });
          decrement("parens");
          continue;
        }
        if (value === "[") {
          if (opts.nobracket === true || !remaining().includes("]")) {
            if (opts.nobracket !== true && opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("closing", "]"));
            }
            value = `\\${value}`;
          } else {
            increment("brackets");
          }
          push({ type: "bracket", value });
          continue;
        }
        if (value === "]") {
          if (opts.nobracket === true || prev && prev.type === "bracket" && prev.value.length === 1) {
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          if (state.brackets === 0) {
            if (opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("opening", "["));
            }
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          decrement("brackets");
          const prevValue = prev.value.slice(1);
          if (prev.posix !== true && prevValue[0] === "^" && !prevValue.includes("/")) {
            value = `/${value}`;
          }
          prev.value += value;
          append({ value });
          if (opts.literalBrackets === false || utils.hasRegexChars(prevValue)) {
            continue;
          }
          const escaped = utils.escapeRegex(prev.value);
          state.output = state.output.slice(0, -prev.value.length);
          if (opts.literalBrackets === true) {
            state.output += escaped;
            prev.value = escaped;
            continue;
          }
          prev.value = `(${capture}${escaped}|${prev.value})`;
          state.output += prev.value;
          continue;
        }
        if (value === "{" && opts.nobrace !== true) {
          increment("braces");
          const open = {
            type: "brace",
            value,
            output: "(",
            outputIndex: state.output.length,
            tokensIndex: state.tokens.length
          };
          braces.push(open);
          push(open);
          continue;
        }
        if (value === "}") {
          const brace = braces[braces.length - 1];
          if (opts.nobrace === true || !brace) {
            push({ type: "text", value, output: value });
            continue;
          }
          let output = ")";
          if (brace.dots === true) {
            const arr = tokens.slice();
            const range = [];
            for (let i = arr.length - 1; i >= 0; i--) {
              tokens.pop();
              if (arr[i].type === "brace") {
                break;
              }
              if (arr[i].type !== "dots") {
                range.unshift(arr[i].value);
              }
            }
            output = expandRange(range, opts);
            state.backtrack = true;
          }
          if (brace.comma !== true && brace.dots !== true) {
            const out = state.output.slice(0, brace.outputIndex);
            const toks = state.tokens.slice(brace.tokensIndex);
            brace.value = brace.output = "\\{";
            value = output = "\\}";
            state.output = out;
            for (const t of toks) {
              state.output += t.output || t.value;
            }
          }
          push({ type: "brace", value, output });
          decrement("braces");
          braces.pop();
          continue;
        }
        if (value === "|") {
          if (extglobs.length > 0) {
            extglobs[extglobs.length - 1].conditions++;
          }
          push({ type: "text", value });
          continue;
        }
        if (value === ",") {
          let output = value;
          const brace = braces[braces.length - 1];
          if (brace && stack[stack.length - 1] === "braces") {
            brace.comma = true;
            output = "|";
          }
          push({ type: "comma", value, output });
          continue;
        }
        if (value === "/") {
          if (prev.type === "dot" && state.index === state.start + 1) {
            state.start = state.index + 1;
            state.consumed = "";
            state.output = "";
            tokens.pop();
            prev = bos;
            continue;
          }
          push({ type: "slash", value, output: SLASH_LITERAL });
          continue;
        }
        if (value === ".") {
          if (state.braces > 0 && prev.type === "dot") {
            if (prev.value === ".") prev.output = DOT_LITERAL;
            const brace = braces[braces.length - 1];
            prev.type = "dots";
            prev.output += value;
            prev.value += value;
            brace.dots = true;
            continue;
          }
          if (state.braces + state.parens === 0 && prev.type !== "bos" && prev.type !== "slash") {
            push({ type: "text", value, output: DOT_LITERAL });
            continue;
          }
          push({ type: "dot", value, output: DOT_LITERAL });
          continue;
        }
        if (value === "?") {
          const isGroup = prev && prev.value === "(";
          if (!isGroup && opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("qmark", value);
            continue;
          }
          if (prev && prev.type === "paren") {
            const next = peek();
            let output = value;
            if (prev.value === "(" && !/[!=<:]/.test(next) || next === "<" && !/<([!=]|\w+>)/.test(remaining())) {
              output = `\\${value}`;
            }
            push({ type: "text", value, output });
            continue;
          }
          if (opts.dot !== true && (prev.type === "slash" || prev.type === "bos")) {
            push({ type: "qmark", value, output: QMARK_NO_DOT });
            continue;
          }
          push({ type: "qmark", value, output: QMARK });
          continue;
        }
        if (value === "!") {
          if (opts.noextglob !== true && peek() === "(") {
            if (peek(2) !== "?" || !/[!=<:]/.test(peek(3))) {
              extglobOpen("negate", value);
              continue;
            }
          }
          if (opts.nonegate !== true && state.index === 0) {
            negate();
            continue;
          }
        }
        if (value === "+") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("plus", value);
            continue;
          }
          if (prev && prev.value === "(" || opts.regex === false) {
            push({ type: "plus", value, output: PLUS_LITERAL });
            continue;
          }
          if (prev && (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace") || state.parens > 0) {
            push({ type: "plus", value });
            continue;
          }
          push({ type: "plus", value: PLUS_LITERAL });
          continue;
        }
        if (value === "@") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            push({ type: "at", extglob: true, value, output: "" });
            continue;
          }
          push({ type: "text", value });
          continue;
        }
        if (value !== "*") {
          if (value === "$" || value === "^") {
            value = `\\${value}`;
          }
          const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
          if (match) {
            value += match[0];
            state.index += match[0].length;
          }
          push({ type: "text", value });
          continue;
        }
        if (prev && (prev.type === "globstar" || prev.star === true)) {
          prev.type = "star";
          prev.star = true;
          prev.value += value;
          prev.output = star;
          state.backtrack = true;
          state.globstar = true;
          consume(value);
          continue;
        }
        let rest = remaining();
        if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
          extglobOpen("star", value);
          continue;
        }
        if (prev.type === "star") {
          if (opts.noglobstar === true) {
            consume(value);
            continue;
          }
          const prior = prev.prev;
          const before = prior.prev;
          const isStart = prior.type === "slash" || prior.type === "bos";
          const afterStar = before && (before.type === "star" || before.type === "globstar");
          if (opts.bash === true && (!isStart || rest[0] && rest[0] !== "/")) {
            push({ type: "star", value, output: "" });
            continue;
          }
          const isBrace = state.braces > 0 && (prior.type === "comma" || prior.type === "brace");
          const isExtglob = extglobs.length && (prior.type === "pipe" || prior.type === "paren");
          if (!isStart && prior.type !== "paren" && !isBrace && !isExtglob) {
            push({ type: "star", value, output: "" });
            continue;
          }
          while (rest.slice(0, 3) === "/**") {
            const after = input[state.index + 4];
            if (after && after !== "/") {
              break;
            }
            rest = rest.slice(3);
            consume("/**", 3);
          }
          if (prior.type === "bos" && eos()) {
            prev.type = "globstar";
            prev.value += value;
            prev.output = globstar(opts);
            state.output = prev.output;
            state.globstar = true;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && !afterStar && eos()) {
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = globstar(opts) + (opts.strictSlashes ? ")" : "|$)");
            prev.value += value;
            state.globstar = true;
            state.output += prior.output + prev.output;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && rest[0] === "/") {
            const end = rest[1] !== void 0 ? "|$" : "";
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`;
            prev.value += value;
            state.output += prior.output + prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          if (prior.type === "bos" && rest[0] === "/") {
            prev.type = "globstar";
            prev.value += value;
            prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`;
            state.output = prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          state.output = state.output.slice(0, -prev.output.length);
          prev.type = "globstar";
          prev.output = globstar(opts);
          prev.value += value;
          state.output += prev.output;
          state.globstar = true;
          consume(value);
          continue;
        }
        const token = { type: "star", value, output: star };
        if (opts.bash === true) {
          token.output = ".*?";
          if (prev.type === "bos" || prev.type === "slash") {
            token.output = nodot + token.output;
          }
          push(token);
          continue;
        }
        if (prev && (prev.type === "bracket" || prev.type === "paren") && opts.regex === true) {
          token.output = value;
          push(token);
          continue;
        }
        if (state.index === state.start || prev.type === "slash" || prev.type === "dot") {
          if (prev.type === "dot") {
            state.output += NO_DOT_SLASH;
            prev.output += NO_DOT_SLASH;
          } else if (opts.dot === true) {
            state.output += NO_DOTS_SLASH;
            prev.output += NO_DOTS_SLASH;
          } else {
            state.output += nodot;
            prev.output += nodot;
          }
          if (peek() !== "*") {
            state.output += ONE_CHAR;
            prev.output += ONE_CHAR;
          }
        }
        push(token);
      }
      while (state.brackets > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
        state.output = utils.escapeLast(state.output, "[");
        decrement("brackets");
      }
      while (state.parens > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", ")"));
        state.output = utils.escapeLast(state.output, "(");
        decrement("parens");
      }
      while (state.braces > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "}"));
        state.output = utils.escapeLast(state.output, "{");
        decrement("braces");
      }
      if (opts.strictSlashes !== true && (prev.type === "star" || prev.type === "bracket")) {
        push({ type: "maybe_slash", value: "", output: `${SLASH_LITERAL}?` });
      }
      if (state.backtrack === true) {
        state.output = "";
        for (const token of state.tokens) {
          state.output += token.output != null ? token.output : token.value;
          if (token.suffix) {
            state.output += token.suffix;
          }
        }
      }
      return state;
    };
    parse.fastpaths = (input, options) => {
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      const len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      input = REPLACEMENTS[input] || input;
      const {
        DOT_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOTS,
        NO_DOTS_SLASH,
        STAR,
        START_ANCHOR
      } = constants.globChars(opts.windows);
      const nodot = opts.dot ? NO_DOTS : NO_DOT;
      const slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT;
      const capture = opts.capture ? "" : "?:";
      const state = { negated: false, prefix: "" };
      let star = opts.bash === true ? ".*?" : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      const globstar = (opts2) => {
        if (opts2.noglobstar === true) return star;
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const create = (str) => {
        switch (str) {
          case "*":
            return `${nodot}${ONE_CHAR}${star}`;
          case ".*":
            return `${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*.*":
            return `${nodot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*/*":
            return `${nodot}${star}${SLASH_LITERAL}${ONE_CHAR}${slashDot}${star}`;
          case "**":
            return nodot + globstar(opts);
          case "**/*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${ONE_CHAR}${star}`;
          case "**/*.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "**/.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${DOT_LITERAL}${ONE_CHAR}${star}`;
          default: {
            const match = /^(.*?)\.(\w+)$/.exec(str);
            if (!match) return;
            const source2 = create(match[1]);
            if (!source2) return;
            return source2 + DOT_LITERAL + match[2];
          }
        }
      };
      const output = utils.removePrefix(input, state);
      let source = create(output);
      if (source && opts.strictSlashes !== true) {
        source += `${SLASH_LITERAL}?`;
      }
      return source;
    };
    module.exports = parse;
  }
});

// node_modules/picomatch/lib/picomatch.js
var require_picomatch = __commonJS({
  "node_modules/picomatch/lib/picomatch.js"(exports, module) {
    "use strict";
    var scan = require_scan();
    var parse = require_parse();
    var utils = require_utils();
    var constants = require_constants();
    var isObject = (val) => val && typeof val === "object" && !Array.isArray(val);
    var picomatch2 = (glob, options, returnState = false) => {
      if (Array.isArray(glob)) {
        const fns = glob.map((input) => picomatch2(input, options, returnState));
        const arrayMatcher = (str) => {
          for (const isMatch of fns) {
            const state2 = isMatch(str);
            if (state2) return state2;
          }
          return false;
        };
        return arrayMatcher;
      }
      const isState = isObject(glob) && glob.tokens && glob.input;
      if (glob === "" || typeof glob !== "string" && !isState) {
        throw new TypeError("Expected pattern to be a non-empty string");
      }
      const opts = options || {};
      const posix = opts.windows;
      const regex = isState ? picomatch2.compileRe(glob, options) : picomatch2.makeRe(glob, options, false, true);
      const state = regex.state;
      delete regex.state;
      let isIgnored = () => false;
      if (opts.ignore) {
        const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null };
        isIgnored = picomatch2(opts.ignore, ignoreOpts, returnState);
      }
      const matcher = (input, returnObject = false) => {
        const { isMatch, match, output } = picomatch2.test(input, regex, options, { glob, posix });
        const result = { glob, state, regex, posix, input, output, match, isMatch };
        if (typeof opts.onResult === "function") {
          opts.onResult(result);
        }
        if (isMatch === false) {
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (isIgnored(input)) {
          if (typeof opts.onIgnore === "function") {
            opts.onIgnore(result);
          }
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (typeof opts.onMatch === "function") {
          opts.onMatch(result);
        }
        return returnObject ? result : true;
      };
      if (returnState) {
        matcher.state = state;
      }
      return matcher;
    };
    picomatch2.test = (input, regex, options, { glob, posix } = {}) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected input to be a string");
      }
      if (input === "") {
        return { isMatch: false, output: "" };
      }
      const opts = options || {};
      const format = opts.format || (posix ? utils.toPosixSlashes : null);
      let match = input === glob;
      let output = match && format ? format(input) : input;
      if (match === false) {
        output = format ? format(input) : input;
        match = output === glob;
      }
      if (match === false || opts.capture === true) {
        if (opts.matchBase === true || opts.basename === true) {
          match = picomatch2.matchBase(input, regex, options, posix);
        } else {
          match = regex.exec(output);
        }
      }
      return { isMatch: Boolean(match), match, output };
    };
    picomatch2.matchBase = (input, glob, options) => {
      const regex = glob instanceof RegExp ? glob : picomatch2.makeRe(glob, options);
      return regex.test(utils.basename(input));
    };
    picomatch2.isMatch = (str, patterns, options) => picomatch2(patterns, options)(str);
    picomatch2.parse = (pattern, options) => {
      if (Array.isArray(pattern)) return pattern.map((p) => picomatch2.parse(p, options));
      return parse(pattern, { ...options, fastpaths: false });
    };
    picomatch2.scan = (input, options) => scan(input, options);
    picomatch2.compileRe = (state, options, returnOutput = false, returnState = false) => {
      if (returnOutput === true) {
        return state.output;
      }
      const opts = options || {};
      const prepend = opts.contains ? "" : "^";
      const append = opts.contains ? "" : "$";
      let source = `${prepend}(?:${state.output})${append}`;
      if (state && state.negated === true) {
        source = `^(?!${source}).*$`;
      }
      const regex = picomatch2.toRegex(source, options);
      if (returnState === true) {
        regex.state = state;
      }
      return regex;
    };
    picomatch2.makeRe = (input, options = {}, returnOutput = false, returnState = false) => {
      if (!input || typeof input !== "string") {
        throw new TypeError("Expected a non-empty string");
      }
      let parsed = { negated: false, fastpaths: true };
      if (options.fastpaths !== false && (input[0] === "." || input[0] === "*")) {
        parsed.output = parse.fastpaths(input, options);
      }
      if (!parsed.output) {
        parsed = parse(input, options);
      }
      return picomatch2.compileRe(parsed, options, returnOutput, returnState);
    };
    picomatch2.toRegex = (source, options) => {
      try {
        const opts = options || {};
        return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""));
      } catch (err) {
        if (options && options.debug === true) throw err;
        return /$^/;
      }
    };
    picomatch2.constants = constants;
    module.exports = picomatch2;
  }
});

// node_modules/picomatch/index.js
var require_picomatch2 = __commonJS({
  "node_modules/picomatch/index.js"(exports, module) {
    "use strict";
    var pico = require_picomatch();
    var utils = require_utils();
    function picomatch2(glob, options, returnState = false) {
      if (options && (options.windows === null || options.windows === void 0)) {
        options = { ...options, windows: utils.isWindows() };
      }
      return pico(glob, options, returnState);
    }
    Object.assign(picomatch2, pico);
    module.exports = picomatch2;
  }
});

// adapters/dsh/commands.ts
import { join as join6 } from "node:path";

// engine/config.ts
import { readFileSync } from "node:fs";

// engine/paths.ts
import { existsSync } from "node:fs";
import { join } from "node:path";
var TDD_DIR = ".tdd";
var LEGACY_TDD_DIR = ".pi/tdd";
var RULES_FILE = "rules.json";
var STATE_FILE = "state.json";
var GITIGNORE_FILE = ".gitignore";
var LOCKED_DIRS = [TDD_DIR, LEGACY_TDD_DIR];
function resolveTddLayout(projectRoot, deps = { existsSync }) {
  const primaryPresent = deps.existsSync(join(projectRoot, TDD_DIR));
  const legacyPresent = deps.existsSync(join(projectRoot, LEGACY_TDD_DIR));
  if (primaryPresent) {
    return { dir: TDD_DIR, legacyDirPresent: legacyPresent };
  }
  if (legacyPresent) {
    return { dir: LEGACY_TDD_DIR, legacyDirPresent: false };
  }
  return { dir: TDD_DIR, legacyDirPresent: false };
}
function resolveTddDir(projectRoot, deps = { existsSync }) {
  return resolveTddLayout(projectRoot, deps).dir;
}
function tddPath(projectRoot, ...parts) {
  return join(projectRoot, resolveTddDir(projectRoot), ...parts);
}
function lockedDirFor(relPath) {
  const normalized = relPath.split("\\").join("/").replace(/^\.\//, "").replace(/\/+$/, "");
  for (const dir of LOCKED_DIRS) {
    if (normalized === dir || normalized.startsWith(`${dir}/`)) return dir;
  }
  return void 0;
}
function isTddPath(relPath) {
  return lockedDirFor(relPath) !== void 0;
}
function legacyDirWarning(layout) {
  if (!layout.legacyDirPresent) return void 0;
  return `Both ${TDD_DIR}/ and ${LEGACY_TDD_DIR}/ exist. Using ${TDD_DIR}/ and ignoring ${LEGACY_TDD_DIR}/. Both stay write-locked while TDD is enabled.`;
}

// engine/config.ts
function configPath(projectRoot) {
  return tddPath(projectRoot, RULES_FILE);
}
function loadConfig(projectRoot) {
  const path = configPath(projectRoot);
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.blockedInRed) || parsed.blockedInRed.length === 0) {
    throw new Error("rules.json: blockedInRed must be a non-empty array");
  }
  if (!parsed.blockedInRed.every((p) => typeof p === "string")) {
    throw new Error("rules.json: blockedInRed must contain only strings");
  }
  if (!Array.isArray(parsed.blockedInGreen) || parsed.blockedInGreen.length === 0) {
    throw new Error("rules.json: blockedInGreen must be a non-empty array");
  }
  if (!parsed.blockedInGreen.every((p) => typeof p === "string")) {
    throw new Error("rules.json: blockedInGreen must contain only strings");
  }
  if (!Array.isArray(parsed.testCommands) || parsed.testCommands.length === 0) {
    throw new Error("rules.json: testCommands must be a non-empty array");
  }
  if (!parsed.testCommands.every((p) => typeof p === "string")) {
    throw new Error("rules.json: testCommands must contain only strings");
  }
  return {
    blockedInRed: parsed.blockedInRed,
    blockedInGreen: parsed.blockedInGreen,
    testCommands: parsed.testCommands,
    timeoutSeconds: parsed.timeoutSeconds ?? 120
  };
}

// engine/enforce.ts
var import_picomatch = __toESM(require_picomatch2(), 1);
function matchPatterns(patterns, filePath) {
  const positive = [];
  const negative = [];
  for (const p of patterns) {
    if (p.startsWith("!")) {
      negative.push(p.slice(1));
    } else {
      positive.push(p);
    }
  }
  if (positive.length === 0) return false;
  const matchesPositive = positive.some((p) => (0, import_picomatch.default)(p)(filePath));
  if (!matchesPositive) return false;
  const matchesNegative = negative.some((p) => (0, import_picomatch.default)(p)(filePath));
  return !matchesNegative;
}
function isAllowed(filePath, phase, config) {
  const blocked = phase === "red" ? config.blockedInRed : config.blockedInGreen;
  return !matchPatterns(blocked, filePath);
}
function disallowedFiles(files, phase, config) {
  return files.filter((f) => !isAllowed(f, phase, config));
}

// engine/git.ts
import { execSync } from "node:child_process";
import {
  existsSync as existsSync2,
  mkdirSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { join as join2 } from "node:path";
var defaultDeps = {
  execSync,
  existsSync: existsSync2,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  rmSync
};
function tddRoot(projectRoot, deps) {
  return join2(projectRoot, resolveTddDir(projectRoot, deps));
}
function bookkeepingFiles(dir) {
  return [
    `${dir}/${STATE_FILE}`,
    `${dir}/${RULES_FILE}`,
    `${dir}/${GITIGNORE_FILE}`
  ];
}
function gitEnv(projectRoot, deps) {
  const gitDir = join2(tddRoot(projectRoot, deps), ".git");
  return {
    GIT_DIR: gitDir,
    GIT_WORK_TREE: projectRoot
  };
}
function gitExec(args, projectRoot, deps, options) {
  const env = { ...process.env, ...gitEnv(projectRoot, deps) };
  return deps.execSync(`git ${args}`, {
    // Node sends a child's stderr to the parent's stderr unless `stdio`
    // says otherwise, so an unpiped failure prints raw git noise into
    // the host's console. Several callers treat a failure as an expected
    // outcome — a destroyed private store, a corrupt history — and
    // report it properly through tddLog, so the child must stay quiet.
    // A caller that wants something else still overrides this.
    stdio: "pipe",
    ...options,
    env,
    // Every git call runs from the project root so path output and
    // pathspecs stay root-relative regardless of process cwd.
    cwd: projectRoot,
    encoding: "utf-8"
  }).toString();
}
function initGit(projectRoot, deps = defaultDeps) {
  const dir = resolveTddDir(projectRoot, deps);
  const tddPath2 = tddRoot(projectRoot, deps);
  const gitDir = join2(tddPath2, ".git");
  if (deps.existsSync(gitDir)) return;
  deps.mkdirSync(tddPath2, { recursive: true });
  gitExec(`init "${tddPath2}"`, projectRoot, deps, { stdio: "pipe" });
  gitExec(`config core.worktree "${projectRoot}"`, projectRoot, deps, {
    stdio: "pipe"
  });
  gitExec(
    `config core.excludesFile "${join2(tddPath2, ".gitignore")}"`,
    projectRoot,
    deps,
    { stdio: "pipe" }
  );
  const gitignorePath = join2(tddPath2, ".gitignore");
  if (!deps.existsSync(gitignorePath)) {
    deps.writeFileSync(
      gitignorePath,
      [
        "node_modules/",
        ".pnpm-store/",
        ".next/",
        "dist/",
        "build/",
        ".cache/",
        "*.log",
        ".DS_Store",
        "Thumbs.db",
        ""
      ].join("\n"),
      "utf-8"
    );
  }
  gitExec("add -A", projectRoot, deps, { stdio: "pipe" });
  stageFiles(projectRoot, bookkeepingFiles(dir), deps);
  gitExec('commit --allow-empty -m "tdd: init"', projectRoot, deps, {
    stdio: "pipe"
  });
}
function resetGit(projectRoot, deps = defaultDeps) {
  const tddPath2 = tddRoot(projectRoot, deps);
  const gitDir = join2(tddPath2, ".git");
  if (deps.existsSync(gitDir)) {
    deps.rmSync(gitDir, { recursive: true, force: true });
  }
  initGit(projectRoot, deps);
}
function snapshot(projectRoot, phase, deps = defaultDeps) {
  gitExec("add -A", projectRoot, deps, { stdio: "pipe" });
  stageFiles(
    projectRoot,
    bookkeepingFiles(resolveTddDir(projectRoot, deps)),
    deps
  );
  gitExec(`commit --allow-empty -m "tdd: ${phase}"`, projectRoot, deps, {
    stdio: "pipe"
  });
  return gitExec("rev-parse HEAD", projectRoot, deps).trim();
}
function modifiedFiles(projectRoot, deps = defaultDeps) {
  const out = gitExec("diff --name-only HEAD", projectRoot, deps).trim();
  return out ? out.split("\n") : [];
}
function untrackedFiles(projectRoot, deps = defaultDeps) {
  const out = gitExec(
    "ls-files --others --exclude-standard",
    projectRoot,
    deps
  ).trim();
  return out ? out.split("\n") : [];
}
function changesSinceSnapshot(projectRoot, deps = defaultDeps) {
  return [
    .../* @__PURE__ */ new Set([
      ...modifiedFiles(projectRoot, deps),
      ...untrackedFiles(projectRoot, deps)
    ])
  ];
}
function restoreFilesTo(projectRoot, files, source, deps = defaultDeps) {
  if (files.length === 0) return;
  const captured = source === void 0 ? void 0 : new Set(
    gitExec(`ls-tree -r --name-only ${source}`, projectRoot, deps).trim().split("\n").filter(Boolean)
  );
  const restorable = files.filter((f) => captured?.has(f) ?? false);
  const removable = files.filter((f) => !restorable.includes(f));
  if (restorable.length > 0) {
    const escaped = restorable.map((f) => `"${f}"`).join(" ");
    gitExec(`checkout ${source} -- ${escaped}`, projectRoot, deps, {
      stdio: "pipe"
    });
  }
  if (source !== void 0) {
    for (const f of removable) {
      try {
        deps.unlinkSync(join2(projectRoot, f));
      } catch {
      }
    }
    return;
  }
  const tracked = new Set(
    gitExec("ls-files", projectRoot, deps).trim().split("\n").filter(Boolean)
  );
  const trackedFiles = removable.filter((f) => tracked.has(f));
  if (trackedFiles.length > 0) {
    const escaped = trackedFiles.map((f) => `"${f}"`).join(" ");
    gitExec(`restore --worktree -- ${escaped}`, projectRoot, deps, {
      stdio: "pipe"
    });
  }
  for (const f of removable.filter((f2) => !tracked.has(f2))) {
    try {
      deps.unlinkSync(join2(projectRoot, f));
    } catch {
    }
  }
}
function stageFiles(projectRoot, files, deps = defaultDeps) {
  const existing = files.filter((f) => deps.existsSync(join2(projectRoot, f)));
  if (existing.length === 0) return;
  const escaped = existing.map((f) => `"${f}"`).join(" ");
  gitExec(`add -f ${escaped}`, projectRoot, deps, { stdio: "pipe" });
}
function gitStashCreate(projectRoot, deps = defaultDeps) {
  gitExec("add -A", projectRoot, deps, { stdio: "pipe" });
  const tree = gitExec("write-tree", projectRoot, deps).trim();
  const parent = headHash(projectRoot, deps);
  return gitExec(
    `commit-tree ${tree} -p ${parent} -m "tdd: baseline"`,
    projectRoot,
    deps
  ).trim();
}
function headHash(projectRoot, deps = defaultDeps) {
  return gitExec("rev-parse HEAD", projectRoot, deps).trim();
}
function headMessage(projectRoot, deps = defaultDeps) {
  return gitExec("log -1 --format=%s HEAD", projectRoot, deps, {
    stdio: "pipe"
  }).trim();
}
function hasParent(projectRoot, deps = defaultDeps) {
  try {
    gitExec("rev-parse HEAD~1", projectRoot, deps, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
function changesSince(projectRoot, commitHash, deps = defaultDeps) {
  const out = gitExec(
    `diff --name-only ${commitHash} -- .`,
    projectRoot,
    deps
  ).trim();
  const files = out ? out.split("\n") : [];
  const untracked = untrackedFiles(projectRoot, deps);
  return [.../* @__PURE__ */ new Set([...files, ...untracked])];
}
function resetHard(projectRoot, deps = defaultDeps) {
  gitExec("reset --hard", projectRoot, deps, { stdio: "pipe" });
  gitExec("clean -fd", projectRoot, deps, { stdio: "pipe" });
}
function undoLastCommit(projectRoot, deps = defaultDeps) {
  gitExec("reset --soft HEAD~1", projectRoot, deps, { stdio: "pipe" });
}

// engine/log.ts
import {
  appendFileSync,
  existsSync as existsSync3,
  mkdirSync as mkdirSync2,
  readFileSync as readFileSync2,
  writeFileSync as writeFileSync2
} from "node:fs";
import { join as join3 } from "node:path";
var MAX_LINES = 1e3;
function tddLog(tddDir, level, msg, data, deps = {
  existsSync: existsSync3,
  mkdirSync: mkdirSync2,
  appendFileSync,
  writeFileSync: writeFileSync2,
  readFileSync: readFileSync2
}) {
  try {
    const logPath = join3(tddDir, "tdd.log");
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const dataStr = data !== void 0 ? ` ${JSON.stringify(data)}` : "";
    const line = `[${timestamp}] [${level}] ${msg}${dataStr}
`;
    deps.appendFileSync(logPath, line, "utf-8");
    const content = deps.readFileSync(logPath, "utf-8");
    const lines = content.trimEnd().split("\n");
    if (lines.length > MAX_LINES) {
      const trimmed = `${lines.slice(-MAX_LINES).join("\n")}
`;
      deps.writeFileSync(logPath, trimmed, "utf-8");
    }
  } catch {
  }
}

// engine/state.ts
import { existsSync as existsSync4, mkdirSync as mkdirSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "node:fs";
import { dirname, join as join4 } from "node:path";

// engine/types.ts
var PHASE_CYCLE = {
  red: "green",
  green: "red"
};
function isPhase(value) {
  return typeof value === "string" && Object.hasOwn(PHASE_CYCLE, value);
}
function parseTddLabel(message) {
  const label = message.match(/^tdd:\s*(\S+)/)?.[1];
  return label !== void 0 && isPhase(label) ? label : null;
}

// engine/transition.ts
function nextPhase(current) {
  return PHASE_CYCLE[current] ?? null;
}
async function checkGate(from, to, testRunner, config) {
  const result = await testRunner(config.testCommands, config.timeoutSeconds);
  if (result.cancelled) {
    return {
      passed: false,
      cancelled: true,
      message: result.message
    };
  }
  if (result.timeout) {
    return {
      passed: false,
      timeout: true,
      message: `Tests timed out after ${config.timeoutSeconds}s. The test command may have hung or an operation may be blocking.`
    };
  }
  switch (`${from}\u2192${to}`) {
    case "red\u2192green":
      if (result.passed) {
        return {
          passed: false,
          message: "Tests passed. Add a failing test before transitioning to GREEN."
        };
      }
      return { passed: true, message: "Tests fail \u2014 proceed to GREEN." };
    case "green\u2192red":
      if (!result.passed) {
        return {
          passed: false,
          message: "Tests failed. Fix them before starting a new RED cycle."
        };
      }
      return { passed: true, message: "All tests pass \u2014 proceeding." };
  }
}
function getDisallowedChanges(projectRoot, phase, config, deps = {
  changesSinceSnapshot,
  disallowedFiles
}) {
  const changed = deps.changesSinceSnapshot(projectRoot);
  return deps.disallowedFiles(changed, phase, config);
}

// engine/state.ts
function phaseStatePath(projectRoot) {
  return tddPath(projectRoot, STATE_FILE);
}
function ensureDir(path) {
  const dir = dirname(path);
  if (!existsSync4(dir)) {
    mkdirSync3(dir, { recursive: true });
  }
}
function loadPhaseState(projectRoot) {
  let raw;
  try {
    raw = JSON.parse(readFileSync3(phaseStatePath(projectRoot), "utf-8"));
  } catch {
    return { current: null, enabled: false };
  }
  if (typeof raw !== "object" || raw === null) {
    return { current: null, enabled: false };
  }
  const parsed = raw;
  return {
    current: isPhase(parsed.current) ? parsed.current : null,
    enabled: parsed.enabled === true
  };
}
function savePhaseState(projectRoot, state) {
  const path = phaseStatePath(projectRoot);
  ensureDir(path);
  writeFileSync3(path, JSON.stringify(state, null, 2), "utf-8");
}
function probeGit(root, deps) {
  let message;
  try {
    message = deps.headMessage(root);
  } catch (e) {
    return { kind: "unusable", reason: e.message };
  }
  if (!deps.hasParent(root)) return { kind: "baseline" };
  const phase = parseTddLabel(message);
  if (!phase) {
    return {
      kind: "unusable",
      reason: `HEAD commit "${message}" is not a TDD snapshot.`
    };
  }
  return { kind: "phase", phase };
}
function repairHistory(root, enabled, deps) {
  deps.resetGit(root);
  deps.snapshot(root, "red");
  const state = { enabled, current: "red" };
  deps.savePhaseState(root, state);
  deps.stageFiles(root, [`${resolveTddDir(root)}/${STATE_FILE}`]);
  return state;
}
function loadTddState(root, deps = {
  existsSync: existsSync4,
  loadConfig,
  initGit,
  loadPhaseState,
  savePhaseState,
  headMessage,
  hasParent,
  resetGit,
  snapshot,
  stageFiles
}) {
  const layout = resolveTddLayout(root, deps);
  const warning = legacyDirWarning(layout);
  const tddDir = join4(root, layout.dir);
  if (!deps.existsSync(tddDir)) {
    return {
      ok: false,
      reason: `Missing ${layout.dir}/ directory. See the tdd-enforcer skill to learn how to set up TDD configs.`
    };
  }
  const rulesPath = join4(tddDir, RULES_FILE);
  if (!deps.existsSync(rulesPath)) {
    return {
      ok: false,
      reason: `Missing ${layout.dir}/${RULES_FILE}. See the tdd-enforcer skill to learn how to set up TDD configs.`
    };
  }
  let config;
  try {
    config = deps.loadConfig(root);
  } catch (e) {
    return {
      ok: false,
      reason: `Invalid ${layout.dir}/${RULES_FILE}: ${e.message}. See the tdd-enforcer skill.`
    };
  }
  const gitDir = join4(tddDir, ".git");
  if (!deps.existsSync(gitDir)) {
    try {
      deps.initGit(root);
    } catch (e) {
      return {
        ok: false,
        reason: `Failed to initialise private git repo: ${e.message}`
      };
    }
  }
  const fileState = deps.loadPhaseState(root);
  const probe = probeGit(root, {
    headMessage: deps.headMessage,
    hasParent: deps.hasParent
  });
  if (probe.kind === "unusable") {
    const state2 = repairHistory(root, fileState.enabled, deps);
    return { ok: true, state: state2, config, repaired: probe.reason, warning };
  }
  if (fileState.current) {
    return {
      ok: true,
      state: { enabled: fileState.enabled, current: fileState.current },
      config,
      warning
    };
  }
  const state = probe.kind === "baseline" ? { enabled: false, current: "red" } : { enabled: true, current: nextPhase(probe.phase) ?? "red" };
  deps.savePhaseState(root, state);
  deps.stageFiles(root, [`${layout.dir}/${STATE_FILE}`]);
  return { ok: true, state, config, warning };
}

// engine/orchestrate.ts
async function advancePhase(root, state, config, deps) {
  const np = deps.nextPhase ?? nextPhase;
  const gdc = deps.getDisallowedChanges ?? getDisallowedChanges;
  const cg = deps.checkGate ?? checkGate;
  const snap = deps.snapshot ?? snapshot;
  const sps = deps.savePhaseState ?? savePhaseState;
  const from = state.current;
  const to = np(from);
  const violations = gdc(root, from, config);
  if (violations.length > 0) {
    return {
      ok: false,
      message: `BLOCKED: files not allowed in ${from.toUpperCase()} phase:
` + violations.map((f) => `  - ${f}`).join("\n") + `
Revert or remove them before proceeding.

Inspect with: cd ${resolveTddDir(root)} && git diff HEAD -- ${violations[0]}`
    };
  }
  const gate = await cg(from, to, deps.testRunner, config);
  if (!gate.passed) {
    return { ok: false, message: gate.message };
  }
  const newState = { ...state, current: to };
  sps(root, newState);
  snap(root, from);
  return { ok: true, message: "", newState };
}
async function revertPhase(root, state, deps) {
  const hp = deps?.hasParent ?? hasParent;
  const hm = deps?.headMessage ?? headMessage;
  const rh = deps?.resetHard ?? resetHard;
  const ulc = deps?.undoLastCommit ?? undoLastCommit;
  const sps = deps?.savePhaseState ?? savePhaseState;
  const rg = deps?.resetGit ?? resetGit;
  const snap = deps?.snapshot ?? snapshot;
  const stf = deps?.stageFiles ?? stageFiles;
  const repair = () => ({
    ok: true,
    message: "Private git history was corrupt \u2014 reset to a clean RED baseline.",
    newState: repairHistory(root, state.enabled, {
      resetGit: rg,
      snapshot: snap,
      savePhaseState: sps,
      stageFiles: stf
    })
  });
  let headMsg;
  try {
    headMsg = hm(root);
  } catch {
    return repair();
  }
  if (!hp(root)) {
    return { ok: false, message: "No previous phase to revert to." };
  }
  const label = parseTddLabel(headMsg);
  if (!label) return repair();
  ulc(root);
  rh(root);
  const newState = { ...state, current: label };
  sps(root, newState);
  return {
    ok: true,
    message: `Reverted to ${label.toUpperCase()}.`,
    newState
  };
}
function getStatusInfo(state, config) {
  const enabledStr = state.enabled ? "enabled" : "disabled";
  const phaseStr = state.current.toUpperCase();
  const redBlk = config.blockedInRed.join(", ") || "(none)";
  const greenBlk = config.blockedInGreen.join(", ") || "(none)";
  const commands = config.testCommands.join(", ") || "(none)";
  return `TDD enforcer ${enabledStr}
Current phase: ${phaseStr}
Blocked in RED: ${redBlk}
Blocked in GREEN: ${greenBlk}
Test commands: ${commands}`;
}

// engine/prompts.ts
function getNudgePrompt(phase, config) {
  const redBlock = config.blockedInRed.join(", ");
  const greenBlock = config.blockedInGreen.join(", ");
  switch (phase) {
    case "red":
      return `You are now in **RED** phase. Write failing tests.
Blocked files: ${redBlock}
All other files are free to modify. Call \`next_tdd_phase\` to proceed to GREEN.
Think about what could go wrong and test for it \u2014 don't just verify the happy path, cover unhappy paths and edge cases too.
Minimise the scope of each TDD cycle so reverting is cheap.`;
    case "green":
      return `You are now in **GREEN** phase. Implement features.
Blocked files: ${greenBlock}
All other files are free to modify. Call \`next_tdd_phase\` to start a new RED cycle.
Write minimal code to make the failing tests pass \u2014 nothing more.
If the RED phase tests were wrong, call \`previous_tdd_phase\` to go back and fix them.`;
    default:
      return "";
  }
}

// engine/tdd-files.ts
import {
  existsSync as existsSync5,
  mkdirSync as mkdirSync4,
  readFileSync as readFileSync4,
  statSync,
  unlinkSync as unlinkSync2,
  writeFileSync as writeFileSync4
} from "node:fs";
import { join as join5 } from "node:path";
var MAX_CAPTURED_BYTES = 8 * 1024 * 1024;
var BOOKKEEPING = [STATE_FILE, RULES_FILE, GITIGNORE_FILE];
var defaultTddFilesDeps = {
  existsSync: existsSync5,
  readFileSync: (path) => readFileSync4(path),
  writeFileSync: (path, data) => writeFileSync4(path, data),
  mkdirSync: (path) => void mkdirSync4(path, { recursive: true }),
  unlinkSync: (path) => unlinkSync2(path),
  statSync: (path) => {
    const stats = statSync(path);
    return { size: stats.size, isDirectory: () => stats.isDirectory() };
  }
};
function emptyTddSnapshot() {
  return { files: /* @__PURE__ */ new Map(), dirs: /* @__PURE__ */ new Set() };
}
function captureTddFiles(projectRoot, deps = defaultTddFilesDeps) {
  const snapshot2 = emptyTddSnapshot();
  for (const locked of LOCKED_DIRS) {
    const abs = join5(projectRoot, locked);
    if (!isDirectory(abs, deps)) continue;
    snapshot2.dirs.add(locked);
    for (const name2 of BOOKKEEPING) {
      const fileAbs = join5(abs, name2);
      if (!deps.existsSync(fileAbs)) continue;
      snapshot2.files.set(`${locked}/${name2}`, readCapped(fileAbs, deps));
    }
  }
  return snapshot2;
}
function restoreTddFiles(projectRoot, snapshot2, deps = defaultTddFilesDeps) {
  const restored = [];
  for (const locked of snapshot2.dirs) {
    const abs = join5(projectRoot, locked);
    if (!isDirectory(abs, deps)) {
      if (deps.existsSync(abs)) deps.unlinkSync(abs);
      deps.mkdirSync(abs);
    }
    for (const name2 of BOOKKEEPING) {
      const rel = `${locked}/${name2}`;
      const fileAbs = join5(projectRoot, rel);
      const captured = snapshot2.files.get(rel);
      if (captured === void 0) {
        if (deps.existsSync(fileAbs)) {
          deps.unlinkSync(fileAbs);
          restored.push(rel);
        }
        continue;
      }
      if (captured === null) continue;
      if (deps.existsSync(fileAbs) && deps.readFileSync(fileAbs).equals(captured)) {
        continue;
      }
      deps.writeFileSync(fileAbs, captured);
      restored.push(rel);
    }
  }
  return restored;
}
function readCapped(abs, deps) {
  try {
    if (deps.statSync(abs).size > MAX_CAPTURED_BYTES) return null;
    return deps.readFileSync(abs);
  } catch {
    return null;
  }
}
function isDirectory(abs, deps) {
  try {
    return deps.statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

// adapters/dsh/root.ts
function sessionIdOf(agent) {
  const id = agent?.id ?? agent?.sessionId;
  return typeof id === "string" && id !== "" ? id : void 0;
}
function directCwd(agent) {
  const cwd = agent?.session?.header?.cwd;
  return typeof cwd === "string" && cwd !== "" ? cwd : void 0;
}
function projectRootOf(ctx, subject) {
  const agent = subject.agent;
  const direct = directCwd(agent);
  if (direct !== void 0) return direct;
  const sessionId = sessionIdOf(agent);
  if (sessionId !== void 0 && ctx.sessions !== void 0) {
    const cwd = ctx.sessions.get(sessionId)?.header?.cwd;
    if (typeof cwd === "string" && cwd !== "") return cwd;
  }
  return process.cwd();
}

// adapters/dsh/commands.ts
var ok = (text) => ({ kind: "success", text });
var fail = (text) => ({ kind: "error", text });
function rootOf(ctx, invocation) {
  return projectRootOf(ctx, invocation);
}
async function enableTdd(ctx, invocation) {
  const root = rootOf(ctx, invocation);
  const tddDir = join6(root, resolveTddDir(root));
  tddLog(tddDir, "INFO", "tdd-on: starting");
  const setup = loadTddState(root);
  if (!setup.ok) {
    tddLog(tddDir, "WARN", "tdd-on: setup invalid", { reason: setup.reason });
    return fail(setup.reason);
  }
  const { state } = setup;
  if (state.enabled) {
    tddLog(tddDir, "INFO", "tdd-on: already enabled", { phase: state.current });
    return ok(`TDD already enabled \u2014 ${state.current.toUpperCase()} phase`);
  }
  snapshot(root, state.current);
  tddLog(tddDir, "INFO", "tdd-on: snapshot taken", { phase: state.current });
  state.enabled = true;
  savePhaseState(root, state);
  tddLog(tddDir, "INFO", "tdd-on: enabled", { phase: state.current });
  return ok(`TDD enabled \u2014 ${state.current.toUpperCase()} phase`);
}
async function disableTdd(ctx, invocation) {
  const root = rootOf(ctx, invocation);
  const tddDir = join6(root, resolveTddDir(root));
  const setup = loadTddState(root);
  if (!setup.ok) {
    tddLog(tddDir, "WARN", "tdd-off: setup invalid", { reason: setup.reason });
    return fail(setup.reason);
  }
  const { state } = setup;
  if (!state.enabled) {
    tddLog(tddDir, "INFO", "tdd-off: already disabled");
    return ok("TDD already disabled");
  }
  state.enabled = false;
  savePhaseState(root, state);
  tddLog(tddDir, "INFO", "tdd-off: disabled", { was: state.current });
  return ok("TDD disabled");
}
async function showStatus(ctx, invocation) {
  const root = rootOf(ctx, invocation);
  const tddDir = join6(root, resolveTddDir(root));
  const result = loadTddState(root);
  if (!result.ok) {
    tddLog(tddDir, "WARN", "tdd-status: setup invalid", {
      reason: result.reason
    });
    return fail(`TDD: ${result.reason}`);
  }
  const { state, config } = result;
  tddLog(tddDir, "INFO", "tdd-status: queried", {
    enabled: state.enabled,
    phase: state.current
  });
  return ok(
    `TDD enforcer ${state.enabled ? "enabled" : "disabled"}
Current phase: ${state.current.toUpperCase()}
Blocked in RED: ${config.blockedInRed.join(", ") || "(none)"}
Blocked in GREEN: ${config.blockedInGreen.join(", ") || "(none)"}
Test commands: ${config.testCommands.join(", ") || "(none)"}` + (result.warning !== void 0 ? `

\u26A0\uFE0F ${result.warning}` : "")
  );
}
async function resetTdd(ctx, invocation) {
  const root = rootOf(ctx, invocation);
  const tddDir = join6(root, resolveTddDir(root));
  tddLog(tddDir, "INFO", "tdd-reset: starting");
  const setup = loadTddState(root);
  if (!setup.ok) {
    tddLog(tddDir, "WARN", "tdd-reset: setup invalid", {
      reason: setup.reason
    });
    return fail(setup.reason);
  }
  try {
    resetGit(root);
    tddLog(tddDir, "INFO", "tdd-reset: git reset and re-initialised");
  } catch (error) {
    tddLog(tddDir, "ERROR", "tdd-reset: git reset failed", {
      error: error.message
    });
    return fail("Failed to reset private git repo.");
  }
  snapshot(root, "red");
  savePhaseState(root, { enabled: false, current: "red" });
  tddLog(tddDir, "INFO", "tdd-reset: complete");
  return ok(
    "TDD snapshot history reset. Working tree left untouched. Run /tdd-on to re-enable enforcement."
  );
}
async function jumpTo(phase, ctx, invocation) {
  const root = rootOf(ctx, invocation);
  const tddDir = join6(root, resolveTddDir(root));
  const setup = loadTddState(root);
  if (!setup.ok) {
    tddLog(tddDir, "WARN", `tdd-${phase}: setup invalid`, {
      reason: setup.reason
    });
    return fail(setup.reason);
  }
  const { state } = setup;
  if (state.current === phase) {
    tddLog(tddDir, "INFO", `tdd-${phase}: already in ${phase}`, { phase });
    return ok(`TDD: already in ${phase.toUpperCase()} phase.`);
  }
  snapshot(root, state.current);
  tddLog(tddDir, "INFO", `tdd-${phase}: snapshot taken`, {
    from: state.current
  });
  state.enabled = true;
  state.current = phase;
  savePhaseState(root, state);
  tddLog(tddDir, "INFO", `tdd-${phase}: jumped`);
  return ok(`Skipped to ${phase.toUpperCase()} phase.`);
}
var COMMANDS = [
  {
    name: "tdd-on",
    description: "Enable TDD enforcement for this project",
    run: enableTdd
  },
  {
    name: "tdd-off",
    description: "Disable TDD enforcement (keeps state and snapshot history)",
    run: disableTdd
  },
  {
    name: "tdd-status",
    description: "Show TDD enforcement status",
    run: showStatus
  },
  {
    name: "tdd-reset",
    description: "WARNING: Destroys ALL TDD snapshot history and resets to RED phase. Working tree is preserved. Run /tdd-on to re-enable after reset.",
    run: resetTdd
  },
  {
    name: "tdd-red",
    description: "Skip to RED phase. Snapshot working tree, auto-enable TDD, set phase. No gate checks.",
    run: (ctx, invocation) => jumpTo("red", ctx, invocation)
  },
  {
    name: "tdd-green",
    description: "Skip to GREEN phase. Snapshot working tree, auto-enable TDD, set phase. No gate checks.",
    run: (ctx, invocation) => jumpTo("green", ctx, invocation)
  }
];
function registerTddCommands(ctx) {
  const commands = ctx.commands;
  if (commands === void 0) return;
  for (const command of COMMANDS) {
    commands.register({
      name: command.name,
      description: command.description,
      handler: (invocation) => command.run(ctx, invocation)
    });
  }
}

// adapters/dsh/enforcement.ts
import { join as join7, relative, resolve } from "node:path";
var PRECISE_PATH_TOOLS = /* @__PURE__ */ new Set(["write", "edit"]);
var OWN_TOOLS = /* @__PURE__ */ new Set([
  "next_tdd_phase",
  "previous_tdd_phase",
  "tdd_status"
]);
var NON_MUTATING_TOOLS = /* @__PURE__ */ new Set([
  "read",
  "glob",
  "grep",
  "read_image",
  "web_search",
  "web_fetch",
  "skill",
  "todo_write",
  "present",
  "ask_user_question",
  "send_message",
  "interrupt_agent",
  "list_agents",
  "subagent",
  "subagent_fork",
  "workflow",
  "job_list",
  "job_output",
  "job_kill",
  "plugin_manager",
  "cordis_inspect_list",
  "cordis_inspect_query",
  "create_goal",
  "get_goal",
  "update_goal",
  "exit_plan_mode"
]);
var MAX_BRACKETS = 200;
var BOOKKEEPING_DENIAL = "TDD: Config files are locked. No bypassing TDD allowed. If bypassing is justified, ask the user: turn TDD off (/tdd-off), reset (/tdd-reset), or change phase with the /tdd-red and /tdd-green commands.\n\nIf TDD reverts too much of your progress, reduce the scope of each TDD cycle to minimise lost progress.";
function needsBracket(toolName) {
  if (PRECISE_PATH_TOOLS.has(toolName)) return false;
  if (OWN_TOOLS.has(toolName)) return false;
  if (NON_MUTATING_TOOLS.has(toolName)) return false;
  return true;
}
function backgroundJobId(result) {
  const value = result?.value;
  if (value === null || typeof value !== "object") return void 0;
  const record = value;
  if (record.kind !== "background") return void 0;
  return typeof record.jobId === "string" ? record.jobId : void 0;
}
function resultText(result) {
  return (result?.content ?? []).map((block) => typeof block.text === "string" ? block.text : "").join("");
}
var TddEnforcer = class {
  constructor(ctx, maxBrackets = MAX_BRACKETS) {
    this.ctx = ctx;
    this.maxBrackets = maxBrackets;
  }
  ctx;
  maxBrackets;
  brackets = /* @__PURE__ */ new Map();
  jobBrackets = /* @__PURE__ */ new Map();
  notices = /* @__PURE__ */ new Map();
  // ── project + state ──────────────────────────────────────────────────────
  /** Project root of the session that issued this call. */
  rootFor(exec2) {
    return projectRootOf(this.ctx, exec2);
  }
  tddDir(root) {
    return join7(root, resolveTddDir(root));
  }
  // ── mechanism 1: synchronous guard for write/edit ────────────────────────
  guardExecution(exec2) {
    if (!PRECISE_PATH_TOOLS.has(exec2.name)) return void 0;
    const filePath = readString(exec2.arguments, "file_path");
    if (filePath === void 0) return void 0;
    const root = this.rootFor(exec2);
    const tdd = loadTddState(root);
    if (!tdd.ok || !tdd.state.enabled) return void 0;
    const tddDir = this.tddDir(root);
    const rel = relative(root, resolve(root, filePath));
    if (isTddPath(rel)) {
      tddLog(tddDir, "INFO", "guard: blocked TDD bookkeeping file", {
        toolName: exec2.name,
        relPath: rel
      });
      return BOOKKEEPING_DENIAL;
    }
    if (!isAllowed(rel, tdd.state.current, tdd.config)) {
      tddLog(tddDir, "INFO", "guard: blocked file modification", {
        toolName: exec2.name,
        relPath: rel,
        phase: tdd.state.current
      });
      return `TDD ${tdd.state.current.toUpperCase()}: "${rel}" is locked in this phase.`;
    }
    return void 0;
  }
  // ── mechanism 2: snapshot-and-revert bracket ─────────────────────────────
  /** Take the pre-call snapshot. Called before the tool body runs. */
  beginBracket(exec2) {
    if (!needsBracket(exec2.name)) return;
    const root = this.rootFor(exec2);
    const tddDir = this.tddDir(root);
    const tdd = loadTddState(root);
    if (!tdd.ok || !tdd.state.enabled) {
      tddLog(tddDir, "DEBUG", "bracket: TDD not active, passes through", {
        toolName: exec2.name,
        reason: tdd.ok ? "disabled" : tdd.reason
      });
      return;
    }
    try {
      const stashHash = gitStashCreate(root);
      tddLog(tddDir, "DEBUG", "bracket: opened", {
        toolName: exec2.name,
        callId: exec2.callId,
        stashHash
      });
      this.brackets.set(exec2.callId, {
        stashHash,
        tddFiles: captureTddFiles(root),
        phase: tdd.state.current,
        config: tdd.config,
        root,
        toolName: exec2.name,
        sessionId: sessionIdOf(exec2.agent),
        at: Date.now()
      });
      this.pruneBrackets();
    } catch (error) {
      tddLog(tddDir, "ERROR", "bracket: snapshot failed", {
        toolName: exec2.name,
        callId: exec2.callId,
        error: error.message,
        detail: errorDetail(error)
      });
    }
  }
  /**
   * Close the bracket after the call. Returns the corrective text when files
   * were reverted; `undefined` means the call may stand as-is.
   */
  finishBracket(exec2, result) {
    const bracket = this.brackets.get(exec2.callId);
    if (bracket === void 0) return void 0;
    this.brackets.delete(exec2.callId);
    const jobId = backgroundJobId(result);
    if (jobId !== void 0) {
      this.jobBrackets.set(jobId, bracket);
      return void 0;
    }
    return this.revert(bracket)?.warning;
  }
  /** A tracked background job settled: diff and revert what it broke. */
  handleJobSettled(jobId) {
    const bracket = this.jobBrackets.get(jobId);
    if (bracket === void 0) return;
    this.jobBrackets.delete(jobId);
    const outcome = this.revert(bracket);
    const tddDir = this.tddDir(bracket.root);
    if (outcome === void 0) {
      tddLog(tddDir, "DEBUG", "bracket: background job made no violations", {
        jobId
      });
      return;
    }
    tddLog(tddDir, "WARN", "bracket: reverted background job changes", {
      jobId,
      violations: outcome.violations
    });
    this.pushNotice(
      bracket.sessionId,
      `

\u26A0\uFE0F TDD: background command (job ${jobId}) had already returned; locked files it modified were reverted when it settled.${outcome.warning}`
    );
  }
  /**
   * Diff the working tree against the bracket snapshot and restore only the
   * files that are both changed and locked in the bracket's phase.
   */
  revert(bracket) {
    const { root, stashHash, phase, config } = bracket;
    const tddDir = this.tddDir(root);
    let tddViolations = [];
    try {
      tddViolations = restoreTddFiles(root, bracket.tddFiles);
    } catch (error) {
      tddLog(tddDir, "ERROR", "bracket: TDD directory restore failed", {
        toolName: bracket.toolName,
        error: error.message
      });
    }
    let changed;
    try {
      changed = changesSince(root, stashHash);
    } catch (error) {
      tddLog(tddDir, "ERROR", "bracket: diff failed", {
        toolName: bracket.toolName,
        error: error.message
      });
      changed = [];
    }
    const tddFromGit = changed.filter((f) => isTddPath(f));
    const phaseViolations = changed.filter(
      (f) => !isTddPath(f) && !isAllowed(f, phase, config)
    );
    const violations = [
      .../* @__PURE__ */ new Set([...tddViolations, ...tddFromGit, ...phaseViolations])
    ];
    if (violations.length === 0) {
      tddLog(tddDir, "DEBUG", "bracket: no violations among changed files", {
        toolName: bracket.toolName,
        changed
      });
      return void 0;
    }
    try {
      if (tddFromGit.length > 0) {
        restoreFilesTo(root, tddFromGit, stashHash);
      }
      if (phaseViolations.length > 0) {
        restoreFilesTo(root, phaseViolations, stashHash);
      }
    } catch (error) {
      tddLog(tddDir, "ERROR", "bracket: restore failed", {
        toolName: bracket.toolName,
        violations,
        error: error.message
      });
      return void 0;
    }
    const allowed = changed.filter(
      (f) => isAllowed(f, phase, config) && !isTddPath(f)
    );
    tddLog(tddDir, "WARN", "bracket: reverted locked files", {
      toolName: bracket.toolName,
      phase,
      violations
    });
    return {
      warning: formatWarning(bracket, violations, allowed),
      violations,
      allowed
    };
  }
  // ── deferred notices for out-of-band reverts ─────────────────────────────
  pushNotice(sessionId, text) {
    const key = sessionId ?? "";
    const queue = this.notices.get(key);
    if (queue === void 0) this.notices.set(key, [text]);
    else queue.push(text);
  }
  /** Notices waiting for this session, as content blocks. */
  drainNotices(exec2) {
    const key = sessionIdOf(exec2.agent) ?? "";
    const queue = this.notices.get(key);
    if (queue === void 0 || queue.length === 0) return [];
    this.notices.delete(key);
    return queue.map((text) => ({ type: "text", text }));
  }
  /** Build the model-facing feedback for a reverted call. */
  feedback(result, warning) {
    return [{ type: "text", text: resultText(result) + warning }];
  }
  /** Visible for tests. */
  get openBrackets() {
    return this.brackets.size + this.jobBrackets.size;
  }
  pruneBrackets() {
    dropOldest(this.brackets, this.maxBrackets);
    dropOldest(this.jobBrackets, this.maxBrackets);
  }
};
function dropOldest(map, limit) {
  if (map.size <= limit) return;
  const oldest = [...map.entries()].sort((a, b) => a[1].at - b[1].at);
  for (const [key] of oldest.slice(0, map.size - limit)) map.delete(key);
}
function formatWarning(bracket, violations, allowed) {
  const who = bracket.toolName === "bash" ? "bash" : `"${bracket.toolName}"`;
  let warning = `

\u26D4 ${bracket.phase.toUpperCase()}: reverted locked files modified by ${who}:`;
  for (const file of violations) warning += `
  - ${file}`;
  if (violations.some((file) => isTddPath(file))) {
    warning += "\n\nIf TDD reverts too much of your progress, reduce the scope of each TDD cycle to minimise lost progress.";
  }
  if (allowed.length > 0) {
    warning += "\n\nAllowed changes retained:";
    for (const file of allowed) warning += `
  - ${file}`;
  }
  return warning;
}
function errorDetail(error) {
  const record = error;
  const text = (value) => {
    if (value === void 0 || value === null) return "";
    return Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
  };
  const parts = [
    record?.status === void 0 ? "" : `status=${String(record.status)}`,
    text(record?.stderr).trim(),
    text(record?.stdout).trim()
  ].filter((part) => part !== "");
  return parts.length === 0 ? void 0 : parts.join(" ").slice(0, 300);
}
function readString(input, key) {
  if (input === null || typeof input !== "object") return void 0;
  const value = input[key];
  return typeof value === "string" && value !== "" ? value : void 0;
}

// adapters/dsh/skill.ts
import { existsSync as existsSync6, readFileSync as readFileSync5 } from "node:fs";
import { fileURLToPath } from "node:url";
var CANDIDATES = [
  "../../skills/tdd-enforcer/SKILL.md",
  "../../../skills/tdd-enforcer/SKILL.md",
  "./SKILL.md"
];
function parseSkill(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (match === null) return void 0;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    fields[key] = value;
  }
  if (!fields.name || !fields.description) return void 0;
  return {
    name: fields.name,
    description: fields.description,
    content: text
  };
}
function loadSkillFile(metaUrl) {
  for (const candidate of CANDIDATES) {
    const path = fileURLToPath(new URL(candidate, metaUrl));
    if (!existsSync6(path)) continue;
    const parsed = parseSkill(readFileSync5(path, "utf8"));
    if (parsed !== void 0) return parsed;
  }
  return void 0;
}
function registerTddSkill(ctx, metaUrl) {
  const skills = ctx.skills;
  if (skills === void 0) return;
  const skill = loadSkillFile(metaUrl);
  if (skill === void 0) return;
  skills.register({
    name: skill.name,
    description: skill.description,
    content: skill.content,
    source: "runtime"
  });
}

// adapters/shared/actions.ts
import { exec } from "node:child_process";
import { join as join8 } from "node:path";
import { promisify } from "node:util";
var asyncExec = promisify(exec);
var PI_HINTS = {
  enableHint: "Run /tdd:on to enable it."
};
var DSH_HINTS = {
  enableHint: "Run /tdd-on to enable it."
};
var defaultNextPhaseDeps = {
  loadTddState,
  nextPhase,
  getDisallowedChanges,
  checkGate,
  snapshot,
  savePhaseState,
  getNudgePrompt,
  asyncExec,
  tddLog
};
var defaultPreviousPhaseDeps = {
  loadTddState,
  hasParent,
  headMessage,
  resetHard,
  undoLastCommit,
  savePhaseState,
  resetGit,
  snapshot,
  stageFiles,
  tddLog
};
var defaultTddStatusDeps = {
  loadTddState,
  tddLog
};
async function runNextPhase(root, signal, deps = defaultNextPhaseDeps, hints = PI_HINTS) {
  const tddDir = join8(root, resolveTddDir(root));
  const tdd = deps.loadTddState(root);
  if (!tdd.ok) {
    deps.tddLog(tddDir, "WARN", "next_tdd_phase: TDD not active", {
      reason: tdd.reason
    });
    throw new Error(`TDD: ${tdd.reason}`);
  }
  if (!tdd.state.enabled) {
    deps.tddLog(tddDir, "WARN", "next_tdd_phase: TDD disabled");
    throw new Error(`TDD is not enabled. ${hints.enableHint}`);
  }
  const { state, config } = tdd;
  const repairNote = tdd.repaired ? `NOTE: private git history was corrupt and has been reset (${tdd.repaired})
` : "";
  if (tdd.repaired) {
    deps.tddLog(tddDir, "WARN", "next_tdd_phase: git history repaired", {
      reason: tdd.repaired
    });
  }
  const from = state.current;
  const to = deps.nextPhase(from);
  deps.tddLog(tddDir, "INFO", "next_tdd_phase: starting", { from, to });
  const testRunner = async (commands, timeout) => {
    const results = await Promise.all(
      commands.map(async (cmd) => {
        try {
          await deps.asyncExec(cmd, {
            cwd: root,
            timeout: timeout * 1e3,
            signal
          });
          return { command: cmd, passed: true, timedOut: false };
        } catch (err) {
          const killed = err?.killed === true;
          const cancelled2 = signal?.aborted === true;
          const timedOut2 = killed && !cancelled2;
          return {
            command: cmd,
            passed: false,
            timedOut: timedOut2,
            cancelled: cancelled2
          };
        }
      })
    );
    const cancelled = results.filter((r) => r.cancelled === true);
    const timedOut = results.filter((r) => r.timedOut);
    const failed = results.filter(
      (r) => !r.passed && !r.timedOut && !r.cancelled
    );
    if (cancelled.length > 0) {
      return {
        passed: false,
        cancelled: true,
        message: `
Test execution was cancelled.
${cancelled.map((f) => `  - ${f.command}`).join("\n")}`
      };
    }
    if (timedOut.length > 0) {
      return {
        passed: false,
        timeout: true,
        message: `Tests timed out after ${timeout}s:
${timedOut.map((f) => `  - ${f.command}`).join("\n")}`
      };
    }
    if (failed.length > 0) {
      return {
        passed: false,
        message: `Tests failed:
${failed.map((f) => `  - ${f.command}`).join("\n")}`
      };
    }
    return { passed: true, message: "All tests passed." };
  };
  const result = await advancePhase(root, state, config, {
    nextPhase: deps.nextPhase,
    getDisallowedChanges: deps.getDisallowedChanges,
    checkGate: deps.checkGate,
    snapshot: deps.snapshot,
    savePhaseState: deps.savePhaseState,
    testRunner
  });
  if (!result.ok) {
    deps.tddLog(tddDir, "WARN", "next_tdd_phase: blocked by allowlist", {
      from,
      violations: result.message
    });
    throw new Error(result.message);
  }
  deps.tddLog(tddDir, "INFO", "next_tdd_phase: complete", {
    from,
    to
  });
  return {
    content: [
      {
        type: "text",
        text: `${repairNote}
${deps.getNudgePrompt(to, config)}`
      }
    ],
    details: {}
  };
}
async function runPreviousPhase(root, deps = defaultPreviousPhaseDeps, hints = PI_HINTS) {
  const tddDir = join8(root, resolveTddDir(root));
  const tdd = deps.loadTddState(root);
  if (!tdd.ok) {
    deps.tddLog(tddDir, "WARN", "previous_tdd_phase: TDD not active", {
      reason: tdd.reason
    });
    throw new Error(`TDD: ${tdd.reason}`);
  }
  if (!tdd.state.enabled) {
    deps.tddLog(tddDir, "WARN", "previous_tdd_phase: TDD disabled");
    throw new Error(`TDD is not enabled. ${hints.enableHint}`);
  }
  const { state } = tdd;
  const repairNote = tdd.repaired ? ` NOTE: private git history was corrupt and has been reset (${tdd.repaired}).` : "";
  if (tdd.repaired) {
    deps.tddLog(tddDir, "WARN", "previous_tdd_phase: git history repaired", {
      reason: tdd.repaired
    });
  }
  const result = await revertPhase(root, state, {
    hasParent: deps.hasParent,
    headMessage: deps.headMessage,
    resetHard: deps.resetHard,
    undoLastCommit: deps.undoLastCommit,
    savePhaseState: deps.savePhaseState,
    resetGit: deps.resetGit,
    snapshot: deps.snapshot,
    stageFiles: deps.stageFiles
  });
  if (!result.ok) {
    throw new Error(result.message);
  }
  deps.tddLog(tddDir, "INFO", "previous_tdd_phase: complete", {
    from: state.current,
    to: result.newState?.current
  });
  return {
    content: [
      {
        type: "text",
        text: `
${result.message} Working tree has the previous snapshot content as unstaged changes.${repairNote}`
      }
    ],
    details: {}
  };
}
async function runTddStatus(root, deps = defaultTddStatusDeps) {
  const tddDir = join8(root, resolveTddDir(root));
  const result = deps.loadTddState(root);
  if (!result.ok) {
    deps.tddLog(tddDir, "WARN", "tdd_status: TDD not active", {
      reason: result.reason
    });
    throw new Error(`TDD: ${result.reason}`);
  }
  const { state, config } = result;
  const info = getStatusInfo(state, config);
  const warningNote = result.warning !== void 0 ? `

\u26A0\uFE0F ${result.warning}` : "";
  deps.tddLog(tddDir, "INFO", "tdd_status: queried", {
    enabled: state.enabled,
    phase: state.current
  });
  return {
    content: [{ type: "text", text: `
${info}${warningNote}` }],
    details: {
      enabled: state.enabled,
      phase: state.current,
      blockedInRed: config.blockedInRed,
      blockedInGreen: config.blockedInGreen,
      testCommands: config.testCommands
    }
  };
}

// adapters/dsh/tools.ts
var NO_ARGUMENTS = {
  type: "object",
  properties: {},
  additionalProperties: false
};
var TEXT_OUTPUT = {
  schema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"]
  },
  render(_args, value) {
    const text = value !== null && typeof value === "object" ? String(value.text ?? "") : "";
    return [{ type: "text", text }];
  }
};
async function asText(action) {
  const output = await action;
  return { text: output.content.map((block) => block.text).join("") };
}
function registerTddTools(ctx) {
  const definitions = [
    {
      name: "next_tdd_phase",
      description: "Advance to the next TDD phase. Runs transition gates (test pass/fail checks) and allowlist validation (no forbidden files modified).",
      parameters: NO_ARGUMENTS,
      output: TEXT_OUTPUT,
      execute(_args, exec2) {
        const root = projectRootOf(ctx, exec2);
        return asText(
          runNextPhase(root, exec2.signal, defaultNextPhaseDeps, DSH_HINTS)
        );
      }
    },
    {
      name: "previous_tdd_phase",
      description: "WARNING: Discards ALL changes made in the current phase and reverts the working tree to what it was when the last phase ended. Use when the previous phase's work was wrong and this phase cannot proceed.",
      parameters: NO_ARGUMENTS,
      output: TEXT_OUTPUT,
      execute(_args, exec2) {
        const root = projectRootOf(ctx, exec2);
        return asText(
          runPreviousPhase(root, defaultPreviousPhaseDeps, DSH_HINTS)
        );
      }
    },
    {
      name: "tdd_status",
      description: "Show the current TDD enforcement status: enabled/disabled, current phase, blocked file globs per phase, and test commands.",
      parameters: NO_ARGUMENTS,
      output: TEXT_OUTPUT,
      execute(_args, exec2) {
        const root = projectRootOf(ctx, exec2);
        return asText(runTddStatus(root, defaultTddStatusDeps));
      }
    }
  ];
  for (const definition of definitions) ctx.tools.register(definition);
}

// adapters/dsh/index.ts
var name = "tdd-enforcer";
var inject = ["tools", "sessions"];
function apply(ctx) {
  const enforcer = new TddEnforcer(ctx);
  ctx.tools.guard(
    (exec2) => enforcer.guardExecution(exec2)
  );
  ctx.on(
    "tools/pre-execute",
    async (exec2, next) => {
      enforcer.beginBracket(exec2);
      return next();
    }
  );
  ctx.on(
    "tools/post-execute",
    async (exec2, result, next) => {
      const warning = enforcer.finishBracket(exec2, result);
      if (warning !== void 0) {
        return {
          kind: "block",
          feedback: enforcer.feedback(result, warning)
        };
      }
      const decision = await next();
      const notices = enforcer.drainNotices(exec2);
      if (notices.length > 0 && decision.kind === "accept") {
        return {
          kind: "accept",
          content: [...result.content ?? [], ...notices]
        };
      }
      return decision;
    }
  );
  ctx.inject(["jobs"], (jobCtx) => {
    jobCtx.jobs?.events.subscribe(
      { owners: "all" },
      (event) => {
        if (event.type !== "settled") return;
        const jobId = event.job?.id;
        if (typeof jobId === "string") enforcer.handleJobSettled(jobId);
      }
    );
  });
  registerTddTools(ctx);
  ctx.inject(["commands"], (commandCtx) => {
    registerTddCommands(commandCtx);
  });
  ctx.inject(["skills"], (skillCtx) => {
    registerTddSkill(skillCtx, import.meta.url);
  });
  announceActivation(ctx);
}
function announceActivation(ctx) {
  try {
    const logger = ctx.logger;
    if (logger === void 0) return;
    const named = typeof logger === "function" ? logger("tdd-enforcer") : logger;
    named?.info?.(
      "active: 3 tools, 6 commands, guard on write/edit, snapshot brackets on other tools"
    );
  } catch {
  }
}
export {
  TddEnforcer,
  apply,
  inject,
  name
};
