import { renderToString } from 'react-dom/server';
import React, { ReactElement } from 'react';

export async function renderEmailTemplate(component: ReactElement): Promise<string> {
  try {
    const html = renderToString(component);
    return html;
  } catch (error) {
    console.error('[v0] Error rendering email template:', error);
    throw new Error(`Failed to render email template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
