// The "Bug" meta-model. It isn't a real OpenRouter model — when selected, the
// chat route routes across the user's best free models:
//   • Fast     → the first free model that responds (quickest good answer)
//   • Thinking → several models answered in parallel, then synthesized into the
//                single best answer by a judge model.
// It is always available and cannot be removed from the model list.
export const BUG_MODEL_ID = 'bug/auto';
export const BUG_MODEL = { id: BUG_MODEL_ID, name: 'Bug', locked: true };

// True for any virtual Bug id (e.g. 'bug/auto', 'bug/thinking') that must never
// be sent to OpenRouter as a real model.
export const isBugId = (id) => typeof id === 'string' && id.startsWith('bug/');
