import { randomBytes } from "node:crypto";
import { NEAR_AI_BASE, type AttestationPanel } from "./types";

type ReportBody = {
  request_nonce?: string;
  intel_quote?: string;
  signing_address?: string;
  gateway_attestation?: {
    request_nonce?: string;
    intel_quote?: string;
    signing_address?: string;
  };
};

export async function fetchAttestation(options: {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  skip?: boolean;
}): Promise<AttestationPanel> {
  if (options.skip || !options.apiKey) {
    return {
      status: "skipped-mock",
      detail:
        "Simulation mode, or NEAR_AI_KEY is unset. No attestation request was sent. Scouts used scripted strategies.",
    };
  }

  const nonce = randomBytes(32).toString("hex");
  const base = options.baseUrl ?? NEAR_AI_BASE;
  const url = new URL(`${base}/attestation/report`);
  url.searchParams.set("signing_algo", "ecdsa");
  url.searchParams.set("nonce", nonce);
  if (options.model) {
    url.searchParams.set("model", options.model);
    url.searchParams.set("provider", "near");
    url.searchParams.set("include_tls_fingerprint", "false");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    Accept: "application/json",
  };
  if (options.model) headers["x-no-aliasing"] = "true";

  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      headers,
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      return {
        status: "unavailable",
        nonce,
        model: options.model,
        fetchedAt: new Date().toISOString(),
        detail: `Attestation returned HTTP ${response.status}. The mission continues. Full Intel DCAP verification is not bundled.`,
      };
    }
    const body = (await response.json()) as ReportBody;
    const gateway = body.gateway_attestation ?? body;
    const echoed = gateway.request_nonce;
    const quotePresent = typeof gateway.intel_quote === "string" && gateway.intel_quote.length > 0;
    const requestNonceMatch = echoed === nonce;
    const verified = requestNonceMatch && quotePresent;
    return {
      status: verified ? "verified" : "unverified",
      nonce,
      requestNonceMatch,
      quotePresent,
      signingAddress: gateway.signing_address,
      model: options.model,
      fetchedAt: new Date().toISOString(),
      detail: verified
        ? "The report echoed this client nonce and included an Intel quote. This is best-effort evidence. Full DCAP and TCB verification are not bundled."
        : "The attestation response did not bind this client nonce to an Intel quote. Treated as unverified. The mission still runs.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    return {
      status: "unavailable",
      nonce,
      model: options.model,
      fetchedAt: new Date().toISOString(),
      detail: `Attestation could not be fetched (${message}). The mission continues without it.`,
    };
  }
}
