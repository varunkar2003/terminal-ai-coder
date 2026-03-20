// API testing — discover and test HTTP endpoints

export async function testEndpoint(url, method = 'GET', body = null, headers = {}) {
  const opts = {
    method: method.toUpperCase(),
    headers: { 'Content-Type': 'application/json', ...headers },
  };

  if (body && method.toUpperCase() !== 'GET') {
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const start = Date.now();

  try {
    const res = await fetch(url, opts);
    const elapsed = Date.now() - start;
    const contentType = res.headers.get('content-type') || '';

    let responseBody;
    if (contentType.includes('json')) {
      responseBody = JSON.stringify(await res.json(), null, 2);
    } else {
      responseBody = await res.text();
    }

    // Truncate large responses
    if (responseBody.length > 3000) {
      responseBody = responseBody.substring(0, 3000) + '\n...(truncated)';
    }

    return [
      `${method.toUpperCase()} ${url}`,
      `Status: ${res.status} ${res.statusText}`,
      `Time: ${elapsed}ms`,
      `Content-Type: ${contentType}`,
      ``,
      responseBody,
    ].join('\n');
  } catch (err) {
    return `${method.toUpperCase()} ${url}\nError: ${err.message}`;
  }
}

export async function testMultipleEndpoints(endpoints) {
  // endpoints = [{ url, method, body, headers }, ...]
  const results = [];

  for (const ep of endpoints) {
    const result = await testEndpoint(ep.url, ep.method, ep.body, ep.headers);
    results.push(result);
  }

  return results.join('\n\n---\n\n');
}

export async function healthCheck(baseUrl) {
  const endpoints = [
    { path: '/', name: 'Root' },
    { path: '/health', name: 'Health' },
    { path: '/api', name: 'API' },
    { path: '/api/status', name: 'API Status' },
  ];

  const results = [];
  for (const ep of endpoints) {
    const url = baseUrl.replace(/\/$/, '') + ep.path;
    try {
      const start = Date.now();
      const res = await fetch(url, { method: 'GET' });
      const elapsed = Date.now() - start;
      results.push(`${ep.name} (${ep.path}): ${res.status} — ${elapsed}ms`);
    } catch (err) {
      results.push(`${ep.name} (${ep.path}): FAILED — ${err.message}`);
    }
  }

  return results.join('\n');
}
