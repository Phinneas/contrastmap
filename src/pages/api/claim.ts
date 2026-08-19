import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { listingSlug, name, email, phone, studioName } = body;

    if (!listingSlug || !name || !email) {
      return new Response(JSON.stringify({ ok: false, error: 'listingSlug, name, and email are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ ok: false, error: 'Valid email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // MVP: Log the claim request. In production, store in KV/D1 and send verification email.
    console.log(`[claim] Listing: ${listingSlug}, Name: ${name}, Email: ${email}, Phone: ${phone || 'N/A'}`);

    // TODO: When Cloudflare KV/D1 is configured:
    // 1. Store claim request in KV with key = `claim:${listingSlug}`
    // 2. Send verification email with domain-matching check
    // 3. On verification, update listing.ownership.claimed = true

    return new Response(JSON.stringify({ ok: true, message: 'Claim request received. We will verify and contact you within 48 hours.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
