import { z } from 'zod';
import { APIClient } from '../api-client.js';
import { BadResponseError, ValidationError } from '../errors.js';
import { type RetryOptions } from '../http.js';
import { normalizeOAuthBaseUrl } from '../oauth.js';
import { type SDKTelemetry } from '../telemetry.js';

const IssuanceResponseSchema = z.object({
  token: z.string(),
  expires_in: z.number(),
});

/**
 * Parameters for issuing an agent installation token.
 *
 * @remarks
 * Purpose:
 * - Provide the inputs required to request an installation-scoped access token.
 *
 * When to use:
 * - Use in server-side agent management flows that hold a service credential.
 *
 * When not to use:
 * - Do not call from browser contexts; the service credential must remain secret.
 *
 * Return semantics:
 * - DTO type only; no runtime behavior.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - All identifiers are non-empty strings.
 *
 * @property baseUrl - OAuth protocol host (origin).
 * @property serviceId - Agent service identifier.
 * @property installationId - Agent installation identifier.
 * @property serviceCredential - Bearer service credential (srv_* secret).
 *
 * Security notes:
 * - `serviceCredential` is sensitive and must not be logged or exposed to clients.
 *
 * Data/auth references:
 * - Uses oauth-server agent service token issuance endpoint.
 */
export interface IssueInstallationTokenParams {
  baseUrl: string; // OAuth protocol host, e.g. https://auth.xkova.com
  serviceId: string;
  installationId: string;
  serviceCredential: string; // Bearer service credential (srv_...)
  /** Optional fetch override for Node/edge runtimes. */
  fetch?: typeof fetch;
  /** Total timeout budget for token issuance (ms). */
  timeoutMs?: number;
  /** Per-attempt timeout (ms). */
  attemptTimeoutMs?: number;
  /** Retry policy override (default: retries disabled). */
  retry?: RetryOptions;
  /** Optional telemetry hooks for the token issuance request. */
  telemetry?: SDKTelemetry;
}

/**
 * Issue a short-lived installation token for an agent installation.
 *
 * @remarks
 * Purpose:
 * - Exchange a service credential for a scoped installation token.
 *
 * When to use:
 * - Use in backend services that need to act on behalf of an agent installation.
 *
 * When not to use:
 * - Do not call from the browser or untrusted environments.
 *
 * Parameters:
 * - `params.baseUrl`: OAuth protocol host (origin). Nullable: no.
 * - `params.serviceId`: Agent service identifier. Nullable: no.
 * - `params.installationId`: Agent installation identifier. Nullable: no.
 * - `params.serviceCredential`: Bearer service credential. Nullable: no.
 * - `params.fetch`: Optional fetch override. Nullable: yes.
 * - `params.timeoutMs`: Optional total timeout budget (ms). Nullable: yes.
 * - `params.attemptTimeoutMs`: Optional per-attempt timeout (ms). Nullable: yes.
 * - `params.retry`: Optional retry policy override. Nullable: yes.
 * - `params.telemetry`: Optional SDK telemetry hooks. Nullable: yes.
 *
 * Return semantics:
 * - Returns `{ token, expiresIn }` from the oauth-server response.
 *
 * Errors/failure modes:
 * - Throws SDKError subclasses when the server returns a non-2xx response.
 * - Throws BadResponseError when the response payload is malformed.
 *
 * Side effects:
 * - Performs a network request to oauth-server.
 *
 * Invariants/assumptions:
 * - Token issuance is non-idempotent; retries are disabled.
 *
 * Security notes:
 * - Access token and service credential are sensitive; avoid logging.
 *
 * Data/auth references:
 * - /agent-services/:serviceId/installations/:installationId/tokens endpoint.
 */
export async function issueInstallationToken(
  params: IssueInstallationTokenParams,
): Promise<{ token: string; expiresIn: number }> {
 const { baseUrl, serviceId, installationId, serviceCredential } = params;
  const oauthBaseUrl = normalizeOAuthBaseUrl(baseUrl);
  if (!serviceCredential.trim()) {
    throw new ValidationError('serviceCredential is required');
  }

  const client = new APIClient({
    baseUrl: oauthBaseUrl,
    fetch: params.fetch,
    timeoutMs: params.timeoutMs,
    attemptTimeoutMs: params.attemptTimeoutMs,
    retry: params.retry,
    telemetry: params.telemetry,
    getAccessToken: async () => serviceCredential,
  });

  // Token issuance is non-idempotent; do not retry by default.
  const payload = await client.post<
    Record<string, never>,
    { token: string; expires_in: number }
  >(
    `/agent-services/${serviceId}/installations/${installationId}/tokens`,
    {},
    { requestPolicy: { retry: { retries: 0 } } },
  );

  let data: z.infer<typeof IssuanceResponseSchema>;
  try {
    data = IssuanceResponseSchema.parse(payload);
  } catch (err) {
    throw new BadResponseError(
      'Malformed installation token response',
      undefined,
      err,
    );
  }

  return { token: data.token, expiresIn: data.expires_in };
}
