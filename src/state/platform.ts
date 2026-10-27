export type FinanceRuntime = 'native' | 'web-preview';
export function getFinanceRuntime(platform: string): FinanceRuntime { return platform === 'web' ? 'web-preview' : 'native'; }
