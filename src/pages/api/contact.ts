import type { APIRoute } from 'astro';

// Handled on-demand by the Worker (not prerendered), so POST requests reach it.
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const name = String(body?.name ?? '').trim();
    const email = String(body?.email ?? '').trim();
    const message = String(body?.message ?? '').trim();

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ ok: false, error: 'Name, email, and message are required' }), {
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

    // MVP: Log the message. In production, forward to an email service
    // (e.g. Cloudflare Email Routing / Resend) or a ticketing endpoint.
    console.log(`[contact] From: ${name} <${email}>`);
    console.log(`[contact] Message: ${message}`);

    return new Response(JSON.stringify({ ok: true, message: 'Message received' }), {
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
