/**
 * The Best-Practices Cloudflare Worker Proxy Script (Corrected Version)
 * ---------------------------------------------------------------------
 * This script is modified to avoid the "Error 1003: Direct IP access not allowed".
 * It uses a hostname for the destination and Cloudflare's `resolveOverride` feature
 * to correctly route requests to the backend IP without directly fetching the IP.
 *
 * Your AWS Public IPv4: 54.169.222.135
 *
 * Version: 3.2
 */

// ##################################################################
// #################### CONFIGURATION SETTINGS ####################
// ##################################################################

const config = {
  // သင်၏ AWS server (IP: 54.169.222.135) ကို ညွှန်းထားသော domain name
  destinationHostname: 'Proxy.tha4471.online',

  // Optional: A list of user-agents to block or challenge.
  blockedUserAgents: ['BadBot', 'AhrefsBot', 'SemrushBot', 'MJ12bot'],
};

// ##################################################################
// #################### CORE PROXY LOGIC ############################
// ##################################################################

export default {
  async fetch(request, env, ctx) {
    const originalUrl = new URL(request.url);
    const userAgent = request.headers.get('User-Agent') || '';

    // --- Basic Bot Protection ---
    if (config.blockedUserAgents.some(bot => userAgent.includes(bot))) {
      return new Response('Access Denied: Malicious bot detected.', {
        status: 403,
        statusText: 'Forbidden',
      });
    }
    
    // --- Construct the new request to the destination server ---
    const newRequestUrl = new URL(request.url);
    const newRequestHeaders = new Headers(request.headers);

    // --- Set Important Headers for the Backend Server ---
    newRequestHeaders.set('Host', config.destinationHostname);
    const clientIp = request.headers.get('CF-Connecting-IP');
    if (clientIp) {
      newRequestHeaders.set('X-Forwarded-For', clientIp);
      newRequestHeaders.set('X-Real-IP', clientIp);
    }
    newRequestHeaders.set('X-Forwarded-Host', originalUrl.hostname);
    newRequestHeaders.set('X-Forwarded-Proto', originalUrl.protocol.slice(0, -1));

    // --- Create and send the final request with resolveOverride ---
    const newRequest = new Request(newRequestUrl.toString(), {
      method: request.method,
      headers: newRequestHeaders,
      body: request.body,
      redirect: 'manual',
      cf: {
        resolveOverride: config.destinationHostname,
      },
    });

    try {
      return await fetch(newRequest);
    } catch (error) {
      console.error('Fetch to origin failed:', error);
      return new Response('The origin server is currently unavailable. Please try again later.', {
        status: 503,
        statusText: 'Service Unavailable',
      });
    }
  },
};
