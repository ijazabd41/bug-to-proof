export type ProposalFailureBoundary =
  | "authentication_failed"
  | "request_rejected"
  | "model_or_endpoint_not_found"
  | "rate_limited"
  | "timed_out"
  | "empty_response"
  | "request_failed";

export function classifyProposalFailure(error: unknown): {
  boundary: ProposalFailureBoundary;
  stopReason: string;
  diagnostic: string;
} {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (/\b401\b|unauthori[sz]ed|invalid api key|authentication/.test(message)) return {
    boundary: "authentication_failed",
    stopReason: "Patch generation provider rejected authentication; verify the configured API key and provider account.",
    diagnostic: "Provider authentication failed.",
  };
  if (/\b404\b|model.*not found|not_found/.test(message)) return {
    boundary: "model_or_endpoint_not_found",
    stopReason: "Patch generation model or endpoint was not found; verify the provider URL and model identifier.",
    diagnostic: "Provider model or endpoint was not found.",
  };
  if (/\b429\b|rate.?limit|too many requests/.test(message)) return {
    boundary: "rate_limited",
    stopReason: "Patch generation provider rate-limited the request; retry after the provider limit resets.",
    diagnostic: "Provider rate limit was reached.",
  };
  if (/\b400\b|bad request|invalid_request/.test(message)) return {
    boundary: "request_rejected",
    stopReason: "Patch generation provider rejected the request; verify model compatibility and provider settings.",
    diagnostic: "Provider rejected the generation request.",
  };
  if (/timeout|timed out|aborted/.test(message)) return {
    boundary: "timed_out",
    stopReason: "Patch generation provider request timed out before a proposal was returned.",
    diagnostic: "Provider request timed out.",
  };
  if (/empty response|no usable content/.test(message)) return {
    boundary: "empty_response",
    stopReason: "Patch generation provider returned no usable content; no new proposal was created.",
    diagnostic: "Provider response contained no usable patch content.",
  };
  return {
    boundary: "request_failed",
    stopReason: "Patch generation provider request failed before a proposal could be validated.",
    diagnostic: "Provider generation request failed.",
  };
}
