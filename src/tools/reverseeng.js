// Reverse Engineering — analyze websites and generate clone scaffolds

import { webFetch } from './webFetch.js';

export async function analyzeWebsite(url) {
  const result = await webFetch(url);
  const html = result.content;

  const analysis = {
    url,
    title: '',
    techStack: [],
    frameworks: [],
    meta: {},
    structure: [],
  };

  // Extract title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleMatch) analysis.title = titleMatch[1].trim();

  // Detect frameworks/libraries from HTML hints
  const detections = [
    [/react/i, 'React'],
    [/next/i, 'Next.js'],
    [/vue/i, 'Vue.js'],
    [/nuxt/i, 'Nuxt'],
    [/angular/i, 'Angular'],
    [/svelte/i, 'Svelte'],
    [/tailwind/i, 'Tailwind CSS'],
    [/bootstrap/i, 'Bootstrap'],
    [/jquery/i, 'jQuery'],
    [/wordpress/i, 'WordPress'],
    [/shopify/i, 'Shopify'],
    [/vercel/i, 'Vercel'],
    [/netlify/i, 'Netlify'],
    [/cloudflare/i, 'Cloudflare'],
    [/gatsby/i, 'Gatsby'],
    [/webpack/i, 'Webpack'],
    [/vite/i, 'Vite'],
    [/stripe/i, 'Stripe'],
    [/firebase/i, 'Firebase'],
    [/supabase/i, 'Supabase'],
  ];

  for (const [pattern, name] of detections) {
    if (pattern.test(html)) {
      analysis.frameworks.push(name);
    }
  }

  // Detect meta tags
  const metaRegex = /<meta[^>]*(?:name|property)="([^"]*)"[^>]*content="([^"]*)"[^>]*>/gi;
  let metaMatch;
  while ((metaMatch = metaRegex.exec(html)) !== null) {
    analysis.meta[metaMatch[1]] = metaMatch[2].substring(0, 100);
  }

  // Detect page structure
  const sections = ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer', 'form'];
  for (const tag of sections) {
    const count = (html.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
    if (count > 0) analysis.structure.push(`${tag} (${count})`);
  }

  // Detect external resources
  const scriptSrcs = (html.match(/src="([^"]*\.js[^"]*)"/gi) || []).slice(0, 10);
  const cssSrcs = (html.match(/href="([^"]*\.css[^"]*)"/gi) || []).slice(0, 10);

  let report = `Website Analysis: ${analysis.title || url}\n`;
  report += `URL: ${url}\n\n`;

  if (analysis.frameworks.length > 0) {
    report += `Detected Tech: ${analysis.frameworks.join(', ')}\n`;
  }

  if (analysis.structure.length > 0) {
    report += `Page Structure: ${analysis.structure.join(', ')}\n`;
  }

  if (analysis.meta.description) {
    report += `Description: ${analysis.meta.description}\n`;
  }

  if (scriptSrcs.length > 0) {
    report += `\nScripts (${scriptSrcs.length}): ${scriptSrcs.slice(0, 5).join(', ')}\n`;
  }

  if (cssSrcs.length > 0) {
    report += `Styles (${cssSrcs.length}): ${cssSrcs.slice(0, 5).join(', ')}\n`;
  }

  return report;
}

export async function generateCloneScaffold(url) {
  const analysis = await analyzeWebsite(url);

  // Determine best template based on detected tech
  let template = 'html'; // default
  if (analysis.includes('React') || analysis.includes('Next.js')) template = 'react';
  if (analysis.includes('Vue') || analysis.includes('Nuxt')) template = 'vue';

  return `${analysis}\n\nRecommended scaffold: Use create_project with template "${template}" as a starting point, then customize based on the analysis above.`;
}
