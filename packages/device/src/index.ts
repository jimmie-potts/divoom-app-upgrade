// Physical connection remains false when exercising the in-memory adapter.
export const simulatorDevice = { connected: false } as const;
export * from './contracts.js';
export * from './fake.js';
