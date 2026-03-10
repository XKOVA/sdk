import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { createJwksWebhookVerifier } from "../dist/index.js";

const startJwksServer = async (jwks) => {
  const server = http.createServer((req, res) => {
    if (req.url !== "/jwks") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(jwks));
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind JWKS server");
  }

  return {
    server,
    jwksUrl: `http://127.0.0.1:${address.port}/jwks`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};

test("createJwksWebhookVerifier validates bearer JWT signatures against JWKS", async (t) => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  const kid = "sdk-agent-test-key";
  const issuer = "https://auth.example.com";
  const audience = "sdk-agent-tests";

  let server;
  try {
    server = await startJwksServer({
      keys: [
        {
          ...publicJwk,
          kid,
          alg: "RS256",
          use: "sig",
        },
      ],
    });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "EPERM") {
      t.skip("Local socket binding is not permitted in this runtime");
      return;
    }
    throw error;
  }

  try {
    const token = await new SignJWT({ sub: "agent-installation-1" })
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("2m")
      .sign(privateKey);

    const verifier = createJwksWebhookVerifier({
      jwksUrl: server.jwksUrl,
      issuer,
      audience,
    });

    const ok = await verifier({
      req: {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    });
    assert.equal(ok, true);

    const missingAuth = await verifier({
      req: {
        headers: {},
      },
    });
    assert.equal(missingAuth, false);

    const wrongAudienceToken = await new SignJWT({ sub: "agent-installation-1" })
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer(issuer)
      .setAudience("wrong-audience")
      .setIssuedAt()
      .setExpirationTime("2m")
      .sign(privateKey);

    const wrongAudience = await verifier({
      req: {
        headers: {
          authorization: `Bearer ${wrongAudienceToken}`,
        },
      },
    });
    assert.equal(wrongAudience, false);
  } finally {
    await server.close();
  }
});

