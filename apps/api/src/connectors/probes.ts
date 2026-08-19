import type { Probe } from "./types.js";
import { missingEnv, probeFetch, unconfigured } from "./probe-utils.js";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

export const attio: Probe = async () => {
  const key = process.env.ATTIO_API_KEY;
  if (!key) return unconfigured({ ATTIO_API_KEY: key });
  return probeFetch("https://api.attio.com/v2/self", { headers: { Authorization: `Bearer ${key}` } },
    (_res, body) => ({ status: "live", latency_ms: null, detail: `workspace: ${body?.data?.workspace_name ?? "ok"}` }));
};

export const stripe: Probe = async () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return unconfigured({ STRIPE_SECRET_KEY: key });
  return probeFetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${key}` } },
    (_res, body) => ({ status: "live", latency_ms: null, detail: `livemode: ${body?.livemode ?? "?"}` }));
};

export const paypal: Probe = async () => {
  const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) return unconfigured({ PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret });
  return probeFetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${b64(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  }, (_res, body) => ({ status: "live", latency_ms: null, detail: `token scope: ${(body?.scope ?? "").split(" ").length} scopes` }));
};

export const square: Probe = async () => {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return unconfigured({ SQUARE_ACCESS_TOKEN: token });
  return probeFetch("https://connect.squareup.com/v2/locations", {
    headers: { Authorization: `Bearer ${token}`, "Square-Version": "2024-06-04" },
  }, (_res, body) => ({ status: "live", latency_ms: null, detail: `locations: ${body?.locations?.length ?? 0}` }));
};

export const whop: Probe = async () => {
  const key = process.env.WHOP_API_KEY;
  if (!key) return unconfigured({ WHOP_API_KEY: key });
  return probeFetch("https://api.whop.com/api/v2/me", { headers: { Authorization: `Bearer ${key}` } },
    (_res, body) => ({ status: "live", latency_ms: null, detail: `account: ${body?.username ?? body?.id ?? "ok"}` }));
};

// PAVA has no documented public health/self endpoint at build time — this
// connector can only confirm the key is present, never that it's valid.
export const pava: Probe = async () => {
  const key = process.env.PAVA_API_KEY;
  if (!key) return unconfigured({ PAVA_API_KEY: key });
  return { status: "degraded", latency_ms: null, detail: "key present — no public probe endpoint, validity unconfirmed" };
};

export const slack: Probe = async () => {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return unconfigured({ SLACK_BOT_TOKEN: token });
  return probeFetch("https://slack.com/api/auth.test", {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
  }, (_res, body) => body?.ok
    ? { status: "live", latency_ms: null, detail: `team: ${body.team ?? "ok"}` }
    : { status: "offline", latency_ms: null, detail: body?.error ?? "auth.test failed" });
};

// OAuth refresh-token flow: exchange for a short-lived access token, then hit
// the Gmail profile endpoint. Two hops, so this one is the slowest probe.
// The access token never leaves this function — it must not land in a
// ProbeResult's `detail`, since that gets persisted to connectors.health.
export const gmail: Probe = async () => {
  const vars = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  };
  if (missingEnv(vars).length) return unconfigured(vars);

  let accessToken: string | undefined;
  const tokenRes = await probeFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: vars.GOOGLE_CLIENT_ID!, client_secret: vars.GOOGLE_CLIENT_SECRET!,
      refresh_token: vars.GOOGLE_REFRESH_TOKEN!, grant_type: "refresh_token",
    }).toString(),
  }, (_res, body) => { accessToken = body?.access_token; return { status: "live", latency_ms: null, detail: "token ok" }; });
  if (tokenRes.status !== "live" || !accessToken) return { ...tokenRes, detail: `token refresh failed: ${tokenRes.detail}` };

  return probeFetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  }, (_res, body) => ({ status: "live", latency_ms: null, detail: `mailbox: ${body?.emailAddress ?? "ok"}` }));
};

// Meta Graph API — a bare /me?access_token=... call is the cheapest way to
// confirm a WhatsApp Cloud API token is still valid without a phone number id.
export const whatsapp: Probe = async () => {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return unconfigured({ WHATSAPP_TOKEN: token });
  return probeFetch(`https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(token)}`, {},
    (_res, body) => ({ status: "live", latency_ms: null, detail: `id: ${body?.id ?? "ok"}` }));
};

export const manychat: Probe = async () => {
  const key = process.env.MANYCHAT_API_KEY;
  if (!key) return unconfigured({ MANYCHAT_API_KEY: key });
  return probeFetch("https://api.manychat.com/fb/page/getInfo", { headers: { Authorization: `Bearer ${key}` } },
    (_res, body) => body?.status === "success"
      ? { status: "live", latency_ms: null, detail: `page: ${body?.data?.name ?? "ok"}` }
      : { status: "offline", latency_ms: null, detail: body?.message ?? "getInfo failed" });
};

export const notion: Probe = async () => {
  const token = process.env.NOTION_TOKEN;
  if (!token) return unconfigured({ NOTION_TOKEN: token });
  return probeFetch("https://api.notion.com/v1/users/me", {
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" },
  }, (_res, body) => ({ status: "live", latency_ms: null, detail: `bot: ${body?.name ?? body?.id ?? "ok"}` }));
};

export const gohighlevel: Probe = async () => {
  const token = process.env.GOHIGHLEVEL_TOKEN;
  if (!token) return unconfigured({ GOHIGHLEVEL_TOKEN: token });
  return probeFetch("https://services.leadconnectorhq.com/oauth/installedLocations", {
    headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28" },
  }, (_res, body) => ({ status: "live", latency_ms: null, detail: `locations: ${body?.locations?.length ?? body?.count ?? "ok"}` }));
};

export const CONNECTOR_PROBES: Record<string, Probe> = {
  attio, stripe, paypal, square, whop, pava, slack, gmail, whatsapp, manychat, notion, gohighlevel,
};
