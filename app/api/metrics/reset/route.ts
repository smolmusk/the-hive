import { NextResponse } from 'next/server';

import { resetMetrics } from '@/lib/metrics';

export const POST = async () => {
  if (process.env.ENABLE_METRICS_ENDPOINT !== 'true') {
    return new NextResponse('Not Found', { status: 404 });
  }

  resetMetrics();

  const response = NextResponse.json({ ok: true });
  response.headers.set('Cache-Control', 'no-store');
  return response;
};
