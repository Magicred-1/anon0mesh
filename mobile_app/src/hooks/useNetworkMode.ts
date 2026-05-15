// useNetworkMode lives in `context/NetworkModeContext` so the MeshRpcAdapter
// + NetInfo subscription stay singletons across the app. This module
// re-exports the hook + types so existing import paths keep working.
export { useNetworkMode, NetworkModeProvider } from "@/context/NetworkModeContext";
export type { NetworkState } from "@/context/NetworkModeContext";
