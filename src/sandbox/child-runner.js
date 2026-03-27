// Agent 006: Child Runner
// Runs inside a permission-restricted child process.
// Global nullification + IIFE isolation + deep-freeze state injection.

'use strict';

// --- Global Nullification ---
// Remove dangerous globals to prevent strategy code from accessing them.
const NULLIFY = [
  'fetch', 'XMLHttpRequest', 'WebSocket',
  'setTimeout', 'setInterval', 'setImmediate', 'clearTimeout', 'clearInterval', 'clearImmediate',
  'queueMicrotask',
];

for (const name of NULLIFY) {
  try { globalThis[name] = undefined; } catch (_) { /* ignore */ }
}

// Lock down process
if (typeof process !== 'undefined') {
  const _send = process.send ? process.send.bind(process) : null;
  const _on = process.on.bind(process);
  const _exit = process.exit.bind(process);

  // Keep only what we need
  const safeProcess = { send: _send, on: _on, exit: _exit };

  // --- Deep Freeze ---
  function deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    Object.freeze(obj);
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'object' && val !== null && !Object.isFrozen(val)) {
        deepFreeze(val);
      }
    }
    return obj;
  }

  // --- Execute Strategies in Isolated IIFEs ---
  function executeRound(strategies, state) {
    const extractions = [];

    for (let i = 0; i < strategies.length; i++) {
      try {
        // Build per-agent state with agent-specific fields
        const agentState = deepFreeze({
          round: state.round,
          totalRounds: state.totalRounds,
          poolLevel: state.poolLevel,
          startingPoolSize: state.startingPoolSize,
          regenerationRate: state.regenerationRate,
          maxExtraction: state.maxExtraction,
          agentCount: state.agentCount,
          agentIndex: i,
          myWealth: state.agentWealth[i],
          myHistory: state.agentHistory[i],
          allHistory: state.agentHistory,
          poolHistory: state.poolHistory,
          sustainableShare: state.sustainableShare,
        });

        // Extract function name from code
        const fnNameMatch = strategies[i].match(/function\s+(\w+)/);
        const fnName = fnNameMatch ? fnNameMatch[1] : '_strategy';

        // Execute in fresh IIFE — no shared scope between strategies.
        // Shadow globalThis/global/window/self to prevent cross-round leakage.
        // eslint-disable-next-line no-new-func
        const fn = new Function('state', `
          'use strict';
          const globalThis = undefined;
          const global = undefined;
          const window = undefined;
          const self = undefined;
          ${strategies[i]}
          return ${fnName}(state);
        `);

        const result = fn(agentState);
        extractions.push(result);
      } catch (err) {
        // Strategy threw — extract 0, log error
        extractions.push({ error: err?.message || String(err), agentIndex: i });
      }
    }

    return extractions;
  }

  // --- IPC Message Handler ---
  safeProcess.on('message', (msg) => {
    if (msg?.type === 'execute_round') {
      const result = executeRound(msg.strategies, msg.state);
      safeProcess.send({ type: 'round_result', extractions: result });
    } else if (msg?.type === 'ping') {
      safeProcess.send({ type: 'pong' });
    }
  });

  // Signal ready
  safeProcess.send({ type: 'ready' });
}
