import { ASSETS } from './constants';

export type Asset = typeof ASSETS[number];
export type Tab   = 'send' | 'receive' | 'swap' | 'yield';
