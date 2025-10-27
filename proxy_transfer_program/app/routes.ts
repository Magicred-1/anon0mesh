import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  layout("./solana/SolanaProvider.tsx", [
    index("routes/home.tsx"),
    route("docs", "routes/docs.tsx"),
  ]),
] satisfies RouteConfig;