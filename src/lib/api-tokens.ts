import crypto from "crypto";
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

export type ApiTokenRow = {
  id: string;
  household_id: string;
  user_id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
};

export type VerifiedToken = {
  tokenId: string;
  householdId: string;
  userId: string;
  tokenName: string;
  scopes: string[];
};

/**
 * Membuat instance client Supabase untuk operasi server backend / MCP.
 * Menggunakan SUPABASE_SERVICE_ROLE_KEY jika tersedia, atau fallback ke ANON_KEY.
 */
export function getApiClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase URL atau Key belum terkonfigurasi di environment.");
  }

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Menghitung SHA-256 hash dari string token mentah.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Menghasilkan token acak aman berformat cp_live_<64_hex_chars>.
 */
export function generateToken(): {
  rawToken: string;
  tokenHash: string;
  tokenPrefix: string;
} {
  const randomPart = crypto.randomBytes(32).toString("hex");
  const rawToken = `cp_live_${randomPart}`;
  const tokenHash = hashToken(rawToken);
  const tokenPrefix = `${rawToken.slice(0, 16)}...`;

  return { rawToken, tokenHash, tokenPrefix };
}

/**
 * Mengekstrak token dari request HTTP:
 * 1. Header `Authorization: Bearer <token>`
 * 2. Header `x-api-key: <token>`
 * 3. Query string `?token=<token>`
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
      return parts[1].trim();
    }
  }

  const xApiKey = req.headers.get("x-api-key");
  if (xApiKey && xApiKey.trim()) {
    return xApiKey.trim();
  }

  try {
    const url = new URL(req.url);
    const queryToken = url.searchParams.get("token");
    if (queryToken && queryToken.trim()) {
      return queryToken.trim();
    }
  } catch {
    // Ignore invalid URL
  }

  return null;
}

/**
 * Memverifikasi validitas token dan mengembalikan konteks user serta household.
 * Mengutamakan RPC `verify_api_token`, atau fallback langsung ke query tabel.
 */
export async function verifyApiToken(rawToken: string): Promise<VerifiedToken | null> {
  if (!rawToken || !rawToken.startsWith("cp_live_")) {
    return null;
  }

  const tokenHash = hashToken(rawToken);
  const supabase = getApiClient();

  // 1. Coba verifikasi lewat fungsi RPC security definer
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("verify_api_token", {
      p_token_hash: tokenHash,
    });

    if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
      const match = rpcData[0];
      return {
        tokenId: match.token_id,
        householdId: match.household_id,
        userId: match.user_id,
        tokenName: match.token_name,
        scopes: match.scopes ?? ["all"],
      };
    }
  } catch {
    // Fallback jika RPC belum dieksekusi di database
  }

  // 2. Fallback query langsung jika Service Role aktif
  try {
    const { data, error } = await supabase
      .from("api_tokens")
      .select("id, household_id, user_id, name, scopes")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error || !data) return null;

    // Perbarui last_used_at secara asynchronous
    supabase
      .from("api_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id)
      .then();

    return {
      tokenId: data.id,
      householdId: data.household_id,
      userId: data.user_id,
      tokenName: data.name,
      scopes: data.scopes ?? ["all"],
    };
  } catch {
    return null;
  }
}
