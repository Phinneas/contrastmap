import type { APIRoute } from 'astro';

// Handled on-demand by the Worker (not prerendered), so POST requests reach it.
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const email = body?.email;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ ok: false, error: 'Valid email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // MVP: Log the email. In production, forward to ConvertKit/Beehiiv/Mailchimp
    // via an environment variable for the API key.
    console.log(`[newsletter] New subscriber: ${email}`);

    // TODO: When newsletter provider is configured:
    // const apiKey = import.meta.env.NEWSLETTER_API_KEY;
    // if (apiKey) { /* forward to provider */ }

    return new Response(JSON.stringify({ ok: true, message: 'Subscribed successfully' }), {
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
