export type SysMsg       = { id: number; kind: 'sys';             text: string };
export type TxMsg        = { id: number; kind: 'tx';              time: string; txid: string; to: string; amount: string; asset: string; shards: number; total: number };
export type ReqMoneyMsg  = { id: number; kind: 'request-money';   from: string; me: boolean; time: string; asset: string; amount: string; note?: string };
export type ReqAddrMsg   = { id: number; kind: 'request-address'; from: string; me: boolean; time: string; asset: string; note?: string };
export type ShareAddrMsg = { id: number; kind: 'share-address';   from: string; me: boolean; time: string; asset: string; address: string };
export type ChatMsg      = { id: number; kind?: undefined;         from: string; me: boolean; time: string; text: string; enc?: boolean };
export type MediaMsg     = { id: number; kind: 'media';            from: string; me: boolean; time: string; uri: string; mimeType: string; width?: number; height?: number };
export type AnyMsg       = SysMsg | TxMsg | ReqMoneyMsg | ReqAddrMsg | ShareAddrMsg | ChatMsg | MediaMsg;
