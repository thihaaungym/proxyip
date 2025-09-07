/**
 * The Best-Practices Cloudflare Worker Proxy Script
 * ---------------------------------------------------
 * This script includes best practices for proxying requests to a backend server.
 *
 * Features:
 * 1. Forwards the real client IP address.
 * 2. Forwards original host and protocol information.
 * 3. Handles potential connection errors gracefully.
 * 4. Provides a basic bot challenge for simple bots.
 * 5. Easy-to-configure settings at the top.
 *
 * Your AWS Public IPv4: 54.169.222.135
 * Your AWS Public IPv6: 2406:da18:90f:a800:3bfe:1ac0:6034:139f
 *
 * Version: 3.0
 */

// ##################################################################
// #################### CONFIGURATION SETTINGS ####################
// ##################################################################

const config = {
  // Your destination server's Public IPv4 address.
  destinationIPv4: '54.169.222.135',

  // Optional: A list of user-agents to block or challenge.
  // Add common bot user-agents here if you want to block them.
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
    // Check if the user-agent is in our blocked list.
    if (config.blockedUserAgents.some(bot => userAgent.includes(bot))) {
      return new Response('Access Denied: Malicious bot detected.', {
        status: 403,
        statusText: 'Forbidden',
      });
    }

    // --- Construct the new request to the destination server ---
    // Use the IPv4 address for the hostname.
    const destinationUrl = new URL(originalUrl.pathname + originalUrl.search, `https://${config.destinationIPv4}`);

    // Create a mutable copy of the request headers.
    const newRequestHeaders = new Headers(request.headers);

    // --- Set Important Headers for the Backend Server ---
    // Set the 'Host' header to the destination IP to ensure correct routing.
    newRequestHeaders.set('Host', config.destinationIPv4);

    // Forward the original client's IP address.
    // 'CF-Connecting-IP' is a header added by Cloudflare containing the real visitor IP.
    const clientIp = request.headers.get('CF-Connecting-IP');
    if (clientIp) {
      newRequestHeaders.set('X-Forwarded-For', clientIp);
      newRequestHeaders.set('X-Real-IP', clientIp);
    }

    // Forward the original hostname (e.g., proxy.yourdomain.com).
    newRequestHeaders.set('X-Forwarded-Host', originalUrl.hostname);

    // Forward the original protocol (http or https).
    newRequestHeaders.set('X-Forwarded-Proto', originalUrl.protocol.slice(0, -1));

    // --- Create and send the final request ---
    const newRequest = new Request(destinationUrl.toString(), {
      method: request.method,
      headers: newRequestHeaders,
      body: request.body,
      redirect: 'manual', // Let the client handle redirects.
    });

    try {
      // Send the modified request to your AWS server.
      return await fetch(newRequest);
    } catch (error) {
      // If the server is down or there's a network error, return a graceful error page.
      console.error('Fetch to origin failed:', error);
      return new Response('The origin server is currently unavailable. Please try again later.', {
        status: 503,
        statusText: 'Service Unavailable',
      });
    }
  },
};
